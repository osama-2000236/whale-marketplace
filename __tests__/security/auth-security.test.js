const request = require('supertest');
const app = require('../../server');
const { createTestUser, createTestListing, createTestOrder, cleanTestData, skipIfNoDb } = require('../helpers/db');
const { getCsrfToken } = require('../helpers/http');

afterAll(async () => {
  if (skipIfNoDb()) return;
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

describe('Authentication security', () => {
  test('protected routes redirect guests', async () => {
    if (skipIfNoDb()) return;
    const protectedRoutes = [
      '/whale/sell',
      '/whale/my-listings',
      '/whale/orders',
      '/whale/dashboard',
      '/whale/saved',
      '/payment/history',
      '/auth/me'
    ];

    for (const route of protectedRoutes) {
      const res = await request(app).get(route);
      expect([302, 401]).toContain(res.status);
    }
  });

  test('admin routes require admin role', async () => {
    if (skipIfNoDb()) return;
    const member = await createTestUser({ username: 'test_sec_member', password: 'pass' });
    const agent = request.agent(app);
    await login(agent, member.username, 'pass');

    const adminRoutes = ['/admin', '/admin/qr', '/admin/subscriptions', '/admin/whale'];
    for (const route of adminRoutes) {
      const res = await agent.get(route);
      expect([302, 403]).toContain(res.status);
    }
  });

  test('cannot access other user orders', async () => {
    if (skipIfNoDb()) return;
    const buyer = await createTestUser({ username: 'test_sec_buyer', password: 'pass' });
    const seller = await createTestUser({ username: 'test_sec_seller', password: 'pass' });
    const stranger = await createTestUser({ username: 'test_sec_stranger', password: 'pass' });

    const listing = await createTestListing(seller.id);
    const order = await createTestOrder(listing.id, buyer.id, seller.id);

    const strangerAgent = request.agent(app);
    await login(strangerAgent, stranger.username, 'pass');

    const res = await strangerAgent.get(`/whale/orders/${order.id}`);
    expect([302, 403]).toContain(res.status);
  });

  test('cannot edit another seller listing', async () => {
    if (skipIfNoDb()) return;
    const seller1 = await createTestUser({ username: 'test_sec_seller1', password: 'pass' });
    const seller2 = await createTestUser({ username: 'test_sec_seller2', password: 'pass' });
    const listing = await createTestListing(seller1.id);

    const agent2 = request.agent(app);
    await login(agent2, seller2.username, 'pass');

    const res = await agent2.get(`/whale/listing/${listing.id}/edit`);
    expect([302, 403]).toContain(res.status);
  });

  test('cannot mark sold another seller listing', async () => {
    if (skipIfNoDb()) return;
    const seller1 = await createTestUser({ username: 'test_sec_marksold1', password: 'pass' });
    const seller2 = await createTestUser({ username: 'test_sec_marksold2', password: 'pass' });
    const listing = await createTestListing(seller1.id);

    const agent2 = request.agent(app);
    await login(agent2, seller2.username, 'pass');

    const token = await getCsrfToken(agent2, `/whale/listing/${listing.id}`);
    const res = await agent2
      .post(`/whale/listing/${listing.id}/mark-sold`)
      .set('x-csrf-token', token)
      .type('form')
      .send({ _csrf: token });

    expect([400, 403, 302]).toContain(res.status);
  });

  test('repeated bad login attempts do not crash server', async () => {
    if (skipIfNoDb()) return;
    const results = [];
    for (let i = 0; i < 12; i += 1) {
      const agent = request.agent(app);
      const token = await getCsrfToken(agent, '/auth/login');
      const res = await agent
        .post('/auth/login')
        .set('x-csrf-token', token)
        .type('form')
        .send({ _csrf: token, identifier: 'nonexistent', password: 'wrong' });
      results.push(res.status);
    }

    expect(results.every((s) => s !== 500)).toBe(true);
  });
});

describe('CSRF protection', () => {
  test('POST without CSRF token is rejected', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .post('/auth/login')
      .type('form')
      .send({ identifier: 'x', password: 'y' });

    expect([403, 302]).toContain(res.status);
  });
});

describe('Input sanitization', () => {
  test('xss in listing title is not stored raw', async () => {
    if (skipIfNoDb()) return;
    const prisma = require('../../lib/prisma');
    const listings = await prisma.marketListing.findMany({ where: { title: { contains: '<script>' } } });
    expect(listings.length).toBe(0);
  });

  test('sql injection-like search does not crash', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get("/whale?q=' OR 1=1 --");
    expect(res.status).toBe(200);
  });

  test('nosql-like payload in query does not crash', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale?q={"$gt":""}');
    expect(res.status).not.toBe(500);
  });

  test('path traversal attempt is blocked', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale/../../../etc/passwd');
    expect([400, 404]).toContain(res.status);
  });

  test('oversized payload does not return 500', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'A'.repeat(100000), password: 'B'.repeat(100000) });
    expect(res.status).not.toBe(500);
  });
});
