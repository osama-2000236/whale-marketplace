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

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeOptionalText(value) {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizePhone(value) {
  if (value === undefined) return undefined;
  const compact = String(value || '')
    .trim()
    .replace(/[\s()-]+/g, '');
  if (!compact) return null;
  if (!/^\+?[0-9]{7,20}$/.test(compact)) throw new Error('INVALID_WHATSAPP');
  return compact;
}

function validateUsername(username) {
  if (!username || username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error('INVALID_USERNAME');
  }
}

function validateEmail(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('INVALID_EMAIL');
  }
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    throw new Error('WEAK_PASSWORD');
  }
}

function validateDisplayName(displayName) {
  if (displayName === undefined) return;
  const value = String(displayName || '').trim();
  if (!value || value.length < 2 || value.length > 100) {
    throw new Error('INVALID_DISPLAY_NAME');
  }
}

function validateCity(city) {
  if (city === undefined) return;
  const value = String(city || '').trim();
  if (value.length > 100) {
    throw new Error('INVALID_CITY');
  }
}

function validateBio(bio) {
  if (bio === undefined) return;
  const value = String(bio || '').trim();
  if (value.length > 500) {
    throw new Error('INVALID_BIO');
  }
}

async function findExistingUserByIdentity(username, email, excludeUserId) {
  if (hasDatabase) {
    const where = {
      OR: [{ username }, { email }, { pendingEmail: email }],
    };
    if (excludeUserId) where.NOT = { id: excludeUserId };
    return prisma.user.findFirst({ where });
  }

  const byUsername = fallbackStore.findUserByUsername(username);
  if (byUsername && byUsername.id !== excludeUserId) return byUsername;

  const byEmail = fallbackStore.findUserByEmail(email);
  if (byEmail && byEmail.id !== excludeUserId) return byEmail;

  return null;
}

async function ensureUniqueUserSlug(baseValue, excludeUserId) {
  let baseSlug = slugify(baseValue, { lower: true, strict: true });
  if (!baseSlug) {
    baseSlug = `user-${Date.now()}`;
  }

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    if (!hasDatabase) {
      const existing = fallbackStore.findUserByUsername(slug) || fallbackStore.findUserByIdentifier(slug);
      if (!existing || existing.id === excludeUserId) return slug;
    } else {
      const existing = await prisma.user.findFirst({
        where: {
          slug,
          ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return slug;
    }
    slug = `${baseSlug.slice(0, 24)}-${counter++}`;
  }
}

async function getUserForAccountChanges(userId) {
  if (hasDatabase) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true, sellerProfile: true, addresses: true },
    });
  }
  return fallbackStore.findUserById(userId);
}

async function ensurePasswordCapableUser(user, currentPassword, { sendSetupEmail = false } = {}) {
  if (!user || user.deletedAt) throw new Error('USER_NOT_FOUND');
  if (user.isBanned) throw new Error('USER_BANNED');

  if (!user.passwordHash) {
    if (sendSetupEmail) {
      await authSecurityService.sendPasswordReset(user.email);
    }
    throw new Error('PASSWORD_SETUP_REQUIRED');
  }

  if (!currentPassword) throw new Error('CURRENT_PASSWORD_REQUIRED');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error('CURRENT_PASSWORD_INVALID');
}

function normalizeAddressInput(data) {
  const label = String(data.label || 'home').trim().slice(0, 50) || 'home';
  const street = String(data.street || '').trim();
  const city = String(data.city || '').trim();
  const phone = normalizePhone(data.phone);
  const isDefault = data.isDefault === true || data.isDefault === 'true' || data.isDefault === 'on';

  if (!street || street.length > 200) throw new Error('INVALID_STREET');
  if (!city || city.length > 100) throw new Error('INVALID_CITY');
  if (!phone) throw new Error('INVALID_PHONE');

  return { label, street, city, phone, isDefault };
}

async function register({ username, email, password, confirmPassword }) {
  validateUsername(username);
  validateEmail(email);
  validatePassword(password);
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new Error('PASSWORD_MISMATCH');
  }

  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findExistingUserByIdentity(normalizedUsername, normalizedEmail);

  if (existingUser) {
    if (existingUser.email === normalizedEmail || existingUser.pendingEmail === normalizedEmail) {
      throw new Error('EMAIL_TAKEN');
    }
    throw new Error('USERNAME_TAKEN');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const slug = await ensureUniqueUserSlug(normalizedUsername);
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
          create: { displayName: username.trim(), isVerified: shouldAutoVerifyUsers },
        },
      },
      include: { subscription: true, sellerProfile: true },
    });
  } else {
    user = fallbackStore.createUser({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      emailVerified: shouldAutoVerifyUsers,
      isVerified: shouldAutoVerifyUsers,
    });
    user.slug = slug;
    user.subscription.plan = 'free';
    user.subscription.trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.sellerProfile.displayName = username.trim();
    user.sellerProfile.isVerified = shouldAutoVerifyUsers;
  }

  emailService.sendWelcome(user).catch(() => {});
  if (!shouldAutoVerifyUsers) {
    authSecurityService.sendVerificationEmail(user.id).catch(() => {});
  }

  return user;
}

