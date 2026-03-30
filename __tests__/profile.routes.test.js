jest.mock('../middleware/auth', () => ({
  requireAuth: (_req, _res, next) => next(),
  requireVerified: (_req, _res, next) => next(),
}));

jest.mock('../services/userService', () => ({
  getAccountProfile: jest.fn(),
  updateProfile: jest.fn(),
  changeUsername: jest.fn(),
  requestEmailChange: jest.fn(),
  changePassword: jest.fn(),
  createAddress: jest.fn(),
  updateAddress: jest.fn(),
  deleteAddress: jest.fn(),
}));

jest.mock('../utils/images', () => ({
  upload: {
    single: () => (_req, _res, next) => next(),
  },
  uploadToCloud: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const profileRouter = require('../routes/profile');
const userService = require('../services/userService');

function createApp({
  user = { id: 'u1', isVerified: true, passwordHash: 'hash' },
  session = {},
} = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    req.user = user;
    req.session = session;
    res.locals.t = (key) => key;
    res.render = (view, locals) => res.status(res.statusCode || 200).json({ view, locals });
    next();
  });
  app.use('/profile', profileRouter);
  return app;
}

describe('profile routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /profile renders account profile details, addresses, and password state', async () => {
    userService.getAccountProfile.mockResolvedValue({
      id: 'u1',
      username: 'seller1',
      email: 'seller@example.com',
      pendingEmail: 'new@example.com',
      isVerified: true,
      passwordHash: 'hash',
      sellerProfile: { displayName: 'Seller One' },
      addresses: [{ id: 'a1', label: 'Home', street: 'Main', city: 'Gaza', phone: '0599123456' }],
    });

    const response = await request(createApp()).get('/profile');

    expect(userService.getAccountProfile).toHaveBeenCalledWith('u1');
    expect(response.status).toBe(200);
    expect(response.body.view).toBe('profile/index');
    expect(response.body.locals.addresses).toHaveLength(1);
    expect(response.body.locals.hasLocalPassword).toBe(true);
  });

  test('POST /profile/account/email requests a verified email change and flashes success', async () => {
    const session = {};
    userService.requestEmailChange.mockResolvedValue({ sent: true });

    const response = await request(createApp({ session }))
      .post('/profile/account/email')
      .send('email=new%40example.com&currentPassword=StrongPass123');

    expect(userService.requestEmailChange).toHaveBeenCalledWith('u1', {
      email: 'new@example.com',
      currentPassword: 'StrongPass123',
    });
    expect(session.flash).toEqual({
      type: 'success',
      message: 'Check your new email inbox to confirm the change.',
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/profile');
  });

  test('POST /profile/account/password maps PASSWORD_SETUP_REQUIRED to an info flash', async () => {
    const session = {};
    userService.changePassword.mockRejectedValue(new Error('PASSWORD_SETUP_REQUIRED'));

    const response = await request(createApp({ session }))
      .post('/profile/account/password')
      .send('currentPassword=oldpass&newPassword=NewStrongPass123&confirmPassword=NewStrongPass123');

    expect(session.flash).toEqual({
      type: 'info',
      message: 'Set a password from the email we just sent before changing account settings.',
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/profile');
  });

  test('POST /profile/addresses creates a saved address', async () => {
    const session = {};
    userService.createAddress.mockResolvedValue({ id: 'a1' });

    const response = await request(createApp({ session }))
      .post('/profile/addresses')
      .send('label=Home&street=123+Main&city=Gaza&phone=0599123456&isDefault=on');

    expect(userService.createAddress).toHaveBeenCalledWith('u1', {
      label: 'Home',
      street: '123 Main',
      city: 'Gaza',
      phone: '0599123456',
      isDefault: 'on',
    });
    expect(session.flash).toEqual({
      type: 'success',
      message: 'Address saved successfully.',
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/profile');
  });
});
