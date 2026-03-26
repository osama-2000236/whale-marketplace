const prisma = require('../lib/prisma');
const bcrypt = require('bcrypt');
const slugify = require('slugify');
const emailService = require('./emailService');

const BCRYPT_ROUNDS = 12;

async function register({ username, email, password }) {
  if (
    !username ||
    username.length < 3 ||
    username.length > 30 ||
    !/^[a-zA-Z0-9_]+$/.test(username)
  ) {
    throw new Error('INVALID_USERNAME');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('INVALID_EMAIL');
  }
  if (!password || password.length < 8) {
    throw new Error('WEAK_PASSWORD');
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] },
  });
  if (existingUser) {
    if (existingUser.email === email.toLowerCase()) throw new Error('EMAIL_TAKEN');
    throw new Error('USERNAME_TAKEN');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const slug = slugify(username, { lower: true, strict: true });

  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      slug,
      email: email.toLowerCase(),
      passwordHash,
      subscription: {
        create: { plan: 'free', trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      sellerProfile: {
        create: { displayName: username },
      },
    },
    include: { subscription: true, sellerProfile: true },
  });

  emailService.sendWelcome(user).catch(() => {});

  return user;
}

async function authenticate(identifier, password) {
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { email: identifier.toLowerCase().trim() },
        { username: identifier.toLowerCase().trim() },
      ],
    },
    include: { subscription: true, sellerProfile: true },
  });

  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.isBanned) throw new Error('USER_BANNED');
  if (!user.passwordHash) throw new Error('OAUTH_ONLY');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('WRONG_PASSWORD');

  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

  return user;
}

async function findOrCreateOAuth(provider, providerId, profile) {
  const idField = provider + 'Id'; // googleId, facebookId, appleId
  const email = profile.emails?.[0]?.value?.toLowerCase();

  let user = await prisma.user.findUnique({
    where: { [idField]: providerId },
    include: { subscription: true, sellerProfile: true },
  });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    return { user, isNew: false };
  }

  if (email) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { [idField]: providerId, lastSeenAt: new Date() },
        include: { subscription: true, sellerProfile: true },
      });
      return { user, isNew: false };
    }
  }

  let username =
    (profile.displayName || (email && email.split('@')[0]) || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 30) || 'user_' + Date.now();

  let finalUsername = username;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { username: finalUsername } })) {
    finalUsername = username.slice(0, 27) + '_' + counter++;
  }

  const slug = slugify(finalUsername, { lower: true, strict: true });

  user = await prisma.user.create({
    data: {
      username: finalUsername,
      slug,
      email: email || `${finalUsername}@oauth.whale`,
      [idField]: providerId,
      avatarUrl: profile.photos?.[0]?.value || null,
      isVerified: true,
      subscription: {
        create: { plan: 'free', trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      sellerProfile: {
        create: { displayName: profile.displayName || finalUsername },
      },
    },
    include: { subscription: true, sellerProfile: true },
  });

  emailService.sendWelcome(user).catch(() => {});

  return { user, isNew: true };
}

async function getProfile(usernameOrSlug, viewerId) {
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ username: usernameOrSlug }, { slug: usernameOrSlug }],
    },
    include: {
      sellerProfile: true,
      listings: {
        where: { status: 'ACTIVE' },
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      },
    },
  });

  if (!user) throw new Error('USER_NOT_FOUND');

  const reviews = await prisma.review.findMany({
    where: { sellerId: user.id },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { reviewer: { select: { username: true, avatarUrl: true } } },
  });

  let savedCount = 0;
  if (viewerId) {
    savedCount = await prisma.savedListing.count({ where: { userId: viewerId } });
  }

  return { ...user, reviews, savedCount };
}

async function updateProfile(userId, data) {
  const { bio, displayName, city, whatsapp, avatarUrl } = data;

  const userUpdate = {};
  if (bio !== undefined) userUpdate.bio = bio;
  if (avatarUrl) userUpdate.avatarUrl = avatarUrl;

  const profileUpdate = {};
  if (displayName) profileUpdate.displayName = displayName;
  if (city !== undefined) profileUpdate.city = city;
  if (whatsapp !== undefined) profileUpdate.whatsapp = whatsapp;
  if (bio !== undefined) profileUpdate.bio = bio;

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: userUpdate,
      include: { sellerProfile: true, subscription: true },
    }),
    prisma.sellerProfile.update({
      where: { userId },
      data: profileUpdate,
    }),
  ]);

  return user;
}

module.exports = { register, authenticate, findOrCreateOAuth, getProfile, updateProfile };
