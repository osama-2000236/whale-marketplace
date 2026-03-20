const request = require('supertest');
const app = require('../../../server');
const prisma = require('../../../lib/prisma');
const { createTestUser, createTestListing, cleanTestData, skipIfNoDb } = require('../../helpers/db');
const { getCsrfToken } = require('../../helpers/http');

let seller;
let buyer;
let listing;
let sellerAgent;
let buyerAgent;

async function loginAgent(agent, identifier, password) {
  const token = await getCsrfToken(agent, '/auth/login');
  return agent
    .post('/auth/login')
    .set('x-csrf-token', token)
    .type('form')
    .send({ identifier, password, _csrf: token });
}

beforeAll(async () => {
  if (skipIfNoDb()) return;
  await cleanTestData();

  seller = await createTestUser({ username: 'test_whale_seller', password: 'pass' });
  buyer = await createTestUser({ username: 'test_whale_buyer', password: 'pass' });
  listing = await createTestListing(seller.id, { price: 850, title: 'Test RTX 3060 Ti' });

  await prisma.subscription.upsert({
    where: { userId: seller.id },
    create: { userId: seller.id, plan: 'pro', paidUntil: new Date(Date.now() + 86400000 * 30) },
    update: { plan: 'pro', paidUntil: new Date(Date.now() + 86400000 * 30) }
  });

  await prisma.subscription.upsert({
    where: { userId: buyer.id },
    create: { userId: buyer.id, plan: 'pro', paidUntil: new Date(Date.now() + 86400000 * 30) },
    update: { plan: 'pro', paidUntil: new Date(Date.now() + 86400000 * 30) }
  });

  sellerAgent = request.agent(app);
  buyerAgent = request.agent(app);

  await loginAgent(sellerAgent, 'test_whale_seller', 'pass');
  await loginAgent(buyerAgent, 'test_whale_buyer', 'pass');
});

afterAll(async () => {
  if (skipIfNoDb()) return;
  await cleanTestData();
});

describe('GET /whale', () => {
  test('returns 200 for guests', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale');
    expect(res.status).toBe(200);
  });

  test('shows listings to guests', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale');
    expect(res.text).toContain('Test RTX 3060 Ti');
  });

  test('accepts category filter', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale?category=pc-parts');
    expect(res.status).toBe(200);
  });

  test('accepts city filter', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale?city=Tulkarem');
    expect(res.status).toBe(200);
  });

  test('accepts price range filter', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale?minPrice=100&maxPrice=1000');
    expect(res.status).toBe(200);
  });

  test('accepts search query', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale?q=RTX');
    expect(res.status).toBe(200);
  });

  test('accepts all sort options', async () => {
    if (skipIfNoDb()) return;
    for (const sort of ['newest', 'cheapest', 'expensive', 'popular']) {
      const res = await request(app).get(`/whale?sort=${sort}`);
      expect(res.status).toBe(200);
    }
  });

  test('does not show direct create form to guests', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale');
    expect(res.text).not.toContain('action="/whale/sell"');
  });
});

describe('GET /whale/listing/:id', () => {
  test('returns 200 for valid listing', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get(`/whale/listing/${listing.id}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain(listing.title);
  });

  test('shows register prompt for guest contact', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get(`/whale/listing/${listing.id}`);
    expect(res.text).toMatch(/Register to contact seller|سجّل للتواصل/i);
  });

  test('shows buy button to logged-in buyer', async () => {
    if (skipIfNoDb()) return;
    const res = await buyerAgent.get(`/whale/listing/${listing.id}`);
    expect(res.text).toMatch(/Buy Now|اشتر الآن/i);
  });

  test('increments view count', async () => {
    if (skipIfNoDb()) return;
    const before = await prisma.marketListing.findUnique({ where: { id: listing.id } });
    await request(app).get(`/whale/listing/${listing.id}`);
    const after = await prisma.marketListing.findUnique({ where: { id: listing.id } });
    expect(after.views).toBeGreaterThan(before.views);
  });

  test('returns 404 for removed listing', async () => {
    if (skipIfNoDb()) return;
    const removed = await createTestListing(seller.id, { status: 'REMOVED' });
    const res = await request(app).get(`/whale/listing/${removed.id}`);
    expect(res.status).toBe(404);
  });

  test('returns 404 for missing uuid', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale/listing/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('GET /whale/sell auth gate', () => {
  test('redirects guests', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale/sell');
    expect([302, 401]).toContain(res.status);
    if (res.status === 302) {
      expect(res.headers.location).toMatch(/login|register/i);
    }
  });

  test('redirects free members to upgrade', async () => {
    if (skipIfNoDb()) return;
    const freeMember = await createTestUser({ username: 'test_free_member', password: 'pass' });
    await prisma.subscription.upsert({
      where: { userId: freeMember.id },
      create: { userId: freeMember.id, plan: 'free' },
      update: { plan: 'free', paidUntil: null, trialEndsAt: null }
    });

    const freeAgent = request.agent(app);
    await loginAgent(freeAgent, 'test_free_member', 'pass');

    const res = await freeAgent.get('/whale/sell');
    expect([302, 403]).toContain(res.status);
    if (res.status === 302) {
      expect(res.headers.location).toMatch(/upgrade/i);
    }
  });
});

describe('POST /whale/listing/:id/save', () => {
  test('returns auth or csrf error for unauthenticated request', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .post(`/whale/listing/${listing.id}/save`)
      .set('Accept', 'application/json');

    expect([401, 302, 403]).toContain(res.status);
  });

  test('toggles save for authenticated user', async () => {
    if (skipIfNoDb()) return;
    const token = await getCsrfToken(buyerAgent, `/whale/listing/${listing.id}`);
    const res = await buyerAgent
      .post(`/whale/listing/${listing.id}/save`)
      .set('Accept', 'application/json')
      .set('x-csrf-token', token)
      .send({ _csrf: token });

    expect(res.status).toBe(200);
    expect(typeof res.body.saved).toBe('boolean');
  });
});
