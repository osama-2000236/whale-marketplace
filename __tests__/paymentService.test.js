const crypto = require('crypto');

jest.mock('../lib/prisma', () => ({
  payment: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  subscription: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require('../lib/prisma');
const paymentService = require('../services/paymentService');

describe('paymentService', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  test('createPaymobSession returns config warning when Paymob is not configured', async () => {
    delete process.env.PAYMOB_API_KEY;
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });

    const result = await paymentService.createPaymobSession('user-1', 6);

    expect(prisma.payment.create).toHaveBeenCalled();
    expect(result).toEqual({
      iframeUrl: null,
      paymentId: 'pay-1',
      error: 'Paymob not configured',
    });
  });

  test('createPaypalOrder returns config warning when PayPal is not configured', async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    prisma.payment.create.mockResolvedValue({ id: 'pay-2' });

    const result = await paymentService.createPaypalOrder('user-1', 12);

    expect(result).toEqual({
      approvalUrl: null,
      orderId: 'pay-2',
      error: 'PayPal not configured',
    });
  });

  test('createStripeSession returns config warning when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    prisma.payment.create.mockResolvedValue({ id: 'pay-3' });

    const result = await paymentService.createStripeSession('user-1', 1);

    expect(result).toEqual({
      sessionUrl: null,
      paymentId: 'pay-3',
      error: 'Stripe not configured',
    });
  });

  test('activateSubscription updates subscription and marks pending payments completed', async () => {
    prisma.subscription.update.mockResolvedValue({ userId: 'user-1' });
    prisma.payment.updateMany.mockResolvedValue({ count: 2 });
    prisma.$transaction.mockResolvedValue([{}, {}]);
    prisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      plan: 'pro',
    });

    const result = await paymentService.activateSubscription('user-1', 6);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        data: expect.objectContaining({
          plan: 'pro',
          autoRenew: false,
        }),
      })
    );
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'PENDING' },
      data: { status: 'COMPLETED' },
    });
    expect(result).toEqual({ userId: 'user-1', plan: 'pro' });
  });

  test('verifyPaymobWebhook validates HMAC and activates subscription on success', async () => {
    process.env.PAYMOB_HMAC_SECRET = 'secret-hmac';
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-4',
      userId: 'user-1',
      planMonths: 6,
    });
    prisma.subscription.update.mockResolvedValue({ userId: 'user-1' });
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockResolvedValue([{}, {}]);
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'user-1', plan: 'pro' });

    const webhook = {
      obj: {
        amount_cents: 2500,
        created_at: '2026-03-26T00:00:00Z',
        currency: 'USD',
        error_occured: false,
        has_parent_transaction: false,
        id: 4444,
        integration_id: 2222,
        is_3d_secure: false,
        is_auth: false,
        is_capture: false,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: 9999,
        owner: 1010,
        pending: false,
        source_data: { pan: '****1111', sub_type: 'MasterCard', type: 'card' },
        success: true,
      },
    };

    const concat = [
      webhook.obj.amount_cents,
      webhook.obj.created_at,
      webhook.obj.currency,
      webhook.obj.error_occured,
      webhook.obj.has_parent_transaction,
      webhook.obj.id,
      webhook.obj.integration_id,
      webhook.obj.is_3d_secure,
      webhook.obj.is_auth,
      webhook.obj.is_capture,
      webhook.obj.is_refunded,
      webhook.obj.is_standalone_payment,
      webhook.obj.is_voided,
      webhook.obj.order,
      webhook.obj.owner,
      webhook.obj.pending,
      webhook.obj.source_data.pan,
      webhook.obj.source_data.sub_type,
      webhook.obj.source_data.type,
      webhook.obj.success,
    ].join('');
    const hmac = crypto
      .createHmac('sha512', process.env.PAYMOB_HMAC_SECRET)
      .update(concat)
      .digest('hex');

    const result = await paymentService.verifyPaymobWebhook(webhook, hmac);

    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: { providerPaymentId: '9999', provider: 'PAYMOB' },
    });
    expect(prisma.subscription.update).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
