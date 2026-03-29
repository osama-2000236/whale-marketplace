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
const checkoutService = require('../services/checkoutService');
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
  });

  test('POST /whale/checkout/:id delegates to checkoutService.checkoutSingle', async () => {
    const session = {};
    checkoutService.checkoutSingle.mockResolvedValue({ id: 'order-1' });

    const response = await request(createApp({ session }))
      .post('/whale/checkout/listing-1')
      .send('paymentMethod=cod&street=123+Main&city=Gaza&phone=0599&buyerNote=Handle+with+care');

    expect(checkoutService.checkoutSingle).toHaveBeenCalledWith('buyer1', 'listing-1', {
      paymentMethod: 'cod',
      shippingAddress: {
        street: '123 Main',
        city: 'Gaza',
        phone: '0599',
      },
      buyerNote: 'Handle with care',
    });
    expect(session.flash).toEqual({
      type: 'success',
      message: 'flash.order_placed',
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/whale/orders/order-1');
  });
});
