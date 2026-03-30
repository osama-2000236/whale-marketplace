jest.mock('../lib/prisma', () => ({
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  sellerProfile: {
    update: jest.fn(),
  },
}));

jest.mock('../services/emailService', () => ({
  sendWelcome: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/authSecurityService', () => ({
  sendVerificationEmail: jest.fn(() => Promise.resolve()),
}));

process.env.DATABASE_URL = 'postgresql://test/db';

const prisma = require('../lib/prisma');
const emailService = require('../services/emailService');
const authSecurityService = require('../services/authSecurityService');
const userService = require('../services/userService');

describe('OAuth flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findFirst.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.user.create.mockReset();
    prisma.user.update.mockReset();
    prisma.sellerProfile.update.mockReset();
    emailService.sendWelcome.mockResolvedValue();
    authSecurityService.sendVerificationEmail.mockResolvedValue();
  });

  test('google provider uses googleId lookup', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u_google',
      subscription: {},
      sellerProfile: {},
    });
    prisma.user.update.mockResolvedValueOnce({ id: 'u_google' });

    const result = await userService.findOrCreateOAuth('google', 'google-123', {
      displayName: 'Google User',
      emails: [{ value: 'google@example.com' }],
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { googleId: 'google-123' },
      include: { subscription: true, sellerProfile: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u_google' },
      data: { lastSeenAt: expect.any(Date) },
      include: { subscription: true, sellerProfile: true },
    });
    expect(result).toEqual({ user: expect.objectContaining({ id: 'u_google' }), isNew: false });
  });

  test('facebook provider uses facebookId lookup', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u_facebook',
      subscription: {},
      sellerProfile: {},
    });
    prisma.user.update.mockResolvedValueOnce({ id: 'u_facebook' });

    await userService.findOrCreateOAuth('facebook', 'facebook-123', {
      displayName: 'Facebook User',
      emails: [{ value: 'facebook@example.com' }],
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { facebookId: 'facebook-123' },
      include: { subscription: true, sellerProfile: true },
    });
  });

  test('apple provider uses appleId lookup', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u_apple',
      subscription: {},
      sellerProfile: {},
    });
    prisma.user.update.mockResolvedValueOnce({ id: 'u_apple' });

    await userService.findOrCreateOAuth('apple', 'apple-123', {
      displayName: 'Apple User',
      emails: [{ value: 'apple@example.com' }],
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { appleId: 'apple-123' },
      include: { subscription: true, sellerProfile: true },
    });
  });

  test('existing user by email gets provider id linked and returns isNew false', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // provider lookup
      .mockResolvedValueOnce({
        id: 'u_by_email',
        email: 'user@example.com',
        avatarUrl: null,
        isBanned: false,
        sellerProfile: { isVerified: false },
      }); // email lookup
    prisma.user.update.mockResolvedValueOnce({
      id: 'u_by_email',
      email: 'user@example.com',
      googleId: 'google-999',
      subscription: {},
      sellerProfile: { isVerified: false },
    });
    prisma.sellerProfile.update.mockResolvedValueOnce({ userId: 'u_by_email', isVerified: true });

    const result = await userService.findOrCreateOAuth('google', 'google-999', {
      displayName: 'Existing User',
      emails: [{ value: 'user@example.com' }],
      photos: [{ value: 'https://example.com/avatar.jpg' }],
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u_by_email' },
      data: {
        googleId: 'google-999',
        avatarUrl: 'https://example.com/avatar.jpg',
        emailVerified: true,
        isVerified: true,
        lastSeenAt: expect.any(Date),
        pendingEmail: null,
      },
      include: { subscription: true, sellerProfile: true },
    });
    expect(prisma.sellerProfile.update).toHaveBeenCalledWith({
      where: { userId: 'u_by_email' },
      data: { isVerified: true },
    });
    expect(result).toEqual({
      user: expect.objectContaining({ id: 'u_by_email', googleId: 'google-999' }),
      isNew: false,
    });
  });

  test('new user path creates user with subscription and sellerProfile include', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // provider lookup
      .mockResolvedValueOnce(null) // email lookup
      .mockResolvedValueOnce(null) // username collision check
      .mockResolvedValueOnce(null); // username available
    prisma.user.findFirst.mockResolvedValue(null);

    prisma.user.create.mockResolvedValueOnce({
      id: 'u_new',
      username: 'newoauthuser',
      email: 'new@example.com',
      subscription: {},
      sellerProfile: {},
    });

    const result = await userService.findOrCreateOAuth('facebook', 'facebook-new', {
      displayName: 'New OAuth User',
      emails: [{ value: 'new@example.com' }],
      photos: [{ value: 'https://example.com/avatar.jpg' }],
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          facebookId: 'facebook-new',
          subscription: { create: expect.any(Object) },
          sellerProfile: { create: expect.any(Object) },
        }),
        include: { subscription: true, sellerProfile: true },
      })
    );
    expect(result).toEqual({
      user: expect.objectContaining({ id: 'u_new' }),
      isNew: true,
    });
    expect(emailService.sendWelcome).toHaveBeenCalled();
    expect(authSecurityService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
