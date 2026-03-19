const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { parseLimit, createCursorResponse } = require('../utils/pagination');

/**
 * Validate password strength.
 * Requirements: min 8 chars, at least 1 uppercase letter, at least 1 number.
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true, message: null };
}

async function registerUser(payload) {
  const username = String(payload.username || '').trim().toLowerCase();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');

  if (!username || !email || !password) {
    throw new Error('username, email, and password are required');
  }

  if (username.length < 3 || username.length > 30) {
    throw new Error('username must be between 3 and 30 characters');
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    throw new Error('username can only contain lowercase letters, numbers, and underscore');
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.message);
  }

  const exists = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }]
    }
  });

  if (exists) {
    throw new Error('username or email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      avatar: payload.avatar || null,
      bio: payload.bio || null,
      pcSpecs: payload.pcSpecs || null,
      role: 'MEMBER'
    },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      bio: true,
      pcSpecs: true,
      role: true,
      reputation: true,
      reputationPoints: true,
      isVerified: true,
      isBanned: true,
      createdAt: true,
      lastSeenAt: true
    }
  });

  return user;
}

async function authenticateUser(identifier, password) {
  const value = String(identifier || '').trim().toLowerCase();
  if (!value || !password) {
    throw new Error('invalid credentials');
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: value }, { username: value }]
    }
  });

  if (!user || user.isBanned) {
    throw new Error('invalid credentials');
  }

  const matched = await bcrypt.compare(password, user.passwordHash);
  if (!matched) {
    throw new Error('invalid credentials');
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    pcSpecs: user.pcSpecs,
    role: user.role,
    reputation: user.reputation,
    reputationPoints: user.reputationPoints,
    isVerified: user.isVerified,
    isBanned: user.isBanned,
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt
  };
}

async function getCurrentUser(userId) {
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      bio: true,
      pcSpecs: true,
      role: true,
      reputation: true,
      reputationPoints: true,
      isVerified: true,
      isBanned: true,
      createdAt: true,
      lastSeenAt: true
    }
  });
}

async function findByUsername(username) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return null;
  return prisma.user.findUnique({ where: { username: normalized } });
}

async function ensureAdminFromEnv() {
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@pcgaming.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_PASSWORD environment variable is required in production');
    }
    // Only allow a default in development/test environments
    // eslint-disable-next-line no-console
    console.warn('[SECURITY] ADMIN_PASSWORD not set — using insecure default. Set ADMIN_PASSWORD in env.');
  }
  const finalPassword = adminPassword || 'PcGaming@2024';

  const passwordHash = await bcrypt.hash(finalPassword, 12);

  return prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
      isBanned: false
    },
    create: {
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
      isBanned: false,
      bio: 'حساب الإدارة | Admin account'
    }
  });
}

async function getUserProfileByUsername(username, viewerId, options = {}) {
  const limit = parseLimit(options.limit, 10, 20);

  const user = await prisma.user.findUnique({
    where: { username: String(username).toLowerCase() },
    select: {
      id: true,
      username: true,
      avatar: true,
      bio: true,
      pcSpecs: true,
      role: true,
      reputation: true,
      createdAt: true,
      _count: {
        select: {
          followers: true,
          following: true,
          posts: true,
          listings: true
        }
      }
    }
  });

  if (!user) {
    return null;
  }

  const [isFollowing, posts, listings] = await Promise.all([
    viewerId
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: user.id
            }
          }
        })
      : null,
    prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
            role: true
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            slug: true
          }
        }
      }
    }),
    prisma.marketplaceListing.findMany({
      where: {
        sellerId: user.id,
        status: 'ACTIVE'
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    })
  ]);

  return {
    ...user,
    isFollowing: Boolean(isFollowing),
    posts,
    listings
  };
}

async function updateMyProfile(userId, data) {
  if (!userId) throw new Error('Authentication required');

  const payload = {
    bio: data.bio,
    pcSpecs: data.pcSpecs || undefined
  };

  if (data.avatar) {
    payload.avatar = data.avatar;
  }

  return prisma.user.update({
    where: { id: userId },
    data: payload,
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      bio: true,
      pcSpecs: true,
      role: true,
      reputation: true,
      reputationPoints: true,
      isVerified: true,
      createdAt: true
    }
  });
}

async function followUser(followerId, followingUsername) {
  const following = await prisma.user.findUnique({
    where: { username: String(followingUsername).toLowerCase() },
    select: { id: true }
  });

  if (!following) throw new Error('User not found');
  if (following.id === followerId) throw new Error('Cannot follow yourself');

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId: following.id
      }
    }
  });

  if (existing) {
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: following.id
        }
      }
    });

    return { following: false };
  }

  await prisma.follow.create({
    data: {
      followerId,
      followingId: following.id
    }
  });

  await prisma.notification.create({
    data: {
      userId: following.id,
      type: 'FOLLOW',
      referenceId: followerId,
      referenceType: 'user'
    }
  });

  return { following: true };
}

async function listUsers(query) {
  const q = String(query || '').trim();
  if (!q) return [];

  return prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { bio: { contains: q, mode: 'insensitive' } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true,
      username: true,
      avatar: true,
      bio: true,
      role: true,
      reputation: true
    }
  });
}

async function getUserRooms(userId, limit = 6) {
  const memberships = await prisma.roomMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: 'desc' },
    take: limit,
    include: {
      room: true
    }
  });

  return memberships.map((item) => item.room);
}

async function getFollowersCount(userId) {
  return prisma.follow.count({ where: { followingId: userId } });
}

module.exports = {
  registerUser,
  authenticateUser,
  getCurrentUser,
  findByUsername,
  ensureAdminFromEnv,
  getUserProfileByUsername,
  updateMyProfile,
  followUser,
  listUsers,
  getUserRooms,
  getFollowersCount,
  createCursorResponse,
  validatePassword
};
