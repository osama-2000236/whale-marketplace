const crypto = require('crypto');
const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const emailService = require('./emailService');

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY_HOURS = 24;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildExpiryDate() {
  return new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
}

async function invalidateOpenTokens(tx, userId, type) {
  await tx.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
}

async function sendVerificationEmail(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.emailVerified) throw new Error('ALREADY_VERIFIED');

  let token;
  await prisma.$transaction(async (tx) => {
    await invalidateOpenTokens(tx, userId, 'EMAIL_VERIFICATION');
    token = generateToken();
    await tx.authToken.create({
      data: {
        userId,
        token,
        type: 'EMAIL_VERIFICATION',
        expiresAt: buildExpiryDate(),
      },
    });
  });

  await emailService.sendVerificationEmail(user, token);
  return { sent: true, token };
}

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
      data: { emailVerified: true, isVerified: true, pendingEmail: null },
    }),
    prisma.sellerProfile.updateMany({
      where: { userId: authToken.userId },
      data: { isVerified: true },
    }),
  ]);

  return { verified: true };
}

async function sendEmailChangeVerification(userId, nextEmail) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  const normalizedEmail = String(nextEmail || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('INVALID_EMAIL');
  if (normalizedEmail === user.email) throw new Error('EMAIL_UNCHANGED');

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { pendingEmail: normalizedEmail }],
      NOT: { id: userId },
    },
    select: { id: true },
  });
  if (existingUser) throw new Error('EMAIL_TAKEN');

  let token;
  await prisma.$transaction(async (tx) => {
    await invalidateOpenTokens(tx, userId, 'EMAIL_CHANGE');
    await tx.user.update({
      where: { id: userId },
      data: { pendingEmail: normalizedEmail },
    });
    token = generateToken();
    await tx.authToken.create({
      data: {
        userId,
        token,
        type: 'EMAIL_CHANGE',
        expiresAt: buildExpiryDate(),
      },
    });
  });

  await emailService.sendEmailChangeVerification(user, normalizedEmail, token);
  return { sent: true, token };
}

async function verifyEmailChange(token) {
  const authToken = await prisma.authToken.findUnique({ where: { token } });

  if (!authToken) throw new Error('INVALID_TOKEN');
  if (authToken.type !== 'EMAIL_CHANGE') throw new Error('INVALID_TOKEN');
  if (authToken.usedAt) throw new Error('TOKEN_USED');
  if (authToken.expiresAt < new Date()) throw new Error('TOKEN_EXPIRED');

  const user = await prisma.user.findUnique({ where: { id: authToken.userId } });
  if (!user || !user.pendingEmail) throw new Error('NO_PENDING_EMAIL');

  const existingUser = await prisma.user.findFirst({
    where: {
      email: user.pendingEmail,
      NOT: { id: user.id },
    },
    select: { id: true },
  });
  if (existingUser) throw new Error('EMAIL_TAKEN');

  await prisma.$transaction([
    prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: authToken.userId },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        emailVerified: true,
        isVerified: true,
      },
    }),
  ]);

  return { verified: true };
}

async function sendPasswordReset(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return { sent: true };

  let token;
  await prisma.$transaction(async (tx) => {
    await invalidateOpenTokens(tx, user.id, 'PASSWORD_RESET');
    token = generateToken();
    await tx.authToken.create({
      data: {
        userId: user.id,
        token,
        type: 'PASSWORD_RESET',
        expiresAt: buildExpiryDate(),
      },
    });
  });

  await emailService.sendPasswordReset(user, token);
  return { sent: true, token };
}

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

function generateAdmin2FACode(secret) {
  const timeStep = Math.floor(Date.now() / (30 * 1000));
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(String(timeStep));
  const code = parseInt(hmac.digest('hex').slice(-6), 16) % 1000000;
  return String(code).padStart(6, '0');
}

function verifyAdmin2FA(secret, code) {
  const timeStep = Math.floor(Date.now() / (30 * 1000));
  for (let offset = -1; offset <= 1; offset++) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(String(timeStep + offset));
    const expected = parseInt(hmac.digest('hex').slice(-6), 16) % 1000000;
    if (code === String(expected).padStart(6, '0')) return true;
  }
  return false;
}

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
  sendEmailChangeVerification,
  verifyEmailChange,
  sendPasswordReset,
  resetPassword,
  generateAdmin2FACode,
  verifyAdmin2FA,
  setupAdmin2FA,
};