async function authenticate(identifier, password) {
  const normalizedIdentifier = normalizeEmail(identifier);
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
  if (user.deletedAt) throw new Error('USER_NOT_FOUND');
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
  const email = normalizeEmail(profile.emails?.[0]?.value);
  if (!email) throw new Error('OAUTH_EMAIL_REQUIRED');

  if (!hasDatabase) {
    const existing = fallbackStore.findUserByEmail(email);
    if (existing) {
      if (existing.isBanned) throw new Error('USER_BANNED');
      existing.emailVerified = true;
      existing.isVerified = true;
      existing.avatarUrl = profile.photos?.[0]?.value || existing.avatarUrl;
      existing[`${provider}Id`] = providerId;
      return { user: existing, isNew: false };
    }

    const baseName = (profile.displayName || email.split('@')[0] || 'user')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 30);
    const finalUsername = baseName || `user_${Date.now()}`;
    const user = fallbackStore.createUser({
      username: finalUsername,
      email,
      passwordHash: null,
      emailVerified: true,
      isVerified: true,
    });
    user.avatarUrl = profile.photos?.[0]?.value || null;
    user[`${provider}Id`] = providerId;
    return { user, isNew: true };
  }

  const idField = `${provider}Id`;
  let user = await prisma.user.findUnique({
    where: { [idField]: providerId },
    include: { subscription: true, sellerProfile: true },
  });

  if (user) {
    if (user.isBanned) throw new Error('USER_BANNED');
    user = await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
      include: { subscription: true, sellerProfile: true },
    });
    return { user, isNew: false };
  }

  user = await prisma.user.findUnique({
    where: { email },
    include: { subscription: true, sellerProfile: true },
  });

  if (user) {
    if (user.isBanned) throw new Error('USER_BANNED');
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        [idField]: providerId,
        avatarUrl: profile.photos?.[0]?.value || user.avatarUrl,
        emailVerified: true,
        isVerified: true,
        lastSeenAt: new Date(),
        pendingEmail: null,
      },
      include: { subscription: true, sellerProfile: true },
    });

    if (user.sellerProfile && !user.sellerProfile.isVerified) {
      await prisma.sellerProfile.update({
        where: { userId: user.id },
        data: { isVerified: true },
      });
      user.sellerProfile.isVerified = true;
    }

    return { user, isNew: false };
  }

  let username =
    (profile.displayName || email.split('@')[0] || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 30) || `user_${Date.now()}`;

  let finalUsername = username;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { username: finalUsername } })) {
    finalUsername = `${username.slice(0, 25)}_${counter++}`;
  }

  const slug = await ensureUniqueUserSlug(finalUsername);

  user = await prisma.user.create({
    data: {
      username: finalUsername,
      slug,
      email,
      [idField]: providerId,
      avatarUrl: profile.photos?.[0]?.value || null,
      emailVerified: true,
      isVerified: true,
      subscription: {
        create: { plan: 'free', trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      sellerProfile: {
        create: { displayName: profile.displayName || finalUsername, isVerified: true },
      },
    },
    include: { subscription: true, sellerProfile: true },
  });

  emailService.sendWelcome(user).catch(() => {});
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

async function getAccountProfile(userId) {
  if (!hasDatabase) {
    const user = fallbackStore.findUserById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    return { ...user, addresses: user.addresses || [] };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      sellerProfile: true,
      addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
    },
  });

  if (!user || user.deletedAt) throw new Error('USER_NOT_FOUND');
  return user;
}

async function updateProfile(userId, data) {
  validateDisplayName(data.displayName);
  validateBio(data.bio);
  validateCity(data.city);

  const user = await getUserForAccountChanges(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  const bio = normalizeOptionalText(data.bio);
  const displayName = data.displayName === undefined ? undefined : String(data.displayName).trim();
  const city = normalizeOptionalText(data.city);
  const whatsapp = normalizePhone(data.whatsapp);
  const avatarUrl = normalizeOptionalText(data.avatarUrl);

  if (!hasDatabase) {
    if (bio !== undefined) user.bio = bio;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (displayName !== undefined) user.sellerProfile.displayName = displayName;
    if (city !== undefined) user.sellerProfile.city = city;
    if (whatsapp !== undefined) user.sellerProfile.whatsapp = whatsapp;
    if (bio !== undefined) user.sellerProfile.bio = bio;
    return user;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
    });

    await tx.sellerProfile.update({
      where: { userId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(whatsapp !== undefined ? { whatsapp } : {}),
        ...(bio !== undefined ? { bio } : {}),
      },
    });
  });

  return getAccountProfile(userId);
}

