const request = require('supertest');
const app = require('../../server');
const prisma = require('../../lib/prisma');
const { createTestUser, createTestListing, cleanTestData } = require('../helpers/db');
const { getCsrfToken } = require('../helpers/http');

let proAgent;
let listing;

async function login(agent, identifier, password) {
  const token = await getCsrfToken(agent, '/auth/login');
  return agent
    .post('/auth/login')
    .set('x-csrf-token', token)
    .type('form')
    .send({ identifier, password, _csrf: token });
}

beforeAll(async () => {
  const pro = await createTestUser({ username: 'test_smoke_pro', password: 'pass' });
  await prisma.subscription.upsert({
    where: { userId: pro.id },
    create: { userId: pro.id, plan: 'pro', paidUntil: new Date(Date.now() + 86400000 * 30) },
    update: { plan: 'pro', paidUntil: new Date(Date.now() + 86400000 * 30) }
  });

  listing = await createTestListing(pro.id);

  proAgent = request.agent(app);
  await login(proAgent, 'test_smoke_pro', 'pass');
});

afterAll(async () => {
  await cleanTestData();
});

const PUBLIC_ROUTES = [
  '/',
  '/whale',
  '/auth/login',
  '/auth/register',
  '/welcome',
  '/forum',
  '/rooms',
  '/upgrade'
];

describe('Public routes smoke test', () => {
  PUBLIC_ROUTES.forEach((route) => {
    test(`GET ${route} returns 200/302`, async () => {
      const res = await request(app).get(route);
      expect([200, 302]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });
});

const AUTH_ROUTES = [
  '/whale/sell',
  '/whale/my-listings',
  '/whale/orders',
  '/whale/dashboard',
  '/whale/saved',
  '/payment/history',
  '/auth/me'
];

describe('Auth-required routes redirect guests', () => {
  AUTH_ROUTES.forEach((route) => {
    test(`GET ${route} rejects guest`, async () => {
      const res = await request(app).get(route);
      expect([302, 401]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });
});

describe('Auth-required routes for Pro user', () => {
  AUTH_ROUTES.forEach((route) => {
    test(`GET ${route} works for logged user`, async () => {
      const res = await proAgent.get(route);
      expect([200, 302]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });
});

describe('Listing routes', () => {
  test('GET /whale/listing/:id returns 200', async () => {
    const res = await request(app).get(`/whale/listing/${listing.id}`);
    expect(res.status).toBe(200);
  });

  test('GET /whale/listing/:id invalid uuid returns 404/400', async () => {
    const res = await request(app).get('/whale/listing/not-a-real-uuid');
    expect([404, 400]).toContain(res.status);
  });
});

describe('Error pages', () => {
  test('404 page renders', async () => {
    const res = await request(app).get('/definitely-does-not-exist-xyz-abc');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('Cannot GET');
  });
});
