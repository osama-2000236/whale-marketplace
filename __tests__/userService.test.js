jest.mock('../lib/prisma', () => ({
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  review: {
    findMany: jest.fn(),
  },
  savedListing: {
    count: jest.fn(),
  },
  sellerProfile: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  sendWelcome: jest.fn(() => Promise.resolve()),
}));

const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');
const userService = require('../services/userService');

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('register rejects invalid input', async () => {
    await expect(
      userService.register({
        username: 'a',
        email: 'valid@example.com',
        password: 'password123',
      })
    ).rejects.toThrow('INVALID_USERNAME');

    await expect(
      userService.register({
        username: 'valid_user',
        email: 'invalid-email',
        password: 'password123',
      })
    ).rejects.toThrow('INVALID_EMAIL');
  });

  test('register creates a normalized user and sends welcome email', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed-pass');
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      username: 'test_user',
      email: 'user@example.com',
      subscription: {},
      sellerProfile: {},
    });

    const user = await userService.register({
      username: 'Test_User',
      email: 'User@Example.com',
      password: 'StrongPass123',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass123', 12);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'test_user',
          email: 'user@example.com',
          passwordHash: 'hashed-pass',
        }),
      })
    );
    expect(emailService.sendWelcome).toHaveBeenCalledWith(user);
  });

  test('register throws EMAIL_TAKEN when existing email matches', async () => {
    prisma.user.findFirst.mockResolvedValue({ email: 'user@example.com' });

    await expect(
      userService.register({
        username: 'other_user',
        email: 'user@example.com',
        password: 'StrongPass123',
      })
    ).rejects.toThrow('EMAIL_TAKEN');
  });

  test('authenticate throws WRONG_PASSWORD when bcrypt compare fails', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      isBanned: false,
      passwordHash: 'hashed-pass',
      subscription: {},
      sellerProfile: {},
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(userService.authenticate('user@example.com', 'wrong-pass')).rejects.toThrow(
      'WRONG_PASSWORD'
    );
  });

  test('authenticate updates lastSeenAt and returns user on success', async () => {
    const user = {
      id: 'u1',
      username: 'demo',
      isBanned: false,
      passwordHash: 'hashed-pass',
      subscription: {},
      sellerProfile: {},
    };
    prisma.user.findFirst.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);
    prisma.user.update.mockResolvedValue(user);

    const result = await userService.authenticate('demo', 'correct-pass');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { lastSeenAt: expect.any(Date) },
    });
    expect(result).toBe(user);
  });

  test('findOrCreateOAuth returns existing user by provider id', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'oauth-user' });
    prisma.user.update.mockResolvedValueOnce({ id: 'oauth-user' });

    const result = await userService.findOrCreateOAuth('google', 'provider-1', {
      displayName: 'OAuth User',
      emails: [{ value: 'oauth@example.com' }],
      photos: [{ value: 'avatar.jpg' }],
    });

    expect(result).toEqual({ user: { id: 'oauth-user' }, isNew: false });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'oauth-user' },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  test('findOrCreateOAuth creates new user when not found', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // googleId
      .mockResolvedValueOnce(null) // email
      .mockResolvedValueOnce({ id: 'collision' }) // username collision
      .mockResolvedValueOnce(null); // username available

    prisma.user.create.mockResolvedValue({
      id: 'new-oauth-user',
      username: 'newuser_1',
      subscription: {},
      sellerProfile: {},
    });

    const result = await userService.findOrCreateOAuth('google', 'provider-2', {
      displayName: 'New User',
      emails: [{ value: 'new@example.com' }],
      photos: [{ value: 'avatar.jpg' }],
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          googleId: 'provider-2',
          email: 'new@example.com',
        }),
      })
    );
    expect(result).toEqual({
      user: expect.objectContaining({ id: 'new-oauth-user' }),
      isNew: true,
    });
  });

  test('updateProfile updates user + sellerProfile in a transaction', async () => {
    const updatedUser = { id: 'u1', bio: 'new bio' };
    prisma.user.update.mockResolvedValue(updatedUser);
    prisma.sellerProfile.update.mockResolvedValue({ userId: 'u1' });
    prisma.$transaction.mockResolvedValue([updatedUser, { userId: 'u1' }]);

    const result = await userService.updateProfile('u1', {
      bio: 'new bio',
      displayName: 'Seller One',
      city: 'Gaza',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ bio: 'new bio' }),
      })
    );
    expect(prisma.sellerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        data: expect.objectContaining({ displayName: 'Seller One', city: 'Gaza' }),
      })
    );
    expect(result).toEqual(updatedUser);
  });
});
