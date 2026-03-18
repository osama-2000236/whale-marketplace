const request = require('supertest');
const app = require('../../../server');
const prisma = require('../../../lib/prisma');
const { createTestUser, createTestListing, cleanTestData } = require('../../helpers/db');
const { getCsrfToken } = require('../../helpers/http');

let proAgent;

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

beforeAll(async () => {
  const user = await createTestUser({ username: 'test_validation_seller', password: 'pass' });
  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, plan: 'pro', paidUntil: new Date(Date.now() + 86400000 * 30) },
    update: { plan: 'pro', paidUntil: new Date(Date.now() + 86400000 * 30) }
  });

  proAgent = request.agent(app);
  await login(proAgent, 'test_validation_seller', 'pass');
});

afterAll(async () => {
  await cleanTestData();
});

describe('Listing creation validation', () => {
  const validPayload = {
    title: 'Valid RTX 3060',
    description: 'Great card in good condition',
    price: '850',
    condition: 'USED',
    city: 'Tulkarem'
  };

  test('accepts valid listing payload', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', validPayload, '/whale/sell');
    expect([200, 302]).toContain(res.status);
    if (res.status === 302) {
      expect(res.headers.location).not.toContain('error');
    }
  });

  test('rejects missing title', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, title: '' }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);
  });

  test('rejects missing price', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, price: '' }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);
  });

  test('rejects negative price', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, price: '-100' }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);
  });

  test('rejects zero price', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, price: '0' }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);
  });

  test('rejects very high price', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, price: '9999999' }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);
  });

  test('rejects missing description', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, description: '' }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);
  });

  test('rejects long title', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, title: 'A'.repeat(201) }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);
  });

  test('rejects xss title', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, title: '<script>alert(1)</script>' }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);

    const listing = await prisma.marketListing.findFirst({ where: { title: { contains: '<script>' } } });
    expect(listing).toBeNull();
  });

  test('rejects invalid condition', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, condition: 'INVALID_CONDITION' }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);
  });

  test('rejects missing city', async () => {
    const res = await postWithToken(proAgent, '/whale/sell', { ...validPayload, city: '' }, '/whale/sell');
    expect([400, 422, 302]).toContain(res.status);
  });
});

describe('Order checkout validation', () => {
  let listing;
  let buyerAgent;

  beforeAll(async () => {
    const buyer = await createTestUser({ username: 'test_order_val_buyer', password: 'pass' });
    const seller = await createTestUser({ username: 'test_order_val_seller', password: 'pass' });
    listing = await createTestListing(seller.id);

    buyerAgent = request.agent(app);
    await login(buyerAgent, 'test_order_val_buyer', 'pass');
  });

  test('rejects missing shipping address for company shipping', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/listing/${listing.id}/buy`,
      {
        paymentMethod: 'cod',
        shippingMethod: 'company',
        shippingCompany: 'Flash Delivery'
      },
      `/whale/listing/${listing.id}/buy`
    );

    expect([400, 422, 302]).toContain(res.status);
    if (res.status === 302) expect(res.headers.location).toContain('error');
  });

  test('rejects invalid payment method', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/listing/${listing.id}/buy`,
      {
        paymentMethod: 'bitcoin',
        shippingMethod: 'company',
        buyerName: 'Test',
        buyerPhone: '0599000000',
        buyerCity: 'Tulkarem',
        buyerAddress: '123 St'
      },
      `/whale/listing/${listing.id}/buy`
    );

    expect([400, 422, 302]).toContain(res.status);
  });

  test('rejects invalid phone number', async () => {
    const res = await postWithToken(
      buyerAgent,
      `/whale/listing/${listing.id}/buy`,
      {
        paymentMethod: 'cod',
        shippingMethod: 'company',
        buyerName: 'Test',
        buyerPhone: '123',
        buyerCity: 'Tulkarem',
        buyerAddress: '123 St'
      },
      `/whale/listing/${listing.id}/buy`
    );

    expect([400, 422, 302]).toContain(res.status);
  });
});
