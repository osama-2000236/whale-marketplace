const request = require('supertest');
const app = require('../../../server');
const prisma = require('../../../lib/prisma');
const { createTestUser, createTestListing, cleanTestData } = require('../../helpers/db');
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

async function postWithToken(agent, path, body, tokenPath) {
  const token = await getCsrfToken(agent, tokenPath);
  return agent
    .post(path)
    .set('x-csrf-token', token)
    .type('form')
    .send({ ...body, _csrf: token });
}

describe('Complete purchase flow - COD', () => {
  let seller;
  let buyer;
  let listing;
  let order;
  let sellerAgent;
  let buyerAgent;

  beforeAll(async () => {
    seller = await createTestUser({ username: 'test_int_seller', password: 'pass' });
    buyer = await createTestUser({ username: 'test_int_buyer', password: 'pass' });
    listing = await createTestListing(seller.id, { price: 850, status: 'ACTIVE' });

    sellerAgent = request.agent(app);
    buyerAgent = request.agent(app);

    await login(sellerAgent, 'test_int_seller', 'pass');
    await login(buyerAgent, 'test_int_buyer', 'pass');
  });

  test('Step 1: buyer views listing', async () => {
    const res = await buyerAgent.get(`/whale/listing/${listing.id}`);
    expect(res.status).toBe(200);
  });

  test('Step 2: buyer reaches checkout', async () => {
    const res = await buyerAgent.get(`/whale/listing/${listing.id}/buy`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/checkout|إتمام الطلب/i);
  });

  test('Step 3: buyer places COD order', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/listing/${listing.id}/buy`,
      {
        paymentMethod: 'cod',
        shippingMethod: 'company',
        shippingCompany: 'Flash Delivery',
        buyerName: 'Test Buyer',
        buyerPhone: '0599000000',
        buyerCity: 'Tulkarem',
        buyerAddress: '123 Test Street'
      },
      `/whale/listing/${listing.id}/buy`
    );

    expect([200, 302]).toContain(res.status);

    order = await prisma.order.findFirst({
      where: { buyerId: buyer.id },
      orderBy: { createdAt: 'desc' }
    });

    expect(order).not.toBeNull();
    expect(order.orderStatus).toBe('PENDING');
    expect(order.paymentMethod).toBe('cod');
  });

  test('Step 4: seller receives notification', async () => {
    const notif = await prisma.notification.findFirst({
      where: { userId: seller.id },
      orderBy: { createdAt: 'desc' }
    });
    expect(notif.message).toContain(order.orderNumber);
  });

  test('Step 5: seller confirms order', async () => {
    const res = await postWithToken(
      sellerAgent,
      `/whale/orders/${order.id}/confirm`,
      {},
      `/whale/orders/${order.id}`
    );

    expect([200, 302]).toContain(res.status);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.orderStatus).toBe('SELLER_CONFIRMED');
  });

  test('Step 6: seller ships with tracking', async () => {
    const res = await postWithToken(
      sellerAgent,
      `/whale/orders/${order.id}/ship`,
      {
        trackingNumber: 'FD-2025-88741',
        shippingCompany: 'Flash Delivery',
        estimatedDelivery: new Date(Date.now() + 86400000).toISOString()
      },
      `/whale/orders/${order.id}`
    );

    expect([200, 302]).toContain(res.status);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.orderStatus).toBe('SHIPPED');
    expect(updated.trackingNumber).toBe('FD-2025-88741');
  });

  test('Step 7: buyer confirms delivery', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/orders/${order.id}/confirm-delivery`,
      {},
      `/whale/orders/${order.id}`
    );

    expect([200, 302]).toContain(res.status);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.orderStatus).toBe('COMPLETED');
    expect(updated.paymentStatus).toBe('released');
    expect(updated.confirmedAt).not.toBeNull();
  });

  test('Step 8: seller stats updated', async () => {
    const profile = await prisma.sellerProfile.findUnique({ where: { userId: seller.id } });
    expect(profile.totalSales).toBeGreaterThan(0);
    expect(profile.totalRevenue).toBeGreaterThan(0);
  });

  test('Step 9: buyer leaves review', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/orders/${order.id}/review`,
      { rating: '5', title: 'Excellent', body: 'Item as described' },
      `/whale/orders/${order.id}`
    );

    expect([200, 302]).toContain(res.status);

    const review = await prisma.sellerReview.findFirst({ where: { orderId: order.id } });
    expect(review.rating).toBe(5);
    expect(review.isVerified).toBe(true);
  });

  test('Step 10: cannot review twice', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/orders/${order.id}/review`,
      { rating: '4', title: 'Second', body: 'Should fail' },
      `/whale/orders/${order.id}`
    );

    expect([400, 302]).toContain(res.status);
  });
});

describe('Order cancellation flow', () => {
  let seller;
  let buyer;
  let listing;
  let order;
  let sellerAgent;
  let buyerAgent;

  beforeAll(async () => {
    seller = await createTestUser({ username: 'test_cancel_seller', password: 'pass' });
    buyer = await createTestUser({ username: 'test_cancel_buyer', password: 'pass' });
    listing = await createTestListing(seller.id);

    sellerAgent = request.agent(app);
    buyerAgent = request.agent(app);

    await login(sellerAgent, 'test_cancel_seller', 'pass');
    await login(buyerAgent, 'test_cancel_buyer', 'pass');

    order = await prisma.order.create({
      data: {
        orderNumber: `WH-TEST-CANCEL-${Date.now()}`,
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        quantity: 1,
        amount: 850,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        orderStatus: 'PENDING'
      }
    });
  });

  test('buyer can cancel pending order', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/orders/${order.id}/cancel`,
      { reason: 'Changed my mind' },
      `/whale/orders/${order.id}`
    );

    expect([200, 302]).toContain(res.status);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.orderStatus).toBe('CANCELLED');
  });

  test('cannot cancel already cancelled order', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/orders/${order.id}/cancel`,
      { reason: 'Again' },
      `/whale/orders/${order.id}`
    );

    expect([400, 302]).toContain(res.status);
  });

  test('stranger cannot cancel others order', async () => {
    const stranger = await createTestUser({ username: 'test_stranger_cancel', password: 'pass' });
    const strangerAgent = request.agent(app);
    await login(strangerAgent, 'test_stranger_cancel', 'pass');

    const res = await postWithToken(
      strangerAgent,
      `/whale/orders/${order.id}/cancel`,
      { reason: 'Unauthorized' },
      `/whale/orders/${order.id}`
    );

    expect([400, 403, 302]).toContain(res.status);
  });
});
