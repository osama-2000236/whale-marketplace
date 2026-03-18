const prisma = require('../lib/prisma');

async function getNotifications(userId, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Number(limit) || 20
  });
}

async function getUnreadCount(userId) {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false
    }
  });
}

async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: {
      isRead: true
    }
  });
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllRead
};
