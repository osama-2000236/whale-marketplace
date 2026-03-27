const crypto = require('crypto');
const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const emailService = require('./emailService');

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate a cryptographically secure token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create an email verification token and send the verification email
 */
async function sendVerificationEmail(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.emailVerified) throw new Error('ALREADY_VERIFIED');

  // Invalidate any existing verification tokens
  await prisma.authToken.updateMany({
    where: { userId, type: 'EMAIL_VERIFICATION', usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken();
  await prisma.authToken.create({
    data: {
      userId,
      token,
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  await emailService.sendVerificationEmail(user, token);
  return { sent: true };
}

/**
 * Verify an email using a token
 */
async function verifyEmail(token) {
  const authToken = await prisma.authToken.findUnique({ where: { token } });

  if (!authToken) throw new Error('INVALID_TOKEN');
  if (authToken.type !== 'EMAIL_VERIFICATION') throw new Error('INVALID_TOKEN');
  if (authToken.usedAt) throw new Error('TOKEN_USED');
  if (authToken.expiresAt < new Date()) throw new Error('TOKEN_EXPIRED');

  await prisma.$transaction([
    prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: authToken.userId },
      data: { emailVerified: true },
    }),
  ]);

  return { verified: true };
}

/**
 * Send a password reset email
 */
async function sendPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Always return success to prevent email enumeration
  if (!user) return { sent: true };
  if (!user.passwordHash) return { sent: true }; // OAuth-only accounts

  // Invalidate existing reset tokens
  await prisma.authToken.updateMany({
    where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken();
  await prisma.authToken.create({
    data: {
      userId: user.id,
      token,
      type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  await emailService.sendPasswordReset(user, token);
  return { sent: true };
}

/**
 * Reset password using a token
 */
async function resetPassword(token, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new Error('WEAK_PASSWORD');

  const authToken = await prisma.authToken.findUnique({ where: { token } });

  if (!authToken) throw new Error('INVALID_TOKEN');
  if (authToken.type !== 'PASSWORD_RESET') throw new Error('INVALID_TOKEN');
  if (authToken.usedAt) throw new Error('TOKEN_USED');
  if (authToken.expiresAt < new Date()) throw new Error('TOKEN_EXPIRED');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: authToken.userId },
      data: { passwordHash },
    }),
  ]);

  return { reset: true };
}

/**
 * Verify admin 2FA code (TOTP-style with time-based codes)
 * For simplicity, uses a HMAC-based approach with the user's secret
 */
function generateAdmin2FACode(secret) {
  const timeStep = Math.floor(Date.now() / (30 * 1000));
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(String(timeStep));
  const code = parseInt(hmac.digest('hex').slice(-6), 16) % 1000000;
  return String(code).padStart(6, '0');
}

function verifyAdmin2FA(secret, code) {
  const timeStep = Math.floor(Date.now() / (30 * 1000));
  // Check current and previous time steps (±30s window)
  for (let offset = -1; offset <= 1; offset++) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(String(timeStep + offset));
    const expected = parseInt(hmac.digest('hex').slice(-6), 16) % 1000000;
    if (code === String(expected).padStart(6, '0')) return true;
  }
  return false;
}

/**
 * Setup 2FA for an admin user
 */
async function setupAdmin2FA(userId) {
  const secret = crypto.randomBytes(20).toString('hex');
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret },
  });
  return { secret };
}

module.exports = {
  generateToken,
  sendVerificationEmail,
  verifyEmail,
  sendPasswordReset,
  resetPassword,
  generateAdmin2FACode,
  verifyAdmin2FA,
  setupAdmin2FA,
};
