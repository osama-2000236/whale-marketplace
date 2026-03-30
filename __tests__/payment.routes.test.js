jest.mock('../middleware/auth', () => ({
  requireAuth: (_req, _res, next) => next(),
  requireVerified: (_req, _res, next) => next(),
}));

jest.mock('../services/paymentService', () => ({
  getProviderAvailability: jest.fn(),
  getPlans: jest.fn(),
  createPaymobSession: jest.fn(),
  createPaypalOrder: jest.fn(),
  createStripeSession: jest.fn(),
  handleSuccessReturn: jest.fn(),
  handleCancellationReturn: jest.fn(),
  getOrderRedirectPath: jest.fn(),
  getCancellationRedirectPath: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const paymentRouter = require('../routes/payment');
const paymentService = require('../services/paymentService');

function createApp({ user = { id: 'u1', subscription: { plan: 'free' } }, session = {} } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    req.user = user;
    req.session = session;
    res.locals.user = user;
    res.locals.t = (key) => key;
    res.render = (view, locals) => res.status(res.statusCode || 200).json({ view, locals });
    next();
  });
  app.use(paymentRouter);
  return app;
}

describe('payment routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentService.getProviderAvailability.mockReturnValue({
      paymob: true,
      paypal: true,
      stripe: true,
    });
    paymentService.getPlans.mockReturnValue({
      1: { price: 5, label: 'Monthly' },
      6: { price: 25, label: '6 Months' },
      12: { price: 45, label: 'Annual' },
    });
  });

  test('GET /upgrade renders plans and provider availability', async () => {
    const response = await request(createApp()).get('/upgrade');

    expect(paymentService.getPlans).toHaveBeenCalledTimes(1);
    expect(paymentService.getProviderAvailability).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body.view).toBe('payment/upgrade');
    expect(response.body.locals.plans).toEqual({
      1: { price: 5, label: 'Monthly' },
      6: { price: 25, label: '6 Months' },
      12: { price: 45, label: 'Annual' },
    });
  });

  test('GET /payment/success redirects order payments to the order destination', async () => {
    const session = {};
    paymentService.handleSuccessReturn.mockResolvedValue({
      id: 'pay-order-1',
      purpose: 'ORDER',
      metadata: { orderIds: ['order-1'], flow: 'single' },
    });
    paymentService.getOrderRedirectPath.mockReturnValue('/whale/orders/order-1');

    const response = await request(createApp({ session })).get('/payment/success?paymentId=pay-order-1');

    expect(paymentService.handleSuccessReturn).toHaveBeenCalledWith({
      paymentId: 'pay-order-1',
      token: undefined,
      sessionId: undefined,
    });
    expect(session.flash).toEqual({
      type: 'success',
      message: 'Payment completed successfully.',
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/whale/orders/order-1');
  });

  test('GET /payment/success renders subscription success actions', async () => {
    paymentService.handleSuccessReturn.mockResolvedValue({
      id: 'pay-sub-1',
      purpose: 'SUBSCRIPTION',
    });

    const response = await request(createApp()).get('/payment/success?paymentId=pay-sub-1');

    expect(response.status).toBe(200);
    expect(response.body.view).toBe('payment/success');
    expect(response.body.locals).toEqual(
      expect.objectContaining({
        purpose: 'SUBSCRIPTION',
        primaryHref: '/whale/sell',
        secondaryHref: '/whale',
      }),
    );
  });

  test('GET /payment/cancel handles targeted order-payment cancellation', async () => {
    const session = {};
    paymentService.handleCancellationReturn.mockResolvedValue({
      id: 'pay-order-1',
      purpose: 'ORDER',
      metadata: { flow: 'cart' },
    });
    paymentService.getCancellationRedirectPath.mockReturnValue('/cart');

    const response = await request(createApp({ session })).get('/payment/cancel?paymentId=pay-order-1');

    expect(paymentService.handleCancellationReturn).toHaveBeenCalledWith('pay-order-1');
    expect(session.flash).toEqual({
      type: 'warning',
      message: 'Payment was cancelled.',
    });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/cart');
  });
});
