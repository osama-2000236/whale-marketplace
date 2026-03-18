const request = require('supertest');
const app = require('../../../server');
const prisma = require('../../../lib/prisma');
const { cleanTestData } = require('../../helpers/db');
const { getCsrfToken } = require('../../helpers/http');

afterAll(async () => {
  await cleanTestData();
});

describe('New seller onboarding flow', () => {
  const agent = request.agent(app);
  let userId;

  test('Step 1: register with referral code', async () => {
    const code = await prisma.referralCode.create({
      data: { code: 'TESTREF01', label: 'Test PC Sale' }
    });

    const token = await getCsrfToken(agent, '/auth/register');
    const res = await agent
      .post('/auth/register')
      .set('x-csrf-token', token)
      .type('form')
      .send({
        _csrf: token,
        username: 'test_new_seller_flow',
        email: 'newseller_flow@example.com',
        password: 'password123',
        ref: code.code
      });

    expect([200, 302]).toContain(res.status);

    const user = await prisma.user.findUnique({ where: { email: 'newseller_flow@example.com' } });
    userId = user.id;
    expect(userId).toBeDefined();
  });

  test('Step 2: user has 30-day pro trial', async () => {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    expect(sub.plan).toBe('pro');
    expect(sub.trialEndsAt).not.toBeNull();

    const trialDays = Math.ceil((new Date(sub.trialEndsAt) - new Date()) / 86400000);
    expect(trialDays).toBeGreaterThan(25);
  });

  test('Step 3: referral usage incremented', async () => {
    const code = await prisma.referralCode.findUnique({ where: { code: 'TESTREF01' } });
    expect(code.usedCount).toBe(1);
  });

  test('Step 4: pro trial user can access /whale/sell', async () => {
    const res = await agent.get('/whale/sell');
    expect(res.status).toBe(200);
  });
});
