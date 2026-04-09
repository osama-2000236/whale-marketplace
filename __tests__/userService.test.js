jest.mock('../lib/prisma', () => {
  const prisma = {
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
  };

  prisma.$transaction = jest.fn((input) => {
    if (typeof input === 'function') {
      return input(prisma);
    }
    return Promise.all(input);
  });

  return prisma;
});

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  sendWelcome: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/authSecurityService', () => ({
  sendVerificationEmail: jest.fn(() => Promise.resolve()),
  sendEmailChangeVerification: jest.fn(() => Promise.resolve({ sent: true })),
  sendPasswordReset: jest.fn(() => Promise.resolve({ sent: true })),
}));

process.env.DATABASE_URL = 'postgresql://test/db';

const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');
const authSecurityService = require('../services/authSecurityService');
const userService = require('../services/userService');

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findFirst.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.user.create.mockReset();
    prisma.user.update.mockReset();
    prisma.review.findMany.mockReset();
    prisma.savedListing.count.mockReset();
    prisma.sellerProfile.update.mockReset();
    prisma.$transaction.mockImplementation((input) => {
      if (typeof input === 'function') {
        return input(prisma);
      }
      return Promise.all(input);
    });
    bcrypt.hash.mockReset();
    bcrypt.compare.mockReset();
    emailService.sendWelcome.mockResolvedValue();
    authSecurityService.sendVerificationEmail.mockResolvedValue();
    authSecurityService.sendEmailChangeVerification.mockResolvedValue({ sent: true });
    authSecurityService.sendPasswordReset.mockResolvedValue({ sent: true });
  });

  test('register rejects invalid input', async () => {
    await expect(
      userService.register({
        username: 'a',
        email: 'valid@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow('INVALID_USERNAME');

    await expect(
      userService.register({
        username: 'valid_user',
        email: 'invalid-email',
        password: 'password123',
      }),
    ).rejects.toThrow('INVALID_EMAIL');
  });

  test('register creates a normalized user and sends welcome email', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed-pass');
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      username: 'test_user',
      email: 'user@example.com',
      emailVerified: true,
      isVerified: true,
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
      }),
    );
    expect(emailService.sendWelcome).toHaveBeenCalledWith(user);
    expect(authSecurityService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test('register throws EMAIL_TAKEN when existing email or pending email matches', async () => {
    prisma.user.findFirst.mockResolvedValue({ email: 'user@example.com' });

    await expect(
      userService.register({
        username: 'other_user',
        email: 'user@example.com',
        password: 'StrongPass123',
      }),
    ).rejects.toThrow('EMAIL_TAKEN');
  });

  test('register sends verification email in production when auto verify is disabled', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAutoVerify = process.env.AUTO_VERIFY_USERS;

    process.env.NODE_ENV = 'production';
    delete process.env.AUTO_VERIFY_USERS;
    jest.resetModules();

    const isolatedPrisma = require('../lib/prisma');
    const isolatedBcrypt = require('bcryptjs');
    const isolatedEmailService = require('../services/emailService');
    const isolatedAuthSecurityService = require('../services/authSecurityService');
    const isolatedUserService = require('../services/userService');

    isolatedPrisma.user.findFirst.mockResolvedValue(null);
    isolatedBcrypt.hash.mockResolvedValue('hashed-pass');
    isolatedPrisma.user.create.mockResolvedValue({
      id: 'u-verification',
      username: 'verify_me',
      email: 'verify@example.com',
      emailVerified: false,
      isVerified: false,
      subscription: {},
      sellerProfile: {},
    });

    await isolatedUserService.register({
      username: 'verify_me',
      email: 'verify@example.com',
      password: 'StrongPass123',
      confirmPassword: 'StrongPass123',
    });

    expect(isolatedEmailService.sendWelcome).toHaveBeenCalled();
    expect(isolatedAuthSecurityService.sendVerificationEmail).toHaveBeenCalledWith(
      'u-verification',
    );

    process.env.NODE_ENV = originalNodeEnv;
    if (originalAutoVerify === undefined) {
      delete process.env.AUTO_VERIFY_USERS;
    } else {
      process.env.AUTO_VERIFY_USERS = originalAutoVerify;
    }
    jest.resetModules();
  });

  test('authenticate throws WRONG_PASSWORD when bcrypt compare fails', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      isBanned: false,
      deletedAt: null,
      passwordHash: 'hashed-pass',
      subscription: {},
      sellerProfile: {},
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(userService.authenticate('user@example.com', 'wrong-pass')).rejects.toThrow(
      'WRONG_PASSWORD',
    );
  });

  test('authenticate updates lastSeenAt and returns user on success', async () => {
    const user = {
      id: 'u1',
      username: 'demo',
      email: 'demo@example.com',
      isBanned: false,
      deletedAt: null,
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

  test('findOrCreateOAuth links an existing email account and marks it verified', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'existing-user',
        email: 'oauth@example.com',
        avatarUrl: null,
        isBanned: false,
        sellerProfile: { isVerified: false },
      });
    prisma.user.update.mockResolvedValue({
      id: 'existing-user',
      email: 'oauth@example.com',
      googleId: 'provider-1',
      emailVerified: true,
      isVerified: true,
      sellerProfile: { isVerified: false },
      subscription: {},
    });
    prisma.sellerProfile.update.mockResolvedValue({ userId: 'existing-user', isVerified: true });

    const result = await userService.findOrCreateOAuth('google', 'provider-1', {
      displayName: 'OAuth User',
      emails: [{ value: 'oauth@example.com' }],
      photos: [{ value: 'avatar.jpg' }],
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'existing-user' },
      data: expect.objectContaining({
        googleId: 'provider-1',
        avatarUrl: 'avatar.jpg',
        emailVerified: true,
        isVerified: true,
        pendingEmail: null,
      }),
      include: { subscription: true, sellerProfile: true },
    });
    expect(prisma.sellerProfile.update).toHaveBeenCalledWith({
      where: { userId: 'existing-user' },
      data: { isVerified: true },
    });
    expect(result).toEqual({
      user: expect.objectContaining({ id: 'existing-user' }),
      isNew: false,
    });
  });

  test('findOrCreateOAuth creates a verified new user without sending a verification email', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'collision' })
      .mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-oauth-user',
      username: 'newuser_1',
      email: 'new@example.com',
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
          emailVerified: true,
          isVerified: true,
        }),
      }),
    );
    expect(result).toEqual({
      user: expect.objectContaining({ id: 'new-oauth-user' }),
      isNew: true,
    });
    expect(emailService.sendWelcome).toHaveBeenCalled();
    expect(authSecurityService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test('updateProfile updates user and seller profile then returns the refreshed account profile', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u1',
        username: 'seller1',
        sellerProfile: { displayName: 'Seller One' },
        addresses: [],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        bio: 'new bio',
        avatarUrl: 'https://cdn.example/avatar.png',
        pendingEmail: null,
        passwordHash: 'hash',
        subscription: {},
        sellerProfile: {
          displayName: 'Seller One',
          city: 'Gaza',
          whatsapp: '+970599',
          bio: 'new bio',
        },
        addresses: [],
      });
    prisma.user.update.mockResolvedValue({ id: 'u1' });
    prisma.sellerProfile.update.mockResolvedValue({ userId: 'u1' });

    const result = await userService.updateProfile('u1', {
      bio: 'new bio',
      displayName: 'Seller One',
      city: 'Gaza',
      whatsapp: '+970599123456',
      avatarUrl: 'https://cdn.example/avatar.png',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        bio: 'new bio',
        avatarUrl: 'https://cdn.example/avatar.png',
      },
    });
    expect(prisma.sellerProfile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: {
        displayName: 'Seller One',
        city: 'Gaza',
        whatsapp: '+970599123456',
        bio: 'new bio',
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'u1',
        sellerProfile: expect.objectContaining({
          displayName: 'Seller One',
          city: 'Gaza',
        }),
      }),
    );
  });

  test('changeUsername updates username and slug after verifying the current password', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u1',
        username: 'old_name',
        email: 'user@example.com',
        passwordHash: 'hashed-pass',
        isBanned: false,
        deletedAt: null,
        sellerProfile: {},
        addresses: [],
      })
      .mockResolvedValueOnce({
        id: 'u1',
        username: 'new_name',
        slug: 'new-name',
        passwordHash: 'hashed-pass',
        pendingEmail: null,
        subscription: {},
        sellerProfile: {},
        addresses: [],
      });
    bcrypt.compare.mockResolvedValue(true);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({ id: 'u1' });

    const result = await userService.changeUsername('u1', {
      currentPassword: 'StrongPass123',
      username: 'New_Name',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { username: 'new_name', slug: expect.any(String) },
    });
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { id: 'u1' },
      include: {
        subscription: true,
        sellerProfile: true,
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    expect(result).toEqual(expect.objectContaining({ username: 'new_name' }));
  });

  test('requestEmailChange normalizes the email and issues a verification request', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'seller1',
      email: 'old@example.com',
      passwordHash: 'hashed-pass',
      isBanned: false,
      deletedAt: null,
      sellerProfile: {},
      addresses: [],
    });
    bcrypt.compare.mockResolvedValue(true);
    prisma.user.findFirst.mockResolvedValue(null);
    authSecurityService.sendEmailChangeVerification.mockResolvedValue({ sent: true });

    const result = await userService.requestEmailChange('u1', {
      currentPassword: 'StrongPass123',
      email: 'New@Example.com',
    });

    expect(authSecurityService.sendEmailChangeVerification).toHaveBeenCalledWith(
      'u1',
      'new@example.com',
    );
    expect(result).toEqual({ sent: true });
  });

  test('changePassword sends a setup email for oauth-only users before blocking the change', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'oauth_user',
      email: 'oauth@example.com',
      passwordHash: null,
      isBanned: false,
      deletedAt: null,
      sellerProfile: {},
      addresses: [],
    });

    await expect(
      userService.changePassword('u1', {
        currentPassword: 'unused',
        newPassword: 'NewStrongPass123',
        confirmPassword: 'NewStrongPass123',
      }),
    ).rejects.toThrow('PASSWORD_SETUP_REQUIRED');

    expect(authSecurityService.sendPasswordReset).toHaveBeenCalledWith('oauth@example.com');
  });
});
