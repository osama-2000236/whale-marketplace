const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function registerUser({ username, email, password, avatar, bio, pcSpecs }) {
  if (!username || username.length < 3 || username.length > 30) {
    throw new Error('Username must be 3-30 characters');
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    throw new Error('Username can only contain lowercase letters, numbers, and underscores');
  }
  if (!email) throw new Error('Email is required');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: normalizedEmail }] },
  });
  if (existing) {
    if (existing.username === username) throw new Error('Username already taken');
    throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      username,
      email: normalizedEmail,
      passwordHash,
      avatar: avatar || null,
      bio: bio || null,
      pcSpecs: pcSpecs || null,
    },
  });

  const { passwordHash: _, ...safe } = user;
  return safe;
}

async function authenticateUser(identifier, password) {
  if (!identifier || !password) throw new Error('Email/username and password are required');

  const normalized = identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: normalized }, { username: normalized }] },
  });

  if (!user) throw new Error('Invalid credentials');
  if (user.isBanned) throw new Error('Account is banned');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');

  const { passwordHash: _, ...safe } = user;
  return safe;
}

async function getCurrentUser(userId) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, username: true, email: true, avatar: true, bio: true,
      pcSpecs: true, role: true, reputation: true, reputationPoints: true,
      isVerified: true, isBanned: true, createdAt: true, lastSeenAt: true,
    },
  });
  return user;
}

async function findByUsername(username) {
  return prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
  });
}

async function ensureAdminFromEnv() {
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !email || !password) return;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email },
    create: { username, email, passwordHash, role: 'ADMIN', isVerified: true },
    update: { passwordHash, role: 'ADMIN' },
  });
}

async function getUserProfileByUsername(username, viewerId, options = {}) {
  const limit = Math.min(options.limit || 10, 20);
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: {
      id: true, username: true, email: true, avatar: true, bio: true,
      pcSpecs: true, role: true, reputation: true, reputationPoints: true,
      isVerified: true, createdAt: true, lastSeenAt: true,
      _count: { select: { followers: true, following: true, posts: true, sellerListings: true } },
    },
  });
  if (!user) return null;

  let isFollowing = false;
  if (viewerId && viewerId !== user.id) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
    });
    isFollowing = Boolean(follow);
  }

  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      author: { select: { id: true, username: true, avatar: true } },
      room: { select: { id: true, name: true, nameAr: true, slug: true } },
      _count: { select: { comments: true } },
    },
  });

  const listings = await prisma.marketListing.findMany({
    where: { sellerId: user.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { category: true },
  });

  return {
    ...user,
    followersCount: user._count.followers,
    followingCount: user._count.following,
    postsCount: user._count.posts,
    listingsCount: user._count.sellerListings,
    isFollowing,
    posts,
    listings,
  };
}

async function updateMyProfile(userId, data) {
  const updateData = {};
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;
  if (data.pcSpecs !== undefined) updateData.pcSpecs = data.pcSpecs;

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true, username: true, email: true, avatar: true, bio: true,
      pcSpecs: true, role: true, isVerified: true,
    },
  });
}

async function followUser(followerId, followingUsername) {
  const target = await prisma.user.findFirst({
    where: { username: { equals: followingUsername, mode: 'insensitive' } },
  });
  if (!target) throw new Error('User not found');
  if (target.id === followerId) throw new Error('Cannot follow yourself');

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: target.id } },
  });

  if (existing) {
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId: target.id } },
    });
    return { following: false };
  }

  await prisma.follow.create({ data: { followerId, followingId: target.id } });
  await prisma.notification.create({
    data: {
      userId: target.id,
      type: 'FOLLOW',
      message: `${(await prisma.user.findUnique({ where: { id: followerId }, select: { username: true } })).username} started following you`,
      referenceId: followerId,
      referenceType: 'user',
    },
  }).catch(() => {});

  return { following: true };
}

async function listUsers(query) {
  if (!query) return [];
  return prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: 'insensitive' } },
        { bio: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, username: true, avatar: true, bio: true, isVerified: true },
    take: 15,
  });
}

async function getUserRooms(userId, limit = 6) {
  const memberships = await prisma.roomMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: 'desc' },
    take: limit,
    include: { room: true },
  });
  return memberships.map((m) => m.room);
}

async function getFollowersCount(userId) {
  return prisma.follow.count({ where: { followingId: userId } });
}

module.exports = {
  registerUser, authenticateUser, getCurrentUser, findByUsername,
  ensureAdminFromEnv, getUserProfileByUsername, updateMyProfile,
  followUser, listUsers, getUserRooms, getFollowersCount,
};
