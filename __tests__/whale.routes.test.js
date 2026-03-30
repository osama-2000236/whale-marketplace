jest.mock('../services/whaleService', () => ({
  getListing: jest.fn(),
  isSaved: jest.fn(),
  toggleSaved: jest.fn(),
  getCategories: jest.fn(),
  createListing: jest.fn(),
  updateListing: jest.fn(),
  deleteListing: jest.fn(),
  transitionOrder: jest.fn(),
  getUserOrders: jest.fn(),
  getOrder: jest.fn(),
  postReview: jest.fn(),
  getSellerDashboard: jest.fn(),
  getSavedListings: jest.fn(),
  getListings: jest.fn(),
}));

jest.mock('../services/checkoutService', () => ({
  checkoutSingle: jest.fn(),
  startSingleHostedCheckout: jest.fn(),
}));

jest.mock('../services/paymentService', () => ({
  getProviderAvailability: jest.fn(() => ({
    paymob: true,
    paypal: true,
    stripe: true,
  })),
}));

jest.mock('../services/userService', () => ({
  getProfile: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  requireAuth: (_req, _res, next) => next(),
  requireVerified: (_req, _res, next) => next(),
  requirePro: (_req, _res, next) => next(),
  requireOwner: (_req, _res, next) => next(),
  requireOrderParty: (_req, _res, next) => next(),
  requireSeller: (_req, _res, next) => next(),
  requireBuyer: (_req, _res, next) => next(),
}));

jest.mock('../utils/images', () => ({
  upload: {
    array: () => (_req, _res, next) => next(),
  },
  processImages: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const whaleService = require('../services/whaleService');
const checkoutService = require('../services/checkoutService');
const paymentService = require('../services/paymentService');
const whaleRouter = require('../routes/whale');

function createApp({
  user = { id: 'buyer1', role: 'MEMBER', isVerified: true },
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
  app.use('/whale', whaleRouter);
  return app;
}

describe('whale checkout routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentService.getProviderAvailability.mockReturnValue({
      paymob: true,
      paypal: true,
      stripe: true,
    });
  });

  test('GET /whale/checkout/:id renders provider availability for the listing', async () => {
    whaleService.getListing.mockResolvedValue({ id: 'listing-1', title: 'Test item' });

    const response = await request(createApp()).get('/whale/checkout/listing-1');

    expect(whaleService.getListing).toHaveBeenCalledWith('listing-1');
    expect(paymentService.getProviderAvailability).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body.view).toBe('whale/checkout');
    expect(response.body.locals.providerAvailability).toEqual({
      paymob: true,
      paypal: true,
      stripe: true,
    });
  });

  test('POST /whale/checkout/:id uses checkoutSingle for manual payment', async () => {
    const session = {};
    checkoutService.checkoutSingle.mockResolvedValue({ id: 'order-1' });

    const response = await request(createApp({ session }))
      .post('/whale/checkout/listing-1')
      .send('paymentMethod=manual&street=123+Main&city=Gaza&phone=0599&buyerNote=Handle+with+care');

    expect(checkoutService.checkoutSingle).toHaveBeenCalledWith('buyer1', 'listing-1', {
      paymentMethod: 'manual',
      shippingAddress: {
        street: '123 Main',
        city: 'Gaza',
        phone: '0599',
      },
      buyerNote: 'Handle with care',
    });
    expect(checkoutService.startSingleHostedCheckout).not.toHaveBeenCalled();
    expect(session.flash).toEqual({
      type: 'success',
      message: 'flash.order_placed',
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/whale/orders/order-1');
  });

  test('POST /whale/checkout/:id starts hosted checkout for online providers', async () => {
    checkoutService.startSingleHostedCheckout.mockResolvedValue({
      redirectUrl: 'https://payments.example/checkout/session-1',
    });

    const response = await request(createApp())
      .post('/whale/checkout/listing-1')
      .send('paymentMethod=stripe&street=123+Main&city=Gaza&phone=0599');

    expect(checkoutService.checkoutSingle).not.toHaveBeenCalled();
    expect(checkoutService.startSingleHostedCheckout).toHaveBeenCalledWith('buyer1', 'listing-1', {
      paymentMethod: 'stripe',
      shippingAddress: {
        street: '123 Main',
        city: 'Gaza',
        phone: '0599',
      },
      buyerNote: undefined,
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('https://payments.example/checkout/session-1');
  });

  test('POST /whale/checkout/:id translates checkout errors into flash messages', async () => {
    const session = {};
    checkoutService.startSingleHostedCheckout.mockRejectedValue(
      new Error('PAYMENT_PROVIDER_DISABLED'),
    );

    const response = await request(createApp({ session }))
      .post('/whale/checkout/listing-1')
      .send('paymentMethod=stripe&street=123+Main&city=Gaza&phone=0599');

    expect(session.flash).toEqual({
      type: 'danger',
      message: 'That payment method is not available right now.',
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/whale/checkout/listing-1');
  });
});
