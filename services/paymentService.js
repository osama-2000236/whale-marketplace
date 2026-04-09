const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../lib/prisma');

const ORDER_PAYMENT_STATUS = {
  pending: 'pending',
  paid: 'paid',
  failed: 'failed',
  refunded: 'refunded',
};

function getPlans() {
  return {
    1: { price: Number(process.env.PRO_MONTHLY_PRICE || 5), label: 'Monthly' },
    6: { price: Number(process.env.PRO_SEMIANNUAL_PRICE || 25), label: '6 Months' },
    12: { price: Number(process.env.PRO_ANNUAL_PRICE || 45), label: 'Annual' },
  };
}

const PLANS = getPlans();

function getPlanPrice(months) {
  const normalizedMonths = [1, 6, 12].includes(Number(months)) ? Number(months) : 1;
  return getPlans()[normalizedMonths].price;
}

function getPlanLabel(months) {
  const normalizedMonths = [1, 6, 12].includes(Number(months)) ? Number(months) : 1;
  return getPlans()[normalizedMonths].label;
}

function getBaseUrl() {
  return process.env.BASE_URL || 'http://localhost:3000';
}

function getProviderAvailability() {
  if (!process.env.DATABASE_URL) {
    return {
      paymob: false,
      paypal: false,
      stripe: false,
    };
  }

  return {
    paymob: Boolean(process.env.PAYMOB_API_KEY && process.env.PAYMOB_INTEGRATION_ID && process.env.PAYMOB_IFRAME_ID),
    paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  };
}

function normalizeProvider(provider) {
  return String(provider || '').trim().toLowerCase();
}

function providerToEnum(provider) {
  return normalizeProvider(provider).toUpperCase();
}

function mergePaymentMetadata(currentMetadata, patch) {
  return {
    ...(currentMetadata || {}),
    ...(patch || {}),
    providerRefs: {
      ...((currentMetadata && currentMetadata.providerRefs) || {}),
      ...((patch && patch.providerRefs) || {}),
    },
  };
}

function ensureProviderConfigured(provider) {
  const availability = getProviderAvailability();
  if (!availability[normalizeProvider(provider)]) {
    throw new Error('PAYMENT_PROVIDER_DISABLED');
  }
}

async function findPaymentByProviderPaymentId(provider, providerPaymentId) {
  return prisma.payment.findFirst({
    where: {
      provider: providerToEnum(provider),
      providerPaymentId: String(providerPaymentId),
    },
  });
}

async function createPaymentRecord({
  userId,
  purpose,
  provider,
  amount,
  currency = 'USD',
  planMonths = 1,
  metadata = {},
}) {
  return prisma.payment.create({
    data: {
      userId,
      purpose,
      provider: providerToEnum(provider),
      amount: Number(amount).toFixed(2),
      currency,
      planMonths: Number(planMonths) || 1,
      idempotencyKey: crypto.randomUUID(),
      status: 'PENDING',
      metadata,
    },
  });
}

async function markPaymentFailedOnly(paymentId, reason) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'PENDING') return payment;

  const metadata = mergePaymentMetadata(payment.metadata, { failureReason: reason || null });
  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'FAILED', metadata },
  });
}

async function getUserBillingIdentity(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, username: true },
  });
}

async function startPaymobCheckout(payment, { description, email }) {
  ensureProviderConfigured('paymob');

  const base = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com/api';

  const authRes = await axios.post(`${base}/auth/tokens`, { api_key: process.env.PAYMOB_API_KEY });
  const token = authRes.data.token;

  const orderRes = await axios.post(`${base}/ecommerce/orders`, {
    auth_token: token,
    delivery_needed: false,
    amount_cents: Math.round(Number(payment.amount) * 100),
    currency: payment.currency,
    items: [
      {
        name: description,
        amount_cents: Math.round(Number(payment.amount) * 100),
        quantity: 1,
      },
    ],
  });

  const payKeyRes = await axios.post(`${base}/acceptance/payment_keys`, {
    auth_token: token,
    amount_cents: Math.round(Number(payment.amount) * 100),
    expiration: 3600,
    order_id: orderRes.data.id,
    billing_data: {
      first_name: 'Whale',
      last_name: 'User',
      email: email || 'user@whale.ps',
      phone_number: '0000',
      street: 'N/A',
      city: 'N/A',
      country: 'PS',
      state: 'N/A',
      building: 'N/A',
      floor: 'N/A',
      apartment: 'N/A',
      shipping_method: 'N/A',
      postal_code: 'N/A',
    },
    currency: payment.currency,
    integration_id: process.env.PAYMOB_INTEGRATION_ID,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentId: String(orderRes.data.id),
      metadata: mergePaymentMetadata(payment.metadata, {
        providerRefs: { paymobOrderId: String(orderRes.data.id) },
      }),
    },
  });

  return {
    redirectUrl: `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${payKeyRes.data.token}`,
    providerPaymentId: String(orderRes.data.id),
  };
}

