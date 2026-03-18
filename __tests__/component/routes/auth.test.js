const request = require('supertest');
const app = require('../../../server');
const prisma = require('../../../lib/prisma');
const { cleanTestData, createTestUser } = require('../../helpers/db');
const { getCsrfToken } = require('../../helpers/http');

afterAll(async () => {
  await cleanTestData();
});

async function registerWithCsrf(agent, payload) {
  const token = await getCsrfToken(agent, '/auth/register');
  return agent
    .post('/auth/register')
    .set('x-csrf-token', token)
    .type('form')
    .send({ ...payload, _csrf: token });
}

async function loginWithCsrf(agent, payload) {
  const token = await getCsrfToken(agent, '/auth/login');
  return agent
    .post('/auth/login')
    .set('x-csrf-token', token)
    .type('form')
    .send({ ...payload, _csrf: token });
}

describe('POST /auth/register', () => {
  test('register page uses standard form encoding for CSRF-safe submit', async () => {
    const res = await request(app).get('/auth/register');

    expect(res.status).toBe(200);
    expect(res.text).toContain('action="/auth/register"');
    expect(res.text).not.toContain('multipart/form-data');
  });

  test('registers new user successfully', async () => {
    const agent = request.agent(app);
    const res = await registerWithCsrf(agent, {
      username: 'test_newreg',
      email: 'test_newreg@example.com',
      password: 'password123'
    });

    expect([200, 302]).toContain(res.status);

    const user = await prisma.user.findUnique({ where: { username: 'test_newreg' } });
    expect(user).not.toBeNull();
  });

  test('rejects duplicate username', async () => {
    const agent1 = request.agent(app);
    await registerWithCsrf(agent1, {
      username: 'test_dup_user',
      email: 'test_dup1@example.com',
      password: 'password123'
    });

    const agent2 = request.agent(app);
    const res = await registerWithCsrf(agent2, {
      username: 'test_dup_user',
      email: 'test_dup2@example.com',
      password: 'password123'
    });

    expect(res.status).toBe(400);
    expect(res.text).toMatch(/exists|موجود|already/i);
  });

  test('rejects duplicate email', async () => {
    const agent1 = request.agent(app);
    await registerWithCsrf(agent1, {
      username: 'test_dupemail1',
      email: 'same@example.com',
      password: 'password123'
    });

    const agent2 = request.agent(app);
    const res = await registerWithCsrf(agent2, {
      username: 'test_dupemail2',
      email: 'same@example.com',
      password: 'password123'
    });

    expect(res.status).toBe(400);
  });

  test('rejects missing username', async () => {
    const agent = request.agent(app);
    const res = await registerWithCsrf(agent, {
      email: 'nouser@example.com',
      password: 'password123'
    });
    expect([400, 422]).toContain(res.status);
  });

  test('rejects short password', async () => {
    const agent = request.agent(app);
    const res = await registerWithCsrf(agent, {
      username: 'test_shortpass',
      email: 'short@example.com',
      password: '123'
    });

    expect([400, 422]).toContain(res.status);
  });

  test('creates subscription on registration', async () => {
    const agent = request.agent(app);
    await registerWithCsrf(agent, {
      username: 'test_subscheck',
      email: 'subscheck@example.com',
      password: 'password123'
    });

    const user = await prisma.user.findUnique({ where: { email: 'subscheck@example.com' } });
    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });

    expect(sub).not.toBeNull();
    expect(sub.plan).toBe('pro');
    expect(sub.trialEndsAt).not.toBeNull();
  });

  test('rejects username with spaces', async () => {
    const agent = request.agent(app);
    const res = await registerWithCsrf(agent, {
      username: 'test user spaces',
      email: 'spaces@example.com',
      password: 'password123'
    });

    expect([400, 422]).toContain(res.status);
  });

  test('rejects username over 30 chars', async () => {
    const agent = request.agent(app);
    const res = await registerWithCsrf(agent, {
      username: 'a'.repeat(31),
      email: 'longname@example.com',
      password: 'password123'
    });

    expect([400, 422]).toContain(res.status);
  });

  test('requires CSRF token', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send({ username: 'csrf_test', email: 'csrf@test.com', password: 'password123' });

    expect([302, 403]).toContain(res.status);
  });
});

describe('POST /auth/login', () => {
  beforeAll(async () => {
    await createTestUser({
      username: 'test_loginuser',
      email: 'loginuser@example.com',
      password: 'correctpass'
    });
  });

  test('logs in with correct credentials', async () => {
    const agent = request.agent(app);
    const res = await loginWithCsrf(agent, {
      identifier: 'test_loginuser',
      password: 'correctpass'
    });

    expect([200, 302]).toContain(res.status);
    if (res.headers['set-cookie']) {
      expect(res.headers['set-cookie'].some((c) => c.includes('connect.sid'))).toBe(true);
    }
  });

  test('rejects wrong password', async () => {
    const agent = request.agent(app);
    const res = await loginWithCsrf(agent, {
      identifier: 'test_loginuser',
      password: 'wrongpassword'
    });

    expect(res.status).toBe(401);
  });

  test('rejects non-existent user', async () => {
    const agent = request.agent(app);
    const res = await loginWithCsrf(agent, {
      identifier: 'nobody_exists_xyz',
      password: 'anypass'
    });

    expect(res.status).toBe(401);
  });

  test('rejects empty credentials', async () => {
    const agent = request.agent(app);
    const res = await loginWithCsrf(agent, {});
    expect([400, 401]).toContain(res.status);
  });

  test('handles SQL injection attempt safely', async () => {
    const agent = request.agent(app);
    const res = await loginWithCsrf(agent, {
      identifier: "' OR 1=1 --",
      password: 'anything'
    });

    expect(res.status).toBe(401);
  });
});
