jest.mock('../lib/prisma', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    sellerProfile: {
      updateMany: jest.fn(),
    },
    authToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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
  hash: jest.fn(() => Promise.resolve('hashed')),
}));

jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn(() => Promise.resolve()),
  sendEmailChangeVerification: jest.fn(() => Promise.resolve()),
  sendPasswordReset: jest.fn(() => Promise.resolve()),
}));

const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');
const authSecurityService = require('../services/authSecurityService');

describe('authSecurityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationEmail', () => {
    test('sends verification email for an unverified user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        emailVerified: false,
        username: 'test',
      });
      prisma.authToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.authToken.create.mockResolvedValue({ id: 'at1', token: 'abc' });

      const result = await authSecurityService.sendVerificationEmail('u1');

      expect(result.sent).toBe(true);
      expect(result.token).toEqual(expect.any(String));
      expect(prisma.authToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', type: 'EMAIL_VERIFICATION', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', email: 'test@example.com' }),
        expect.any(String),
      );
    });

    test('throws for already verified user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', emailVerified: true });

      await expect(authSecurityService.sendVerificationEmail('u1')).rejects.toThrow(
        'ALREADY_VERIFIED',
      );
    });

    test('throws for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authSecurityService.sendVerificationEmail('u1')).rejects.toThrow(
        'USER_NOT_FOUND',
      );
    });
  });

  describe('verifyEmail', () => {
    test('verifies a valid token and clears pending email state', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        id: 'at1',
        userId: 'u1',
        token: 'abc',
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prisma.authToken.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      prisma.sellerProfile.updateMany.mockResolvedValue({ count: 1 });

      const result = await authSecurityService.verifyEmail('abc');

      expect(result.verified).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { emailVerified: true, isVerified: true, pendingEmail: null },
      });
      expect(prisma.sellerProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { isVerified: true },
      });
    });

    test('rejects expired token', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        id: 'at1',
        userId: 'u1',
        token: 'abc',
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(authSecurityService.verifyEmail('abc')).rejects.toThrow('TOKEN_EXPIRED');
    });

    test('rejects used token', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        id: 'at1',
        userId: 'u1',
        token: 'abc',
        type: 'EMAIL_VERIFICATION',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(authSecurityService.verifyEmail('abc')).rejects.toThrow('TOKEN_USED');
    });

    test('rejects invalid token', async () => {
      prisma.authToken.findUnique.mockResolvedValue(null);

      await expect(authSecurityService.verifyEmail('bad')).rejects.toThrow('INVALID_TOKEN');
    });
  });

  describe('email change verification', () => {
    test('stores pending email and sends a verification email', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'old@example.com',
        username: 'test',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.authToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.user.update.mockResolvedValue({});
      prisma.authToken.create.mockResolvedValue({ id: 'at2', token: 'def' });

      const result = await authSecurityService.sendEmailChangeVerification(
        'u1',
        'New@Example.com',
      );

      expect(result.sent).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { pendingEmail: 'new@example.com' },
      });
      expect(prisma.authToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', type: 'EMAIL_CHANGE', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(emailService.sendEmailChangeVerification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', email: 'old@example.com' }),
        'new@example.com',
        expect.any(String),
      );
    });

    test('swaps the pending email when the token is valid', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        id: 'at2',
        userId: 'u1',
        token: 'def',
        type: 'EMAIL_CHANGE',
        usedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'old@example.com',
        pendingEmail: 'new@example.com',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.authToken.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      const result = await authSecurityService.verifyEmailChange('def');

      expect(result.verified).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          email: 'new@example.com',
          pendingEmail: null,
          emailVerified: true,
          isVerified: true,
        },
      });
    });
  });

  describe('sendPasswordReset', () => {
    test('sends reset email for a valid local account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        passwordHash: 'hash',
        username: 'test',
      });
      prisma.authToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.authToken.create.mockResolvedValue({ id: 'at1', token: 'abc' });

      const result = await authSecurityService.sendPasswordReset('test@example.com');

      expect(result.sent).toBe(true);
      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', email: 'test@example.com' }),
        expect.any(String),
      );
    });

    test('returns success for a non-existent email to prevent enumeration', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await authSecurityService.sendPasswordReset('nobody@example.com');

      expect(result.sent).toBe(true);
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    test('also sends a setup email for oauth-only accounts', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'oauth@example.com',
        passwordHash: null,
      });
      prisma.authToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.authToken.create.mockResolvedValue({ id: 'at1', token: 'abc' });

      const result = await authSecurityService.sendPasswordReset('oauth@example.com');

      expect(result.sent).toBe(true);
      expect(emailService.sendPasswordReset).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    test('resets password with a valid token', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        id: 'at1',
        userId: 'u1',
        token: 'abc',
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prisma.authToken.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      bcrypt.hash.mockResolvedValue('newhash');

      const result = await authSecurityService.resetPassword('abc', 'newpassword123');

      expect(result.reset).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: 'newhash' },
      });
    });

    test('rejects weak password', async () => {
      await expect(authSecurityService.resetPassword('abc', 'short')).rejects.toThrow(
        'WEAK_PASSWORD',
      );
    });

    test('rejects invalid token', async () => {
      prisma.authToken.findUnique.mockResolvedValue(null);

      await expect(authSecurityService.resetPassword('bad', 'newpassword123')).rejects.toThrow(
        'INVALID_TOKEN',
      );
    });
  });

  describe('2FA', () => {
    test('generateAdmin2FACode returns a 6-digit string', () => {
      const code = authSecurityService.generateAdmin2FACode('testsecret');
      expect(code).toMatch(/^\d{6}$/);
    });

    test('verifyAdmin2FA accepts a valid code', () => {
      const secret = 'testsecret123';
      const code = authSecurityService.generateAdmin2FACode(secret);
      expect(authSecurityService.verifyAdmin2FA(secret, code)).toBe(true);
    });

    test('verifyAdmin2FA rejects an invalid code', () => {
      expect(authSecurityService.verifyAdmin2FA('secret', '000000')).toBe(false);
    });

    test('setupAdmin2FA saves a secret', async () => {
      prisma.user.update.mockResolvedValue({});

      const result = await authSecurityService.setupAdmin2FA('u1');

      expect(result.secret).toBeTruthy();
      expect(result.secret.length).toBe(40);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { twoFactorSecret: result.secret },
      });
    });
  });
});
