const request = require('supertest');
const app = require('../../../server');
const prisma = require('../../../lib/prisma');
const {
  createTestUser,
  createTestListing,
  createTestOrder,
  cleanTestData
} = require('../../helpers/db');
const { getCsrfToken } = require('../../helpers/http');

async function loginAgent(agent, identifier, password) {
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

describe('Whale extra component coverage', () => {
  let seller;
  let buyer;
  let stranger;
  let listing;
  let order;
  let sellerAgent;
  let buyerAgent;
  let strangerAgent;

  beforeAll(async () => {
    await cleanTestData();

    seller = await createTestUser({ username: 'test_whale_extra_seller', password: 'pass' });
    buyer = await createTestUser({ username: 'test_whale_extra_buyer', password: 'pass' });
    stranger = await createTestUser({ username: 'test_whale_extra_stranger', password: 'pass' });

    await prisma.subscription.upsert({
      where: { userId: seller.id },
      create: { userId: seller.id, plan: 'pro', paidUntil: new Date(Date.now() + 7 * 86400000) },
      update: { plan: 'pro', paidUntil: new Date(Date.now() + 7 * 86400000) }
    });
    await prisma.subscription.upsert({
      where: { userId: buyer.id },
      create: { userId: buyer.id, plan: 'pro', paidUntil: new Date(Date.now() + 7 * 86400000) },
      update: { plan: 'pro', paidUntil: new Date(Date.now() + 7 * 86400000) }
    });

    listing = await createTestListing(seller.id, {
      title: 'Extra route listing',
      price: 500,
      quantity: 5,
      city: 'Tulkarem'
    });

    order = await createTestOrder(listing.id, buyer.id, seller.id, {
      orderStatus: 'PENDING',
      paymentStatus: 'pending'
    });

    sellerAgent = request.agent(app);
    buyerAgent = request.agent(app);
    strangerAgent = request.agent(app);

    await loginAgent(sellerAgent, seller.username, 'pass');
    await loginAgent(buyerAgent, buyer.username, 'pass');
    await loginAgent(strangerAgent, stranger.username, 'pass');
  });

  afterAll(async () => {
    await cleanTestData();
  });

  test('POST /whale/listing/:id/wa-click increments click counter', async () => {
    const before = await prisma.marketListing.findUnique({ where: { id: listing.id } });
    const guestAgent = request.agent(app);
    const res = await postWithToken(
      guestAgent,
      `/whale/listing/${listing.id}/wa-click`,
      {},
      `/whale/listing/${listing.id}`
    );

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const after = await prisma.marketListing.findUnique({ where: { id: listing.id } });
    expect(after.waClicks).toBe((before?.waClicks || 0) + 1);
  });

  test('POST /whale/listing/:id/save returns 400 for invalid listing id', async () => {
    const res = await postWithToken(
      buyerAgent,
      '/whale/listing/00000000-0000-0000-0000-000000000000/save',
      {},
      `/whale/listing/${listing.id}`
    );

    expect(res.status).toBe(400);
  });

  test('GET /whale/listing/:id/buy returns 404 for missing listing', async () => {
    const res = await buyerAgent.get('/whale/listing/00000000-0000-0000-0000-000000000000/buy');
    expect(res.status).toBe(404);
  });

  test('GET /whale/listing/:id/buy redirects seller away from own checkout', async () => {
    const res = await sellerAgent.get(`/whale/listing/${listing.id}/buy`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/whale/listing/${listing.id}`);
  });

  test('GET /whale/listing/:id/edit allows owner and blocks other users', async () => {
    const owner = await sellerAgent.get(`/whale/listing/${listing.id}/edit`);
    expect(owner.status).toBe(200);

    const nonOwner = await buyerAgent.get(`/whale/listing/${listing.id}/edit`);
    expect(nonOwner.status).toBe(403);
  });

  test('POST /whale/listing/:id/edit updates listing for owner', async () => {
    const res = await postWithToken(
      sellerAgent,
      `/whale/listing/${listing.id}/edit`,
      {
        title: 'Edited route title',
        description: 'Edited description from route test',
        price: '777',
        condition: 'GOOD',
        city: 'Nablus',
        tags: 'edited,test',
        specs: '{"brand":"ASUS"}'
      },
      `/whale/listing/${listing.id}/edit`
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`/whale/listing/${listing.id}?updated=1`);

    const updated = await prisma.marketListing.findUnique({ where: { id: listing.id } });
    expect(updated.title).toBe('Edited route title');
    expect(updated.price).toBe(777);
    expect(updated.condition).toBe('GOOD');
    expect(updated.tags).toEqual(['edited', 'test']);
  });

  test('POST /whale/listing/:id/edit redirects to error for non-owner', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/listing/${listing.id}/edit`,
      { title: 'Should fail' },
      `/whale/listing/${listing.id}`
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`/whale/listing/${listing.id}/edit?error=1`);
  });

  test('POST /whale/listing/:id/mark-sold and /delete work for owner', async () => {
    const toSell = await createTestListing(seller.id, { title: 'Sell then delete', status: 'ACTIVE' });
    const sellRes = await postWithToken(
      sellerAgent,
      `/whale/listing/${toSell.id}/mark-sold`,
      {},
      '/whale/my-listings'
    );
    expect(sellRes.status).toBe(302);

    const sold = await prisma.marketListing.findUnique({ where: { id: toSell.id } });
    expect(sold.status).toBe('SOLD');

    const toDelete = await createTestListing(seller.id, { title: 'Delete me', status: 'ACTIVE' });
    const delRes = await postWithToken(
      sellerAgent,
      `/whale/listing/${toDelete.id}/delete`,
      {},
      '/whale/my-listings'
    );
    expect(delRes.status).toBe(302);

    const deleted = await prisma.marketListing.findUnique({ where: { id: toDelete.id } });
    expect(deleted.status).toBe('REMOVED');
  });

  test('POST /whale/listing/:id/mark-sold returns 400 for non-owner', async () => {
    const protectedListing = await createTestListing(seller.id, { title: 'Protected listing' });
    const res = await postWithToken(
      buyerAgent,
      `/whale/listing/${protectedListing.id}/mark-sold`,
      {},
      `/whale/listing/${protectedListing.id}`
    );
    expect(res.status).toBe(400);
  });

  test('GET /whale/orders works for buying and selling tabs', async () => {
    const buyerOrders = await buyerAgent.get('/whale/orders?tab=buying');
    expect(buyerOrders.status).toBe(200);
    expect(buyerOrders.text).toContain(order.orderNumber);

    const sellerOrders = await sellerAgent.get('/whale/orders?tab=selling');
    expect(sellerOrders.status).toBe(200);
    expect(sellerOrders.text).toContain(order.orderNumber);
  });

  test('GET /whale/orders/:id authorizes buyer/seller and blocks stranger', async () => {
    const buyerView = await buyerAgent.get(`/whale/orders/${order.id}`);
    expect(buyerView.status).toBe(200);

    const sellerView = await sellerAgent.get(`/whale/orders/${order.id}`);
    expect(sellerView.status).toBe(200);

    const strangerView = await strangerAgent.get(`/whale/orders/${order.id}`);
    expect(strangerView.status).toBe(403);
  });

  test('POST order state endpoints return 400 on forbidden/invalid states', async () => {
    const confirmAsBuyer = await postWithToken(
      buyerAgent,
      `/whale/orders/${order.id}/confirm`,
      {},
      `/whale/orders/${order.id}`
    );
    expect(confirmAsBuyer.status).toBe(400);

    const shipAsBuyer = await postWithToken(
      buyerAgent,
      `/whale/orders/${order.id}/ship`,
      { trackingNumber: 'X-1' },
      `/whale/orders/${order.id}`
    );
    expect(shipAsBuyer.status).toBe(400);

    const confirmDeliveryPending = await postWithToken(
      buyerAgent,
      `/whale/orders/${order.id}/confirm-delivery`,
      {},
      `/whale/orders/${order.id}`
    );
    expect(confirmDeliveryPending.status).toBe(400);
  });

  test('POST /whale/listing/:id/buy with card redirects to payment start', async () => {
    const cardListing = await createTestListing(seller.id, {
      title: 'Card checkout listing',
      price: 100,
      quantity: 2,
      status: 'ACTIVE'
    });

    const res = await postWithToken(
      buyerAgent,
      `/whale/listing/${cardListing.id}/buy`,
      {
        paymentMethod: 'card',
        shippingMethod: 'self_pickup',
        quantity: 1
      },
      `/whale/listing/${cardListing.id}/buy`
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/payment\/start\?orderId=/);
  });

  test('GET /whale/my-listings, /dashboard and /saved render for authenticated users', async () => {
    const saveRes = await postWithToken(
      buyerAgent,
      `/whale/listing/${listing.id}/save`,
      {},
      `/whale/listing/${listing.id}`
    );
    expect([200, 400]).toContain(saveRes.status);

    const myListings = await sellerAgent.get('/whale/my-listings');
    expect(myListings.status).toBe(200);

    const dashboard = await sellerAgent.get('/whale/dashboard');
    expect(dashboard.status).toBe(200);

    const saved = await buyerAgent.get('/whale/saved');
    expect(saved.status).toBe(200);
  });

  test('GET /whale/seller/:username returns 200 for existing and 404 for missing seller', async () => {
    const existing = await request(app).get(`/whale/seller/${seller.username}`);
    expect(existing.status).toBe(200);
    expect(existing.text).toContain(seller.username);

    const missing = await request(app).get('/whale/seller/test_missing_seller_username');
    expect(missing.status).toBe(404);
  });
});
