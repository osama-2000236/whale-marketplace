const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const emailService = require('./emailService');
const authSecurityService = require('./authSecurityService');
const fallbackStore = require('../lib/fallbackStore');

const BCRYPT_ROUNDS = 12;
const hasDatabase = Boolean(process.env.DATABASE_URL);
const shouldAutoVerifyUsers =
  process.env.AUTO_VERIFY_USERS === '1' || !hasDatabase || process.env.NODE_ENV !== 'production';

async function register({ username, email, password, confirmPassword }) {
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
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new Error('PASSWORD_MISMATCH');
  }

  const normalizedUsername = username.toLowerCase();
  const normalizedEmail = email.toLowerCase();

  let existingUser;
  if (hasDatabase) {
    existingUser = await prisma.user.findFirst({
      where: { OR: [{ username: normalizedUsername }, { email: normalizedEmail }] },
    });
  } else {
    existingUser =
      fallbackStore.findUserByUsername(normalizedUsername) ||
      fallbackStore.findUserByEmail(normalizedEmail);
  }
  if (existingUser) {
    if (existingUser.email === normalizedEmail) throw new Error('EMAIL_TAKEN');
    throw new Error('USERNAME_TAKEN');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const slug = slugify(username, { lower: true, strict: true });
  let user;

  if (hasDatabase) {
    user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        slug,
        email: normalizedEmail,
        passwordHash,
        emailVerified: shouldAutoVerifyUsers,
        isVerified: shouldAutoVerifyUsers,
        subscription: {
          create: { plan: 'free', trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
        sellerProfile: {
          create: { displayName: username, isVerified: shouldAutoVerifyUsers },
        },
      },
      include: { subscription: true, sellerProfile: true },
    });
  } else {
    user = fallbackStore.createUser({
      username,
      email,
      passwordHash,
      emailVerified: shouldAutoVerifyUsers,
      isVerified: shouldAutoVerifyUsers,
    });
    user.slug = slug;
    user.subscription.plan = 'free';
    user.subscription.trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.sellerProfile.displayName = username;
    user.sellerProfile.isVerified = shouldAutoVerifyUsers;
  }

  emailService.sendWelcome(user).catch(() => {});
  if (!shouldAutoVerifyUsers) {
    authSecurityService.sendVerificationEmail(user.id).catch(() => {});
  }

  return user;
}

async function authenticate(identifier, password) {
  const normalizedIdentifier = identifier.toLowerCase().trim();
  const user = hasDatabase
    ? await prisma.user.findFirst({
        where: {
          deletedAt: null,
          OR: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
        },
        include: { subscription: true, sellerProfile: true },
      })
    : fallbackStore.findUserByIdentifier(normalizedIdentifier);

  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.isBanned) throw new Error('USER_BANNED');
  if (!user.passwordHash) throw new Error('OAUTH_ONLY');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('WRONG_PASSWORD');

  if (hasDatabase) {
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  } else {
    fallbackStore.updateUser(user.id, { lastSeenAt: new Date() });
  }

  return user;
}

async function findOrCreateOAuth(provider, providerId, profile) {
  if (!hasDatabase) {
    const email = profile.emails?.[0]?.value?.toLowerCase() || `${providerId}@oauth.whale`;
    const existing = fallbackStore.findUserByEmail(email);
    if (existing) return { user: existing, isNew: false };

    const baseName = (profile.displayName || email.split('@')[0] || 'user').replace(/\s+/g, '_');
    const user = fallbackStore.createUser({
      username: baseName,
      email,
      passwordHash: null,
      emailVerified: true,
      isVerified: true,
    });
    user.avatarUrl = profile.photos?.[0]?.value || null;
    return { user, isNew: true };
  }

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
      emailVerified: true,
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
  authSecurityService.sendVerificationEmail(user.id).catch(() => {});

  return { user, isNew: true };
}

async function getProfile(usernameOrSlug, viewerId) {
  if (!hasDatabase) {
    const profile =
      fallbackStore.findUserByUsername(usernameOrSlug) ||
      Array.from(fallbackStore.listListings().map((listing) => listing.seller)).find(
        (user) => user.slug === usernameOrSlug
      );

    if (!profile) throw new Error('USER_NOT_FOUND');

    const listings = fallbackStore
      .listListings()
      .filter((listing) => listing.sellerId === profile.id && listing.status === 'ACTIVE')
      .slice(0, 12);

    return { ...profile, listings, reviews: [], savedCount: viewerId ? 0 : 0 };
  }

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
  if (!hasDatabase) {
    const user = fallbackStore.findUserById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    if (data.bio !== undefined) user.bio = data.bio;
    if (data.avatarUrl) user.avatarUrl = data.avatarUrl;
    if (data.displayName) user.sellerProfile.displayName = data.displayName;
    if (data.city !== undefined) user.sellerProfile.city = data.city;
    if (data.whatsapp !== undefined) user.sellerProfile.whatsapp = data.whatsapp;
    if (data.bio !== undefined) user.sellerProfile.bio = data.bio;

    return user;
  }

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

async function findById(userId) {
  if (hasDatabase) {
    return prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: { subscription: true, sellerProfile: true },
    });
  }

  return fallbackStore.findUserById(userId);
}

module.exports = {
  register,
  authenticate,
  findOrCreateOAuth,
  getProfile,
  updateProfile,
  findById,
};
