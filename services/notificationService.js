const prisma = require('../lib/prisma');
const { MemoryCache } = require('../utils/cache');

const cache = new MemoryCache({ ttl: 30000, maxSize: 200 });

async function getNotifications(userId, limit = 20) {
  return cache.getOrSet(`notif:${userId}:${limit}`, () =>
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  );
}

async function getUnreadCount(userId) {
  return cache.getOrSet(`unread:${userId}`, () =>
    prisma.notification.count({ where: { userId, isRead: false } })
  );
}

async function markAllRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  cache.invalidatePrefix(`notif:${userId}`);
  cache.invalidatePrefix(`unread:${userId}`);
}

module.exports = { getNotifications, getUnreadCount, markAllRead };
