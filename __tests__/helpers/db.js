const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');

function rand(size = 8) {
  return Math.random().toString(36).slice(2, 2 + size);
}

function skipIfNoDb() {
  if (!global.isDbAvailable || !global.isDbAvailable()) {
    return true;
  }
  return false;
}

async function createTestUser(overrides = {}) {
  if (skipIfNoDb()) throw new Error('DB_NOT_AVAILABLE');
  const plainPassword = overrides.password || 'pass';
  const passwordHash = overrides.passwordHash || await bcrypt.hash(plainPassword, 10);

  const base = {
    username: overrides.username || `test_${rand(10)}`,
    email: overrides.email || `test_${rand(10)}@example.com`,
    passwordHash,
    role: overrides.role || 'MEMBER'
  };

  const data = {
    ...base,
    ...overrides
  };

  delete data.password;

  return prisma.user.create({ data });
}

async function createTestListing(sellerId, overrides = {}) {
  if (skipIfNoDb()) throw new Error('DB_NOT_AVAILABLE');
  return prisma.marketListing.create({
    data: {
      title: overrides.title || 'Test RTX 3060 Ti',
      description: overrides.description || 'Test listing description',
      price: overrides.price ?? 850,
      condition: overrides.condition || 'USED',
      images: overrides.images || [],
      sellerId,
      city: overrides.city || 'Tulkarem',
      status: overrides.status || 'ACTIVE',
      negotiable: overrides.negotiable ?? false,
      tags: overrides.tags || [],
      quantity: overrides.quantity || 1,
      ...overrides
    }
  });
}

async function createTestOrder(listingId, buyerId, sellerId, overrides = {}) {
  if (skipIfNoDb()) throw new Error('DB_NOT_AVAILABLE');
  const order = await prisma.order.create({
    data: {
      orderNumber: overrides.orderNumber || `WH-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      listingId,
      buyerId,
      sellerId,
      quantity: overrides.quantity ?? 1,
      amount: overrides.amount ?? 850,
      paymentMethod: overrides.paymentMethod || 'cod',
      paymentStatus: overrides.paymentStatus || 'pending',
      orderStatus: overrides.orderStatus || 'PENDING',
      ...overrides
    }
  });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      event: 'created',
      actorId: buyerId,
      note: 'Order created in test helper'
    }
  });

  return order;
}

async function cleanTestData() {
  if (skipIfNoDb()) return;
  await prisma.orderEvent.deleteMany({});
  await prisma.sellerReview.deleteMany({});
  await prisma.dispute.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.savedListing.deleteMany({});
  await prisma.marketListing.deleteMany({});
  await prisma.sellerProfile.deleteMany({});
  await prisma.subscription.deleteMany({ where: { user: { username: { startsWith: 'test_' } } } });
  await prisma.payment.deleteMany({ where: { user: { username: { startsWith: 'test_' } } } });
  await prisma.notification.deleteMany({ where: { user: { username: { startsWith: 'test_' } } } });
  await prisma.referralCode.deleteMany({ where: { code: { startsWith: 'TEST' } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'test_' } } });
}

module.exports = {
  createTestUser,
  createTestListing,
  createTestOrder,
  cleanTestData,
  skipIfNoDb
};
