const prisma = require('../lib/prisma');
const { MemoryCache } = require('../utils/cache');

// Cache notifications for 30 seconds — prevents 2 DB hits per page load per user
const notifCache = new MemoryCache({ ttlMs: 30_000, maxSize: 200 });

async function getNotifications(userId, limit = 20) {
  return notifCache.getOrSet(`notif:${userId}:${limit}`, () =>
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 20
    })
  );
}

async function getUnreadCount(userId) {
  return notifCache.getOrSet(`unread:${userId}`, () =>
    prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    })
  );
}

async function markAllRead(userId) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: {
      isRead: true
    }
  });

  // Invalidate cache after marking read
  notifCache.invalidatePrefix(`notif:${userId}`);
  notifCache.invalidatePrefix(`unread:${userId}`);

  return result;
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllRead
};
