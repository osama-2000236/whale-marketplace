jest.mock('../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  authToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((fns) => Promise.all(fns)),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(() => Promise.resolve('hashed')),
}));

jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn(() => Promise.resolve()),
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
    test('sends verification email for unverified user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'test@test.com', emailVerified: false, username: 'test' });
      prisma.authToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.authToken.create.mockResolvedValue({ id: 'at1', token: 'abc' });

      const result = await authSecurityService.sendVerificationEmail('u1');
      expect(result.sent).toBe(true);
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    test('throws for already verified user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', emailVerified: true });
      await expect(authSecurityService.sendVerificationEmail('u1')).rejects.toThrow('ALREADY_VERIFIED');
    });

    test('throws for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(authSecurityService.sendVerificationEmail('u1')).rejects.toThrow('USER_NOT_FOUND');
    });
  });

  describe('verifyEmail', () => {
    test('verifies valid token', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        id: 'at1', userId: 'u1', token: 'abc', type: 'EMAIL_VERIFICATION',
        usedAt: null, expiresAt: new Date(Date.now() + 86400000),
      });
      prisma.authToken.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      const result = await authSecurityService.verifyEmail('abc');
      expect(result.verified).toBe(true);
    });

    test('rejects expired token', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        id: 'at1', userId: 'u1', token: 'abc', type: 'EMAIL_VERIFICATION',
        usedAt: null, expiresAt: new Date(Date.now() - 1000),
      });
      await expect(authSecurityService.verifyEmail('abc')).rejects.toThrow('TOKEN_EXPIRED');
    });

    test('rejects used token', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        id: 'at1', userId: 'u1', token: 'abc', type: 'EMAIL_VERIFICATION',
        usedAt: new Date(), expiresAt: new Date(Date.now() + 86400000),
      });
      await expect(authSecurityService.verifyEmail('abc')).rejects.toThrow('TOKEN_USED');
    });

    test('rejects invalid token', async () => {
      prisma.authToken.findUnique.mockResolvedValue(null);
      await expect(authSecurityService.verifyEmail('bad')).rejects.toThrow('INVALID_TOKEN');
    });
  });

  describe('sendPasswordReset', () => {
    test('sends reset email for valid user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'test@test.com', passwordHash: 'hash', username: 'test' });
      prisma.authToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.authToken.create.mockResolvedValue({ id: 'at1', token: 'abc' });

      const result = await authSecurityService.sendPasswordReset('test@test.com');
      expect(result.sent).toBe(true);
      expect(emailService.sendPasswordReset).toHaveBeenCalled();
    });

    test('returns success for non-existent email (prevents enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await authSecurityService.sendPasswordReset('nobody@test.com');
      expect(result.sent).toBe(true);
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    test('returns success for OAuth-only account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'test@test.com', passwordHash: null });
      const result = await authSecurityService.sendPasswordReset('test@test.com');
      expect(result.sent).toBe(true);
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    test('resets password with valid token', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        id: 'at1', userId: 'u1', token: 'abc', type: 'PASSWORD_RESET',
        usedAt: null, expiresAt: new Date(Date.now() + 86400000),
      });
      prisma.authToken.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      bcrypt.hash.mockResolvedValue('newhash');

      const result = await authSecurityService.resetPassword('abc', 'newpassword123');
      expect(result.reset).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
    });

    test('rejects weak password', async () => {
      await expect(authSecurityService.resetPassword('abc', 'short')).rejects.toThrow('WEAK_PASSWORD');
    });

    test('rejects invalid token', async () => {
      prisma.authToken.findUnique.mockResolvedValue(null);
      await expect(authSecurityService.resetPassword('bad', 'newpassword123')).rejects.toThrow('INVALID_TOKEN');
    });
  });

  describe('2FA', () => {
    test('generateAdmin2FACode returns 6-digit string', () => {
      const code = authSecurityService.generateAdmin2FACode('testsecret');
      expect(code).toMatch(/^\d{6}$/);
    });

    test('verifyAdmin2FA accepts valid code', () => {
      const secret = 'testsecret123';
      const code = authSecurityService.generateAdmin2FACode(secret);
      expect(authSecurityService.verifyAdmin2FA(secret, code)).toBe(true);
    });

    test('verifyAdmin2FA rejects invalid code', () => {
      expect(authSecurityService.verifyAdmin2FA('secret', '000000')).toBe(false);
    });

    test('setupAdmin2FA saves secret', async () => {
      prisma.user.update.mockResolvedValue({});
      const result = await authSecurityService.setupAdmin2FA('u1');
      expect(result.secret).toBeTruthy();
      expect(result.secret.length).toBe(40); // 20 bytes hex
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { twoFactorSecret: result.secret },
      });
    });
  });
});
