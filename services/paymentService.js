const prisma = require('../lib/prisma');
const crypto = require('crypto');

// Pricing tiers (USD)
const PLANS = {
  1: { price: 5, label: 'Monthly' },
  6: { price: 25, label: '6 Months' },
  12: { price: 45, label: 'Annual' },
};

function getPlanPrice(months) {
  return PLANS[months]?.price || PLANS[1].price;
}

async function createPaymobSession(userId, planMonths) {
  const price = getPlanPrice(planMonths);
  const idempotencyKey = crypto.randomUUID();

  const payment = await prisma.payment.create({
    data: {
      userId,
      provider: 'PAYMOB',
      amount: price,
      currency: 'USD',
      planMonths: parseInt(planMonths) || 1,
      idempotencyKey,
      status: 'PENDING',
    },
  });

  if (!process.env.PAYMOB_API_KEY) {
    return { iframeUrl: null, paymentId: payment.id, error: 'Paymob not configured' };
  }

  // Paymob integration: auth → order → payment key → iframe
  const axios = require('axios');
  const base = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com/api';

  const authRes = await axios.post(`${base}/auth/tokens`, { api_key: process.env.PAYMOB_API_KEY });
  const token = authRes.data.token;

  const orderRes = await axios.post(`${base}/ecommerce/orders`, {
    auth_token: token,
    delivery_needed: false,
    amount_cents: price * 100,
    currency: 'USD',
    items: [
      {
        name: `Whale Pro - ${PLANS[planMonths]?.label || 'Monthly'}`,
        amount_cents: price * 100,
        quantity: 1,
      },
    ],
  });

  const payKeyRes = await axios.post(`${base}/acceptance/payment_keys`, {
    auth_token: token,
    amount_cents: price * 100,
    expiration: 3600,
    order_id: orderRes.data.id,
    billing_data: {
      first_name: 'Whale',
      last_name: 'User',
      email: 'user@whale.ps',
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
    currency: 'USD',
    integration_id: process.env.PAYMOB_INTEGRATION_ID,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerPaymentId: String(orderRes.data.id) },
  });

  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${payKeyRes.data.token}`;

  return { iframeUrl, paymentId: payment.id };
}

async function createPaypalOrder(userId, planMonths) {
  const price = getPlanPrice(planMonths);
  const idempotencyKey = crypto.randomUUID();

  const payment = await prisma.payment.create({
    data: {
      userId,
      provider: 'PAYPAL',
      amount: price,
      currency: 'USD',
      planMonths: parseInt(planMonths) || 1,
      idempotencyKey,
      status: 'PENDING',
    },
  });

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return { approvalUrl: null, orderId: payment.id, error: 'PayPal not configured' };
  }

  const axios = require('axios');
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

  const orderRes = await axios.post(
    `${base}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: price.toFixed(2) },
          description: `Whale Pro - ${PLANS[planMonths]?.label || 'Monthly'}`,
        },
      ],
      application_context: {
        return_url: `${process.env.BASE_URL || 'http://localhost:3000'}/payment/success?paymentId=${payment.id}`,
        cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/upgrade`,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${tokenRes.data.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerPaymentId: orderRes.data.id },
  });

  const approvalUrl = orderRes.data.links.find((l) => l.rel === 'approve')?.href;

  return { approvalUrl, orderId: orderRes.data.id, paymentId: payment.id };
}

async function capturePaypalOrder(paypalOrderId) {
  const payment = await prisma.payment.findFirst({
    where: { providerPaymentId: paypalOrderId, provider: 'PAYPAL' },
  });
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');

  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    const axios = require('axios');
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
    await axios.post(
      `${base}/v2/checkout/orders/${paypalOrderId}/capture`,
      {},
      {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      }
    );
  }

  await activateSubscription(payment.userId, payment.planMonths);
  return { success: true, paymentId: payment.id };
}

// ── STRIPE (Visa / Mastercard / Debit) ──
async function createStripeSession(userId, planMonths) {
  const price = getPlanPrice(planMonths);
  const idempotencyKey = crypto.randomUUID();

  const payment = await prisma.payment.create({
    data: {
      userId,
      provider: 'STRIPE',
      amount: price,
      currency: 'USD',
      planMonths: parseInt(planMonths) || 1,
      idempotencyKey,
      status: 'PENDING',
    },
  });

  if (!process.env.STRIPE_SECRET_KEY) {
    return { sessionUrl: null, paymentId: payment.id, error: 'Stripe not configured' };
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `Whale Pro - ${PLANS[planMonths]?.label || 'Monthly'}` },
          unit_amount: price * 100,
        },
        quantity: 1,
      },
    ],
    metadata: { paymentId: payment.id, userId },
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&paymentId=${payment.id}`,
    cancel_url: `${baseUrl}/upgrade`,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerPaymentId: session.id },
  });

  return { sessionUrl: session.url, paymentId: payment.id };
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
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (payment && payment.status === 'PENDING') {
        await activateSubscription(payment.userId, payment.planMonths);
      }
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

  // Timing-safe comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader || ''))) {
    throw new Error('INVALID_HMAC');
  }

  if (data.success === true || data.success === 'true') {
    const payment = await prisma.payment.findFirst({
      where: { providerPaymentId: String(data.order), provider: 'PAYMOB' },
    });
    if (payment) {
      await activateSubscription(payment.userId, payment.planMonths);
    }
  }

  return { success: true };
}

async function activateSubscription(userId, planMonths) {
  const paidUntil = new Date();
  paidUntil.setMonth(paidUntil.getMonth() + (parseInt(planMonths) || 1));

  await prisma.$transaction([
    prisma.subscription.update({
      where: { userId },
      data: { plan: 'pro', paidUntil, autoRenew: false },
    }),
    prisma.payment.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'COMPLETED' },
    }),
  ]);

  return prisma.subscription.findUnique({ where: { userId } });
}

module.exports = {
  createPaymobSession,
  createPaypalOrder,
  capturePaypalOrder,
  createStripeSession,
  verifyStripeWebhook,
  verifyPaymobWebhook,
  activateSubscription,
  PLANS,
};
