const request = require('supertest');
const prisma = require('../../../lib/prisma');
const svc = require('../../../services/whaleService');
const app = require('../../../server');
const { createTestUser, createTestListing, createTestOrder, cleanTestData } = require('../../helpers/db');
const { getCsrfToken } = require('../../helpers/http');

afterAll(async () => {
  await cleanTestData();
});

async function login(agent, identifier, password) {
  const token = await getCsrfToken(agent, '/auth/login');
  return agent
    .post('/auth/login')
    .set('x-csrf-token', token)
    .type('form')
    .send({ identifier, password, _csrf: token });
}

describe('Order edge cases', () => {
  let seller;
  let buyer;
  let listing;

  beforeAll(async () => {
    seller = await createTestUser({ username: 'test_edge_seller', password: 'pass' });
    buyer = await createTestUser({ username: 'test_edge_buyer', password: 'pass' });
    listing = await createTestListing(seller.id);
  });

  test('order number format starts with WH-year', async () => {
    const order = await svc.createOrder({
      listingId: listing.id,
      buyerId: buyer.id,
      quantity: 1,
      paymentMethod: 'cod',
      shippingMethod: 'company',
      shippingAddress: { name: 'T', phone: '0599000000', city: 'Tulkarem', address: 'St' }
    });

    expect(order.orderNumber).toMatch(/^WH-\d{4}-\d{5,}$/);
  });

  test('seller cannot confirm already confirmed order', async () => {
    const order = await createTestOrder(listing.id, buyer.id, seller.id, { orderStatus: 'SELLER_CONFIRMED' });
    await expect(svc.sellerConfirmOrder(order.id, seller.id)).rejects.toThrow('Invalid state');
  });

  test('seller cannot confirm completed order', async () => {
    const order = await createTestOrder(listing.id, buyer.id, seller.id, { orderStatus: 'COMPLETED' });
    await expect(svc.sellerConfirmOrder(order.id, seller.id)).rejects.toThrow('Invalid state');
  });

  test('buyer cannot confirm pending order', async () => {
    const order = await createTestOrder(listing.id, buyer.id, seller.id, { orderStatus: 'PENDING' });
    await expect(svc.buyerConfirmDelivery(order.id, buyer.id)).rejects.toThrow('Invalid state');
  });

  test('cancelled order cannot be shipped', async () => {
    const order = await createTestOrder(listing.id, buyer.id, seller.id, { orderStatus: 'CANCELLED' });
    await expect(svc.sellerShipOrder(order.id, seller.id, {
      trackingNumber: '123',
      shippingCompany: 'Flash'
    })).rejects.toThrow();
  });

  test('total revenue accumulates with multiple completions', async () => {
    const l1 = await createTestListing(seller.id, { price: 500 });
    const l2 = await createTestListing(seller.id, { price: 300 });

    const o1 = await createTestOrder(l1.id, buyer.id, seller.id, { amount: 500, orderStatus: 'SHIPPED' });
    const o2 = await createTestOrder(l2.id, buyer.id, seller.id, { amount: 300, orderStatus: 'SHIPPED' });

    await svc.buyerConfirmDelivery(o1.id, buyer.id);
    await svc.buyerConfirmDelivery(o2.id, buyer.id);

    const profile = await prisma.sellerProfile.findUnique({ where: { userId: seller.id } });
    expect(profile.totalRevenue).toBeGreaterThanOrEqual(800);
  });

  test('average rating recalculates', async () => {
    const l1 = await createTestListing(seller.id);
    const l2 = await createTestListing(seller.id);
    const b2 = await createTestUser({ username: 'test_rater_2', password: 'pass' });
    const b3 = await createTestUser({ username: 'test_rater_3', password: 'pass' });

    const o1 = await createTestOrder(l1.id, b2.id, seller.id, { orderStatus: 'COMPLETED', paymentStatus: 'released' });
    const o2 = await createTestOrder(l2.id, b3.id, seller.id, { orderStatus: 'COMPLETED', paymentStatus: 'released' });

    await svc.createReview(o1.id, b2.id, { rating: 4, title: 'Good', body: 'OK' });
    await svc.createReview(o2.id, b3.id, { rating: 2, title: 'Bad', body: 'Slow' });

    const profile = await prisma.sellerProfile.findUnique({ where: { userId: seller.id } });
    expect(profile.averageRating).toBeGreaterThan(0);
    expect(profile.averageRating).toBeLessThanOrEqual(5);
  });
});

describe('Subscription edge cases', () => {
  test('expired trial blocks pro route', async () => {
    const expiredUser = await createTestUser({ username: 'test_expired_trial', password: 'pass' });

    await prisma.subscription.upsert({
      where: { userId: expiredUser.id },
      create: {
        userId: expiredUser.id,
        plan: 'pro',
        trialEndsAt: new Date(Date.now() - 86400000)
      },
      update: {
        plan: 'pro',
        trialEndsAt: new Date(Date.now() - 86400000),
        paidUntil: null
      }
    });

    const agent = request.agent(app);
    await login(agent, 'test_expired_trial', 'pass');

    const res = await agent.get('/whale/sell');
    expect([302, 403]).toContain(res.status);
    if (res.status === 302) {
      expect(res.headers.location).toMatch(/upgrade/i);
    }
  });

  test('active paidUntil allows pro access', async () => {
    const paidUser = await createTestUser({ username: 'test_paid_user', password: 'pass' });

    await prisma.subscription.upsert({
      where: { userId: paidUser.id },
      create: {
        userId: paidUser.id,
        plan: 'pro',
        paidUntil: new Date(Date.now() + 86400000 * 30)
      },
      update: {
        plan: 'pro',
        paidUntil: new Date(Date.now() + 86400000 * 30)
      }
    });

    const agent = request.agent(app);
    await login(agent, 'test_paid_user', 'pass');

    const res = await agent.get('/whale/sell');
    expect(res.status).toBe(200);
  });
});
