jest.mock('express-rate-limit', () => () => (_req, _res, next) => next());

const passportState = {
  callbackResult: { err: null, user: null, info: null },
  lastStrategy: null,
  lastOptions: null,
};

jest.mock('../lib/passport', () => ({
  authenticate: jest.fn((strategy, optionsOrCb) => {
    if (typeof optionsOrCb === 'function') {
      return (_req, _res, next) =>
        optionsOrCb(
          passportState.callbackResult.err,
          passportState.callbackResult.user,
          passportState.callbackResult.info,
        );
    }

    passportState.lastStrategy = strategy;
    passportState.lastOptions = optionsOrCb;
    return (_req, _res, next) => next();
  }),
}));

jest.mock('../services/userService', () => ({
  register: jest.fn(),
}));

jest.mock('../services/authSecurityService', () => ({
  verifyEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  verifyAdmin2FA: jest.fn(),
  verifyEmailChange: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const authRouter = require('../routes/auth');

function createApp({ user = null, session = {} } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    req.user = user;
    req.session = session;
    req.session.destroy = (cb) => cb();
    req.logIn = (_user, cb) => cb();
    req.logout = (cb) => cb();
    res.locals.t = (key) => key;
    res.render = (view, locals) => res.status(res.statusCode || 200).json({ view, locals });
    next();
  });
  app.use('/auth', authRouter);
  return app;
}

describe('auth oauth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    passportState.callbackResult = { err: null, user: null, info: null };
    passportState.lastStrategy = null;
    passportState.lastOptions = null;
  });

  test('GET /auth/login exposes Google button flags and preserves next', async () => {
    const originalGoogleId = process.env.GOOGLE_CLIENT_ID;
    const originalGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

    const response = await request(createApp()).get('/auth/login?next=/checkout');

    expect(response.status).toBe(200);
    expect(response.body.view).toBe('auth/login');
    expect(response.body.locals).toEqual(
      expect.objectContaining({
        hasGoogle: true,
        next: '/checkout',
      }),
    );

    if (originalGoogleId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalGoogleId;
    }
    if (originalGoogleSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = originalGoogleSecret;
    }
  });

  test('GET /auth/google stores a safe next path before starting oauth', async () => {
    const session = {};

    const response = await request(createApp({ session })).get('/auth/google?next=/checkout');

    expect(response.status).toBe(404);
    expect(session.oauthNext).toBe('/checkout');
    expect(passportState.lastStrategy).toBe('google');
    expect(passportState.lastOptions).toEqual({ scope: ['profile', 'email'] });
  });

  test('GET /auth/google/callback logs in and redirects to the saved next path', async () => {
    const session = { oauthNext: '/checkout' };
    passportState.callbackResult = {
      err: null,
      user: { id: 'u1' },
      info: null,
    };

    const response = await request(createApp({ session })).get('/auth/google/callback');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/checkout');
    expect(session.flash).toEqual({
      type: 'success',
      message: 'flash.login_success',
    });
  });

  test('GET /auth/google/callback maps provider failures to a user-facing login error', async () => {
    const session = { oauthNext: '/profile' };
    passportState.callbackResult = {
      err: null,
      user: null,
      info: { message: 'OAUTH_EMAIL_REQUIRED' },
    };

    const response = await request(createApp({ session })).get('/auth/google/callback');

    expect(session.flash).toEqual({
      type: 'danger',
      message: 'We could not read an email address from the provider.',
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/login?next=%2Fprofile');
  });

  test('GET /auth/login renders Google as primary button and hides local form toggle when hasGoogle is false', async () => {
    const saved = { id: process.env.GOOGLE_CLIENT_ID, sec: process.env.GOOGLE_CLIENT_SECRET };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const response = await request(createApp()).get('/auth/login');

    expect(response.status).toBe(200);
    expect(response.body.locals).toEqual(
      expect.objectContaining({ hasGoogle: false })
    );

    process.env.GOOGLE_CLIENT_ID = saved.id;
    process.env.GOOGLE_CLIENT_SECRET = saved.sec;
  });

  test('GET /auth/register exposes hasGoogle flag matching env vars', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

    const response = await request(createApp()).get('/auth/register');

    expect(response.status).toBe(200);
    expect(response.body.locals).toEqual(
      expect.objectContaining({ hasGoogle: true })
    );

    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });
});
