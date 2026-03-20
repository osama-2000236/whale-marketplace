const request = require('supertest');
const app = require('../../../server');
const prisma = require('../../../lib/prisma');
const {
  createTestUser,
  createTestListing,
  cleanTestData,
  skipIfNoDb
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

describe('Whale cart + search route coverage', () => {
  let seller;
  let buyer;
  let emptyBuyer;
  let sellerAgent;
  let buyerAgent;
  let emptyBuyerAgent;
  let listingA;
  let listingB;
  let slugListing;

  beforeAll(async () => {
    if (skipIfNoDb()) return;
    await cleanTestData();

    seller = await createTestUser({ username: 'test_cart_seller', password: 'pass' });
    buyer = await createTestUser({ username: 'test_cart_buyer', password: 'pass' });
    emptyBuyer = await createTestUser({ username: 'test_cart_empty', password: 'pass' });

    await prisma.marketCategory.upsert({
      where: { slug: 'test-suggest-cat' },
      create: {
        slug: 'test-suggest-cat',
        name: 'Suggest Category',
        nameAr: 'فئة الاقتراح',
        icon: '🧪',
        order: 999
      },
      update: {}
    });
    const category = await prisma.marketCategory.findUnique({ where: { slug: 'test-suggest-cat' } });

    listingA = await createTestListing(seller.id, {
      title: 'Suggest RTX 4060',
      titleAr: 'اقتراح RTX 4060',
      price: 1000,
      quantity: 3,
      categoryId: category.id
    });
    listingB = await createTestListing(seller.id, {
      title: 'Suggest Keyboard',
      titleAr: 'اقتراح كيبورد',
      price: 200,
      quantity: 4,
      categoryId: category.id
    });

    const rawSlugListing = await createTestListing(seller.id, {
      title: 'Slug Coverage Listing',
      description: 'Listing used for slug route coverage',
      price: 450,
      quantity: 1
    });
    slugListing = await prisma.marketListing.update({
      where: { id: rawSlugListing.id },
      data: { slug: `slug-coverage-${rawSlugListing.id.slice(0, 6)}` }
    });

    sellerAgent = request.agent(app);
    buyerAgent = request.agent(app);
    emptyBuyerAgent = request.agent(app);

    await loginAgent(sellerAgent, seller.username, 'pass');
    await loginAgent(buyerAgent, buyer.username, 'pass');
    await loginAgent(emptyBuyerAgent, emptyBuyer.username, 'pass');
  });

  afterAll(async () => {
    if (skipIfNoDb()) return;
    await cleanTestData();
  });

  test('GET /whale/search/suggestions returns empty for short query', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale/search/suggestions?q=a');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions).toHaveLength(0);
  });

  test('GET /whale/search/suggestions returns listing and category suggestions', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get('/whale/search/suggestions?q=suggest');
    expect(res.status).toBe(200);

    const types = new Set(res.body.suggestions.map((s) => s.type));
    expect(types.has('category')).toBe(true);
    expect(types.has('listing')).toBe(true);
  });

  test('GET /whale/search/suggestions uses session language for labels', async () => {
    if (skipIfNoDb()) return;
    await postWithToken(buyerAgent, '/prefs/lang', { lang: 'en' }, '/whale');
    const res = await buyerAgent.get('/whale/search/suggestions?q=suggest');
    expect(res.status).toBe(200);

    const categorySuggestion = res.body.suggestions.find((s) => s.type === 'category');
    expect(categorySuggestion).toBeDefined();
    expect(categorySuggestion.label).toBe('Suggest Category');

    await postWithToken(buyerAgent, '/prefs/lang', { lang: 'ar' }, '/whale');
  });

  test('GET /whale/listing/:idOrSlug serves listing by slug', async () => {
    if (skipIfNoDb()) return;
    const res = await request(app).get(`/whale/listing/${slugListing.slug}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Slug Coverage Listing');
  });

  test('GET /whale/cart renders for authenticated users', async () => {
    if (skipIfNoDb()) return;
    const res = await buyerAgent.get('/whale/cart');
    expect(res.status).toBe(200);
  });

  test('POST /whale/cart/add validates missing listingId', async () => {
    if (skipIfNoDb()) return;
    const res = await postWithToken(buyerAgent, '/whale/cart/add', {}, '/whale/cart');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_listingId');
  });

  test('POST /whale/cart/add blocks adding own listing', async () => {
    if (skipIfNoDb()) return;
    const res = await postWithToken(
      sellerAgent,
      '/whale/cart/add',
      { listingId: listingA.id, quantity: 1 },
      '/whale/cart'
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('own_listing');
  });

  test('POST /whale/cart/add then /whale/cart/remove works', async () => {
    if (skipIfNoDb()) return;
    const addRes = await postWithToken(
      buyerAgent,
      '/whale/cart/add',
      { listingId: listingA.id, quantity: 2 },
      '/whale/cart'
    );
    expect(addRes.status).toBe(200);
    expect(addRes.body.ok).toBe(true);
    expect(addRes.body.cartCount).toBeGreaterThanOrEqual(1);

    const removeRes = await postWithToken(
      buyerAgent,
      '/whale/cart/remove',
      { listingId: listingA.id },
      '/whale/cart'
    );
    expect(removeRes.status).toBe(302);
    expect(removeRes.headers.location).toBe('/whale/cart');
  });

  test('POST /whale/cart/checkout redirects when cart is empty', async () => {
    if (skipIfNoDb()) return;
    const res = await postWithToken(
      emptyBuyerAgent,
      '/whale/cart/checkout',
      {
        paymentMethod: 'cod',
        shippingMethod: 'self_pickup'
      },
      '/whale/cart'
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/whale/cart?error=empty');
  });

  test('POST /whale/cart/checkout blocks multi-item card checkout', async () => {
    if (skipIfNoDb()) return;
    await postWithToken(
      buyerAgent,
      '/whale/cart/add',
      { listingId: listingA.id, quantity: 1 },
      '/whale/cart'
    );
    await postWithToken(
      buyerAgent,
      '/whale/cart/add',
      { listingId: listingB.id, quantity: 1 },
      '/whale/cart'
    );

    const res = await postWithToken(
      buyerAgent,
      '/whale/cart/checkout',
      {
        paymentMethod: 'card',
        shippingMethod: 'self_pickup'
      },
      '/whale/cart'
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/whale/cart?error=card_multi_not_supported');

    await postWithToken(buyerAgent, '/whale/cart/remove', { listingId: listingA.id }, '/whale/cart');
    await postWithToken(buyerAgent, '/whale/cart/remove', { listingId: listingB.id }, '/whale/cart');
  });

  test('POST /whale/cart/checkout creates order(s) for COD flow', async () => {
    if (skipIfNoDb()) return;
    await postWithToken(
      buyerAgent,
      '/whale/cart/add',
      { listingId: listingA.id, quantity: 1 },
      '/whale/cart'
    );

    const beforeCount = await prisma.order.count({ where: { buyerId: buyer.id } });

    const res = await postWithToken(
      buyerAgent,
      '/whale/cart/checkout',
      {
        paymentMethod: 'cod',
        shippingMethod: 'company',
        buyerName: 'Coverage Buyer',
        buyerPhone: '0599000000',
        buyerCity: 'Tulkarem',
        buyerAddress: 'Street 10',
        buyerNote: 'test'
      },
      '/whale/cart'
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/whale\/orders\?placed=/);

    const afterCount = await prisma.order.count({ where: { buyerId: buyer.id } });
    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});