async function changeUsername(userId, { currentPassword, username }) {
  validateUsername(username);

  const user = await getUserForAccountChanges(userId);
  await ensurePasswordCapableUser(user, currentPassword, { sendSetupEmail: true });

  const normalizedUsername = normalizeUsername(username);
  if (normalizedUsername === user.username) throw new Error('USERNAME_UNCHANGED');

  const existingUser = await findExistingUserByIdentity(normalizedUsername, user.email, userId);
  if (existingUser && existingUser.username === normalizedUsername) {
    throw new Error('USERNAME_TAKEN');
  }

  const slug = await ensureUniqueUserSlug(normalizedUsername, userId);

  if (!hasDatabase) {
    fallbackStore.updateUser(userId, { username: normalizedUsername, slug });
    return fallbackStore.findUserById(userId);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { username: normalizedUsername, slug },
  });

  return getAccountProfile(userId);
}

async function requestEmailChange(userId, { currentPassword, email }) {
  validateEmail(email);

  const user = await getUserForAccountChanges(userId);
  await ensurePasswordCapableUser(user, currentPassword, { sendSetupEmail: true });

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail === user.email) throw new Error('EMAIL_UNCHANGED');

  const existingUser = await findExistingUserByIdentity(user.username, normalizedEmail, userId);
  if (existingUser && (existingUser.email === normalizedEmail || existingUser.pendingEmail === normalizedEmail)) {
    throw new Error('EMAIL_TAKEN');
  }

  return authSecurityService.sendEmailChangeVerification(userId, normalizedEmail);
}

async function changePassword(userId, { currentPassword, newPassword, confirmPassword }) {
  validatePassword(newPassword);
  if (newPassword !== confirmPassword) throw new Error('PASSWORD_MISMATCH');

  const user = await getUserForAccountChanges(userId);
  await ensurePasswordCapableUser(user, currentPassword, { sendSetupEmail: true });

  const sameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsCurrent) throw new Error('PASSWORD_UNCHANGED');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  if (!hasDatabase) {
    fallbackStore.updateUser(userId, { passwordHash });
    return { success: true };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { success: true };
}

async function createAddress(userId, data) {
  const payload = normalizeAddressInput(data);

  if (!hasDatabase) {
    const user = fallbackStore.findUserById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    user.addresses = user.addresses || [];
    if (payload.isDefault) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }
    const address = {
      id: `address-${Date.now()}`,
      userId,
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    user.addresses.unshift(address);
    return address;
  }

  return prisma.$transaction(async (tx) => {
    if (payload.isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.address.create({
      data: {
        userId,
        label: payload.label,
        street: payload.street,
        city: payload.city,
        phone: payload.phone,
        isDefault: payload.isDefault,
      },
    });
  });
}

async function updateAddress(userId, addressId, data) {
  const payload = normalizeAddressInput(data);

  if (!hasDatabase) {
    const user = fallbackStore.findUserById(userId);
    const address = user?.addresses?.find((item) => item.id === addressId);
    if (!address) throw new Error('ADDRESS_NOT_FOUND');
    if (payload.isDefault) {
      user.addresses.forEach((item) => {
        item.isDefault = false;
      });
    }
    Object.assign(address, payload, { updatedAt: new Date() });
    return address;
  }

  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new Error('ADDRESS_NOT_FOUND');

    if (payload.isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }

    return tx.address.update({
      where: { id: addressId },
      data: payload,
    });
  });
}

async function deleteAddress(userId, addressId) {
  if (!hasDatabase) {
    const user = fallbackStore.findUserById(userId);
    if (!user?.addresses) throw new Error('ADDRESS_NOT_FOUND');
    const before = user.addresses.length;
    user.addresses = user.addresses.filter((address) => address.id !== addressId);
    if (user.addresses.length === before) throw new Error('ADDRESS_NOT_FOUND');
    if (user.addresses.length > 0 && !user.addresses.some((address) => address.isDefault)) {
      user.addresses[0].isDefault = true;
    }
    return { deleted: true };
  }

  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new Error('ADDRESS_NOT_FOUND');

    await tx.address.delete({ where: { id: addressId } });

    if (address.isDefault) {
      const replacement = await tx.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (replacement) {
        await tx.address.update({
          where: { id: replacement.id },
          data: { isDefault: true },
        });
      }
    }

    return { deleted: true };
  });
}

async function listAddresses(userId) {
  if (!hasDatabase) {
    return fallbackStore.findUserById(userId)?.addresses || [];
  }

  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

async function findSessionUser(userId) {
  if (hasDatabase) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true, sellerProfile: true },
    });
  }

  return fallbackStore.findUserById(userId);
}

async function findById(userId) {
  const user = await findSessionUser(userId);
  if (!user || user.deletedAt) return null;
  return user;
}

module.exports = {
  register,
  authenticate,
  findOrCreateOAuth,
  getProfile,
  getAccountProfile,
  updateProfile,
  changeUsername,
  requestEmailChange,
  changePassword,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  findById,
  findSessionUser,
};
