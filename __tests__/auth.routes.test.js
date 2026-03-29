jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../lib/passport', () => ({
  authenticate: jest.fn((strategy, optionsOrCb) => {
    if (typeof optionsOrCb === 'function') {
      return (_req, _res, next) => optionsOrCb(null, null, { message: 'USER_NOT_FOUND' });
    }
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
}));

const express = require('express');
const request = require('supertest');
const authRouter = require('../routes/auth');
const authSecurityService = require('../services/authSecurityService');

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

describe('auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /auth/resend-verification calls sendVerificationEmail(user.id)', async () => {
    const session = {};
    const app = createApp({ user: { id: 'u1', role: 'MEMBER' }, session });
    authSecurityService.sendVerificationEmail.mockResolvedValue({ sent: true });

    const response = await request(app)
      .post('/auth/resend-verification')
      .set('Referer', '/profile')
      .send({});

    expect(authSecurityService.sendVerificationEmail).toHaveBeenCalledWith('u1');
    expect(response.status).toBe(302);
  });

  test('POST /auth/forgot-password calls sendPasswordReset(email)', async () => {
    const app = createApp();
    authSecurityService.sendPasswordReset.mockResolvedValue({ sent: true });

    const response = await request(app)
      .post('/auth/forgot-password')
      .send('email=User%40Example.com');

    expect(authSecurityService.sendPasswordReset).toHaveBeenCalledWith('User@Example.com');
    expect(response.status).toBe(302);
  });

  test('GET /auth/2fa renders for admins and redirects non-admins', async () => {
    const adminResponse = await request(
      createApp({ user: { id: 'a1', role: 'ADMIN', twoFactorSecret: 'secret' }, session: {} })
    ).get('/auth/2fa');

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.view).toBe('auth/2fa');

    const memberResponse = await request(
      createApp({ user: { id: 'u1', role: 'MEMBER' }, session: {} })
    ).get('/auth/2fa');

    expect(memberResponse.status).toBe(302);
    expect(memberResponse.headers.location).toBe('/');
  });

  test('POST /auth/2fa rejects invalid codes and keeps session unverified', async () => {
    const session = {};
    authSecurityService.verifyAdmin2FA.mockReturnValue(false);

    const response = await request(
      createApp({
        user: { id: 'a1', role: 'ADMIN', twoFactorSecret: 'secret' },
        session,
      })
    )
      .post('/auth/2fa')
      .send('code=000000');

    expect(authSecurityService.verifyAdmin2FA).toHaveBeenCalledWith('secret', '000000');
    expect(session.admin2FAVerified).toBeUndefined();
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/2fa');
  });

  test('POST /auth/2fa marks session verified for valid codes', async () => {
    const session = {};
    authSecurityService.verifyAdmin2FA.mockReturnValue(true);

    const response = await request(
      createApp({
        user: { id: 'a1', role: 'ADMIN', twoFactorSecret: 'secret' },
        session,
      })
    )
      .post('/auth/2fa')
      .send('code=123456');

    expect(authSecurityService.verifyAdmin2FA).toHaveBeenCalledWith('secret', '123456');
    expect(session.admin2FAVerified).toBe(true);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/admin');
  });
});
