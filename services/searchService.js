const prisma = require('../lib/prisma');

async function globalSearch({ q, type, limit = 20 }) {
  if (!q || q.trim().length < 2) return { listings: [], threads: [], users: [] };

  const search = q.trim();
  const take = Math.min(limit, 50);
  const results = {};

  if (!type || type === 'listings') {
    results.listings = await prisma.marketListing.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { titleAr: { contains: search, mode: 'insensitive' } },
          { tags: { has: search.toLowerCase() } },
        ],
      },
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { id: true, username: true, avatar: true } },
        category: true,
      },
    });
  }

  if (!type || type === 'threads') {
    results.threads = await prisma.forumThread.findMany({
      where: {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { body: { contains: search, mode: 'insensitive' } },
        ],
      },
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        category: true,
      },
    });
  }

  if (!type || type === 'users') {
    results.users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { bio: { contains: search, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: { id: true, username: true, avatar: true, bio: true, isVerified: true },
    });
  }

  return results;
}

module.exports = { globalSearch };
