const prisma = require('../lib/prisma');

/**
 * Log an admin action
 */
async function log({ adminId, action, target, targetId, details, ip }) {
  return prisma.adminAuditLog.create({
    data: { adminId, action, target, targetId, details, ip },
  });
}

/**
 * Get audit logs with pagination
 */
async function getLogs({ adminId, action, limit = 50, cursor } = {}) {
  const where = {};
  if (adminId) where.adminId = adminId;
  if (action) where.action = action;

  const query = {
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: { admin: { select: { username: true, email: true } } },
  };

  if (cursor) {
    query.cursor = { id: cursor };
    query.skip = 1;
  }

  const logs = await prisma.adminAuditLog.findMany(query);
  const hasMore = logs.length > limit;
  if (hasMore) logs.pop();

  return {
    logs,
    nextCursor: hasMore ? logs[logs.length - 1].id : null,
  };
}

/**
 * Manage coupons
 */
async function createCoupon(data) {
  return prisma.coupon.create({
    data: {
      code: data.code.toUpperCase(),
      discountType: data.discountType || 'percent',
      discountValue: data.discountValue,
      minOrderAmount: data.minOrderAmount || null,
      maxUses: data.maxUses || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
}

async function getCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
}

async function toggleCoupon(id) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new Error('COUPON_NOT_FOUND');
  return prisma.coupon.update({
    where: { id },
    data: { isActive: !coupon.isActive },
  });
}

/**
 * Manage refund requests
 */
async function getRefundRequests(status) {
  const where = status ? { status } : {};
  return prisma.refundRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      order: { include: { listing: { select: { title: true } } } },
      user: { select: { username: true, email: true } },
    },
  });
}

async function processRefund(refundId, adminId, { status, adminNote }) {
  const refund = await prisma.refundRequest.findUnique({ where: { id: refundId } });
  if (!refund) throw new Error('REFUND_NOT_FOUND');
  if (refund.status !== 'REQUESTED') throw new Error('REFUND_ALREADY_PROCESSED');

  return prisma.refundRequest.update({
    where: { id: refundId },
    data: { status, adminNote },
  });
}

module.exports = {
  log,
  getLogs,
  createCoupon,
  getCoupons,
  toggleCoupon,
  getRefundRequests,
  processRefund,
};
