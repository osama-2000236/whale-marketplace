const crypto = require('crypto');

jest.mock('axios', () => ({
  post: jest.fn(),
}));

jest.mock('../lib/prisma', () => {
  const prisma = {
    payment: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    subscription: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    listing: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    cart: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  prisma.$transaction = jest.fn((input) => {
    if (typeof input === 'function') {
      return input(prisma);
    }
    return Promise.all(input);
  });

  return prisma;
});

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

  test('getProviderAvailability reflects configured providers', () => {
    process.env.DATABASE_URL = 'postgresql://test/db';
    process.env.PAYMOB_API_KEY = 'key';
    process.env.PAYMOB_INTEGRATION_ID = 'integration';
    process.env.PAYMOB_IFRAME_ID = 'iframe';
    process.env.PAYPAL_CLIENT_ID = 'paypal-id';
    process.env.PAYPAL_CLIENT_SECRET = 'paypal-secret';
    process.env.STRIPE_SECRET_KEY = 'stripe-secret';

    expect(paymentService.getProviderAvailability()).toEqual({
      paymob: true,
      paypal: true,
      stripe: true,
    });
  });

  test('createPaymobSession throws when Paymob is not configured', async () => {
    delete process.env.PAYMOB_API_KEY;
    delete process.env.PAYMOB_INTEGRATION_ID;
    delete process.env.PAYMOB_IFRAME_ID;

    await expect(paymentService.createPaymobSession('user-1', 6)).rejects.toThrow(
      'PAYMENT_PROVIDER_DISABLED',
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  test('createOrderPaymentSession throws when the hosted provider is disabled', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    await expect(
      paymentService.createOrderPaymentSession('stripe', {
        userId: 'user-1',
        orderIds: ['order-1'],
        amount: '25.00',
        currency: 'USD',
        flow: 'single',
        listingId: 'listing-1',
      }),
    ).rejects.toThrow('PAYMENT_PROVIDER_DISABLED');

    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  test('settlePaymentSuccess completes only the targeted subscription payment', async () => {
    prisma.payment.findUnique
      .mockResolvedValueOnce({
        id: 'pay-sub-1',
        userId: 'user-1',
        purpose: 'SUBSCRIPTION',
        planMonths: 6,
        status: 'PENDING',
      })
      .mockResolvedValueOnce({
        id: 'pay-sub-1',
        userId: 'user-1',
        purpose: 'SUBSCRIPTION',
        status: 'COMPLETED',
      });
    prisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      plan: 'free',
      paidUntil: null,
    });
    prisma.subscription.update.mockResolvedValue({ userId: 'user-1', plan: 'pro' });
    prisma.payment.update.mockResolvedValue({ id: 'pay-sub-1', status: 'COMPLETED' });

    const result = await paymentService.settlePaymentSuccess('pay-sub-1');

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: expect.objectContaining({
        plan: 'pro',
        paidUntil: expect.any(Date),
        autoRenew: false,
      }),
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-sub-1' },
      data: { status: 'COMPLETED' },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'pay-sub-1',
        status: 'COMPLETED',
      }),
    );
  });

  test('settlePaymentFailure cancels targeted order payments, restocks inventory, and restores the cart', async () => {
    prisma.payment.findUnique
      .mockResolvedValueOnce({
        id: 'pay-order-1',
        userId: 'buyer-1',
        purpose: 'ORDER',
        status: 'PENDING',
        metadata: {
          orderIds: ['order-1'],
          flow: 'cart',
          cartSnapshot: {
            items: [{ listingId: 'listing-1', quantity: 2 }],
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'pay-order-1',
        userId: 'buyer-1',
        purpose: 'ORDER',
        status: 'FAILED',
      });
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        listingId: 'listing-1',
        quantity: 2,
        status: 'PENDING',
        paymentStatus: 'pending',
        cancelReason: null,
      },
    ]);
    prisma.payment.update.mockResolvedValue({ id: 'pay-order-1', status: 'FAILED' });
    prisma.order.update.mockResolvedValue({ id: 'order-1', status: 'CANCELLED' });
    prisma.listing.update.mockResolvedValue({});
    prisma.cart.findUnique.mockResolvedValue({ id: 'cart-1', userId: 'buyer-1' });
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      status: 'ACTIVE',
      stock: 5,
    });
    prisma.cartItem.create.mockResolvedValue({});

    const result = await paymentService.settlePaymentFailure('pay-order-1', {
      reason: 'USER_CANCELLED',
    });

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-order-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        metadata: expect.objectContaining({
          failureReason: 'USER_CANCELLED',
        }),
      }),
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'CANCELLED',
        paymentStatus: paymentService.ORDER_PAYMENT_STATUS.failed,
        cancelReason: 'Payment failed or was cancelled.',
      }),
    });
    expect(prisma.listing.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'listing-1' },
      data: { stock: { increment: 2 } },
    });
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 'cart-1' } });
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: {
        cartId: 'cart-1',
        listingId: 'listing-1',
        quantity: 2,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'pay-order-1',
        status: 'FAILED',
      }),
    );
  });

  test('verifyPaymobWebhook validates HMAC and settles the targeted payment', async () => {
    process.env.PAYMOB_HMAC_SECRET = 'secret-hmac';
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-4',
      provider: 'PAYMOB',
      providerPaymentId: '9999',
    });
    prisma.payment.findUnique
      .mockResolvedValueOnce({
        id: 'pay-4',
        userId: 'user-1',
        purpose: 'SUBSCRIPTION',
        planMonths: 6,
        status: 'PENDING',
      })
      .mockResolvedValueOnce({
        id: 'pay-4',
        userId: 'user-1',
        purpose: 'SUBSCRIPTION',
        status: 'COMPLETED',
      });
    prisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      plan: 'free',
      paidUntil: null,
    });
    prisma.subscription.update.mockResolvedValue({ userId: 'user-1', plan: 'pro' });
    prisma.payment.update.mockResolvedValue({ id: 'pay-4', status: 'COMPLETED' });

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
      where: { provider: 'PAYMOB', providerPaymentId: '9999' },
    });
    expect(prisma.subscription.update).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  test('redirect helpers stay purpose-aware for order payments', () => {
    expect(
      paymentService.getOrderRedirectPath({
        purpose: 'ORDER',
        metadata: { flow: 'single', orderIds: ['order-1'] },
      }),
    ).toBe('/whale/orders/order-1');

    expect(
      paymentService.getCancellationRedirectPath({
        purpose: 'ORDER',
        metadata: { flow: 'cart', orderIds: ['order-1', 'order-2'] },
      }),
    ).toBe('/cart');

    expect(
      paymentService.getCancellationRedirectPath({
        purpose: 'SUBSCRIPTION',
        metadata: {},
      }),
    ).toBe('/upgrade');
  });
});