async function getPaypalAccessToken() {
  const mode = process.env.PAYPAL_MODE === 'live' ? 'api-m' : 'api-m.sandbox';
  const base = `https://${mode}.paypal.com`;
  const authStr = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const tokenRes = await axios.post(`${base}/v1/oauth2/token`, 'grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${authStr}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return { base, accessToken: tokenRes.data.access_token };
}

/**
 * Verify a PayPal webhook notification signature via the PayPal REST API.
 * @param {Object} verificationPayload - Contains auth_algo, cert_url, transmission_id, transmission_sig, transmission_time, webhook_id, webhook_event
 * @throws {Error} If verification fails or returns FAILURE
 */
async function verifyPaypalWebhook(verificationPayload) {
  const { base, accessToken } = await getPaypalAccessToken();
  const verifyRes = await axios.post(
    `${base}/v1/notifications/verify-webhook-signature`,
    verificationPayload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (verifyRes.data.verification_status !== 'SUCCESS') {
    throw new Error('PAYPAL_WEBHOOK_SIGNATURE_INVALID');
  }
}

async function startPaypalCheckout(payment, { description }) {
  ensureProviderConfigured('paypal');

  const { base, accessToken } = await getPaypalAccessToken();
  const orderRes = await axios.post(
    `${base}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: payment.currency, value: Number(payment.amount).toFixed(2) },
          description,
        },
      ],
      application_context: {
        return_url: `${getBaseUrl()}/payment/success?paymentId=${payment.id}`,
        cancel_url: `${getBaseUrl()}/payment/cancel?paymentId=${payment.id}`,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentId: orderRes.data.id,
      metadata: mergePaymentMetadata(payment.metadata, {
        providerRefs: { paypalOrderId: orderRes.data.id },
      }),
    },
  });

  const approvalUrl = orderRes.data.links.find((link) => link.rel === 'approve')?.href;
  return { redirectUrl: approvalUrl, providerPaymentId: orderRes.data.id };
}

async function startStripeCheckout(payment, { description }) {
  ensureProviderConfigured('stripe');

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: payment.currency.toLowerCase(),
          product_data: { name: description },
          unit_amount: Math.round(Number(payment.amount) * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      paymentId: payment.id,
      purpose: payment.purpose,
    },
    success_url: `${getBaseUrl()}/payment/success?paymentId=${payment.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getBaseUrl()}/payment/cancel?paymentId=${payment.id}`,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentId: session.id,
      metadata: mergePaymentMetadata(payment.metadata, {
        providerRefs: { stripeSessionId: session.id },
      }),
    },
  });

  return { redirectUrl: session.url, providerPaymentId: session.id };
}

async function createSubscriptionSession(provider, userId, planMonths) {
  ensureProviderConfigured(provider);

  const months = [1, 6, 12].includes(Number(planMonths)) ? Number(planMonths) : 1;
  const payment = await createPaymentRecord({
    userId,
    purpose: 'SUBSCRIPTION',
    provider,
    amount: getPlanPrice(months),
    planMonths: months,
    metadata: {
      flow: 'subscription',
      planLabel: getPlanLabel(months),
    },
  });

  try {
    const user = await getUserBillingIdentity(userId);
    const description = `Whale Pro - ${getPlanLabel(months)}`;

    if (normalizeProvider(provider) === 'paymob') {
      const result = await startPaymobCheckout(payment, { description, email: user?.email });
      return { iframeUrl: result.redirectUrl, paymentId: payment.id };
    }
    if (normalizeProvider(provider) === 'paypal') {
      const result = await startPaypalCheckout(payment, { description });
      return { approvalUrl: result.redirectUrl, paymentId: payment.id, orderId: result.providerPaymentId };
    }

    const result = await startStripeCheckout(payment, { description });
    return { sessionUrl: result.redirectUrl, paymentId: payment.id };
  } catch (err) {
    await markPaymentFailedOnly(payment.id, 'PAYMENT_SETUP_FAILED');
    throw err;
  }
}

async function createPaymobSession(userId, planMonths) {
  return createSubscriptionSession('paymob', userId, planMonths);
}

async function createPaypalOrder(userId, planMonths) {
  return createSubscriptionSession('paypal', userId, planMonths);
}

async function createStripeSession(userId, planMonths) {
  return createSubscriptionSession('stripe', userId, planMonths);
}

async function createOrderPaymentSession(
  provider,
  { userId, orderIds, amount, currency = 'USD', flow, cartSnapshot, shippingAddress, listingId }
) {
  ensureProviderConfigured(provider);

  const payment = await createPaymentRecord({
    userId,
    purpose: 'ORDER',
    provider,
    amount,
    currency,
    metadata: {
      orderIds,
      flow,
      cartSnapshot: cartSnapshot || null,
      shippingAddress: shippingAddress || null,
      listingId: listingId || null,
    },
  });

  try {
    const user = await getUserBillingIdentity(userId);
    const description =
      flow === 'cart'
        ? `Whale Marketplace Cart (${orderIds.length} orders)`
        : 'Whale Marketplace Order';

    if (normalizeProvider(provider) === 'paymob') {
      const result = await startPaymobCheckout(payment, { description, email: user?.email });
      return { redirectUrl: result.redirectUrl, paymentId: payment.id };
    }
    if (normalizeProvider(provider) === 'paypal') {
      const result = await startPaypalCheckout(payment, { description });
      return { redirectUrl: result.redirectUrl, paymentId: payment.id };
    }

    const result = await startStripeCheckout(payment, { description });
    return { redirectUrl: result.redirectUrl, paymentId: payment.id };
  } catch (err) {
    await settlePaymentFailure(payment.id, { reason: 'PAYMENT_SETUP_FAILED' });
    throw err;
  }
}

async function extendSubscriptionForPayment(payment) {
  const subscription = await prisma.subscription.findUnique({ where: { userId: payment.userId } });
  const now = new Date();
  const currentEnd =
    subscription?.paidUntil && subscription.paidUntil > now ? new Date(subscription.paidUntil) : now;

  currentEnd.setMonth(currentEnd.getMonth() + (Number(payment.planMonths) || 1));

  await prisma.$transaction([
    prisma.subscription.update({
      where: { userId: payment.userId },
      data: { plan: 'pro', paidUntil: currentEnd, autoRenew: false },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED' },
    }),
  ]);

  return prisma.subscription.findUnique({ where: { userId: payment.userId } });
}

async function settleOrderPayment(payment) {
  const metadata = payment.metadata || {};
  const orderIds = Array.isArray(metadata.orderIds) ? metadata.orderIds : [];
  if (orderIds.length === 0) throw new Error('PAYMENT_ORDERS_MISSING');

  await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: { id: { in: orderIds } },
    });
    if (orders.length !== orderIds.length) throw new Error('ORDER_NOT_FOUND');

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED' },
    });

    for (const order of orders) {
      if (order.paymentStatus === ORDER_PAYMENT_STATUS.paid) continue;
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: ORDER_PAYMENT_STATUS.paid,
          events: {
            create: {
              event: 'payment_captured',
              note: `${payment.provider} payment confirmed`,
            },
          },
        },
      });
    }
  });

  return prisma.payment.findUnique({ where: { id: payment.id } });
}

async function restoreCartSnapshot(userId, snapshot) {
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  if (items.length === 0) return;

  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId } });
  }

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  for (const item of items) {
    const listing = await prisma.listing.findUnique({ where: { id: item.listingId } });
    if (!listing || listing.status !== 'ACTIVE' || listing.stock < 1) continue;

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        listingId: item.listingId,
        quantity: Math.max(1, Math.min(Number(item.quantity) || 1, listing.stock)),
      },
    });
  }
}

async function settlePaymentSuccess(paymentId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.status === 'COMPLETED') return payment;
  if (payment.status !== 'PENDING') return payment;

  if (payment.purpose === 'SUBSCRIPTION') {
    await extendSubscriptionForPayment(payment);
  } else {
    await settleOrderPayment(payment);
  }

  return prisma.payment.findUnique({ where: { id: paymentId } });
}

async function settlePaymentFailure(paymentId, { reason } = {}) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.status !== 'PENDING') return payment;

  const metadata = mergePaymentMetadata(payment.metadata, { failureReason: reason || null });

  if (payment.purpose === 'SUBSCRIPTION') {
    return prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', metadata },
    });
  }

  const orderIds = Array.isArray(payment.metadata?.orderIds) ? payment.metadata.orderIds : [];

  await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: { id: { in: orderIds } },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', metadata },
    });

    for (const order of orders) {
      if (order.status === 'CANCELLED' && order.paymentStatus === ORDER_PAYMENT_STATUS.failed) {
        continue;
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: ORDER_PAYMENT_STATUS.failed,
          cancelReason: order.cancelReason || 'Payment failed or was cancelled.',
          events: {
            create: {
              event: 'payment_failed',
              note: reason || 'Payment failed or was cancelled.',
            },
          },
        },
      });

      await tx.listing.update({
        where: { id: order.listingId },
        data: { stock: { increment: order.quantity } },
      });
    }
  });

  if (payment.metadata?.flow === 'cart' && payment.metadata?.cartSnapshot) {
    await restoreCartSnapshot(payment.userId, payment.metadata.cartSnapshot);
  }

  return prisma.payment.findUnique({ where: { id: payment.id } });
}

async function capturePaypalOrder(paypalOrderId) {
  const payment = await findPaymentByProviderPaymentId('paypal', paypalOrderId);
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.status === 'COMPLETED') return { success: true, paymentId: payment.id };

  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    const { base, accessToken } = await getPaypalAccessToken();
    await axios.post(
      `${base}/v2/checkout/orders/${paypalOrderId}/capture`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  }

  await settlePaymentSuccess(payment.id);
  return { success: true, paymentId: payment.id };
}

async function confirmStripeSession(sessionId, paymentId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.status === 'COMPLETED') return payment;
  if (!process.env.STRIPE_SECRET_KEY) return payment;

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.paymentId !== paymentId) {
    throw new Error('PAYMENT_MISMATCH');
  }

  if (session.payment_status === 'paid') {
    await settlePaymentSuccess(paymentId);
  }

  return prisma.payment.findUnique({ where: { id: paymentId } });
}

async function verifyStripeWebhook(rawBody, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_NOT_CONFIGURED');
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      await settlePaymentSuccess(paymentId);
    }
  }

  if (['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type)) {
    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      await settlePaymentFailure(paymentId, { reason: event.type });
    }
  }

  return { received: true };
}

async function verifyPaymobWebhook(body, hmacHeader) {
  if (!process.env.PAYMOB_HMAC_SECRET) throw new Error('HMAC_NOT_CONFIGURED');

  const data = body.obj;
  const concat = [
    data.amount_cents,
    data.created_at,
    data.currency,
    data.error_occured,
    data.has_parent_transaction,
    data.id,
    data.integration_id,
    data.is_3d_secure,
    data.is_auth,
    data.is_capture,
    data.is_refunded,
    data.is_standalone_payment,
    data.is_voided,
    data.order,
    data.owner,
    data.pending,
    data.source_data?.pan,
    data.source_data?.sub_type,
    data.source_data?.type,
    data.success,
  ].join('');

  const hash = crypto
    .createHmac('sha512', process.env.PAYMOB_HMAC_SECRET)
    .update(concat)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader || ''))) {
    throw new Error('INVALID_HMAC');
  }

  const payment = await findPaymentByProviderPaymentId('paymob', data.order);
  if (!payment) return { success: true };

  if (data.success === true || data.success === 'true') {
    await settlePaymentSuccess(payment.id);
  } else {
    await settlePaymentFailure(payment.id, { reason: 'PAYMOB_PAYMENT_FAILED' });
  }

  return { success: true };
}

async function handleSuccessReturn({ paymentId, token, sessionId }) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');

  if (payment.provider === 'PAYPAL' && token && payment.status === 'PENDING') {
    await capturePaypalOrder(token);
  } else if (payment.provider === 'STRIPE' && sessionId && payment.status === 'PENDING') {
    await confirmStripeSession(sessionId, paymentId);
  }

  return prisma.payment.findUnique({ where: { id: paymentId } });
}

async function handleCancellationReturn(paymentId) {
  return settlePaymentFailure(paymentId, { reason: 'USER_CANCELLED' });
}

async function getPaymentById(paymentId) {
  if (!paymentId) return null;
  return prisma.payment.findUnique({ where: { id: paymentId } });
}

function getOrderRedirectPath(payment) {
  const metadata = payment?.metadata || {};
  const orderIds = Array.isArray(metadata.orderIds) ? metadata.orderIds : [];

  if (metadata.flow === 'cart') {
    return '/whale/orders?tab=buying';
  }

  if (orderIds.length === 1) {
    return `/whale/orders/${orderIds[0]}`;
  }

  return '/whale/orders?tab=buying';
}

function getCancellationRedirectPath(payment) {
  const metadata = payment?.metadata || {};
  if (payment?.purpose !== 'ORDER') return '/upgrade';
  if (metadata.flow === 'cart') return '/cart';
  if (metadata.listingId) return `/whale/checkout/${metadata.listingId}`;
  return '/whale/orders?tab=buying';
}

module.exports = {
  ORDER_PAYMENT_STATUS,
  PLANS,
  getPlans,
  getPlanPrice,
  getProviderAvailability,
  createPaymobSession,
  createPaypalOrder,
  capturePaypalOrder,
  createStripeSession,
  createOrderPaymentSession,
  verifyStripeWebhook,
  verifyPaymobWebhook,
  verifyPaypalWebhook,
  settlePaymentSuccess,
  settlePaymentFailure,
  handleSuccessReturn,
  handleCancellationReturn,
  getPaymentById,
  getPaymentByProviderPaymentId: findPaymentByProviderPaymentId,
  getOrderRedirectPath,
  getCancellationRedirectPath,
};
