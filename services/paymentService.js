const prisma = require('../lib/prisma');
const crypto = require('crypto');
const axios = require('axios');

const PROVIDER = process.env.PAYMENT_PROVIDER || 'paymob';

// ─── PAYMOB ──────────────────────────────────────────────────────────────────

async function paymobGetAuthToken() {
  const { data } = await axios.post('https://accept.paymob.com/api/auth/tokens', {
    api_key: process.env.PAYMOB_API_KEY,
  });
  return data.token;
}

async function paymobCreateOrder(authToken, amountCents, internalPaymentId) {
  const { data } = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
    auth_token: authToken,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: 'EGP',
    merchant_order_id: internalPaymentId,
    items: [],
  });
  return data.id;
}

async function paymobGetPaymentKey(authToken, paymobOrderId, amountCents, user) {
  const { data } = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
    auth_token: authToken,
    order_id: paymobOrderId,
    amount_cents: amountCents,
    currency: 'EGP',
    expiration: 3600,
    integration_id: parseInt(process.env.PAYMOB_INTEGRATION_ID, 10),
    billing_data: {
      first_name: user.username || 'Whale',
      last_name: 'User',
      email: user.email || 'customer@whale.ps',
      phone_number: '01000000000',
      apartment: 'NA', floor: 'NA', building: 'NA', street: 'NA',
      shipping_method: 'NA', postal_code: 'NA', city: 'NA', state: 'NA', country: 'PS',
    },
  });
  return data.token;
}

async function createPaymobSession(user, planMonths) {
  const priceEgp = parseInt(process.env.SUBSCRIPTION_PRICE_EGP || '170', 10) * planMonths;
  const amountCents = priceEgp * 100;

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      provider: 'paymob',
      amount: priceEgp,
      currency: 'EGP',
      planMonths,
      status: 'pending',
    },
  });

  const authToken = await paymobGetAuthToken();
  const paymobOrderId = await paymobCreateOrder(authToken, amountCents, payment.id);
  const paymentKey = await paymobGetPaymentKey(authToken, paymobOrderId, amountCents, user);

  const iframeId = process.env.PAYMOB_IFRAME_ID;
  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

  return { iframeUrl, paymentId: payment.id };
}

function verifyPaymobHmac(obj, receivedHmac) {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret) return false;

  const fields = [
    'amount_cents', 'created_at', 'currency', 'error_occured',
    'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
    'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
    'is_voided', 'order', 'owner', 'pending',
    'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
  ];

  const concatenated = fields.map((f) => {
    const keys = f.split('.');
    let val = obj;
    for (const k of keys) val = val?.[k];
    return String(val ?? '');
  }).join('');

  const computed = crypto.createHmac('sha512', secret).update(concatenated).digest('hex');
  return computed === receivedHmac;
}

// ─── PAYPAL ──────────────────────────────────────────────────────────────────

async function paypalGetToken() {
  const mode = process.env.PAYPAL_MODE === 'live' ? 'api-m' : 'api-m.sandbox';
  const { data } = await axios.post(
    `https://${mode}.paypal.com/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_CLIENT_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return data.access_token;
}

async function createPaypalOrder(user, planMonths) {
  const priceUsd = parseInt(process.env.SUBSCRIPTION_PRICE_USD || '6', 10) * planMonths;

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      provider: 'paypal',
      amount: priceUsd,
      currency: 'USD',
      planMonths,
      status: 'pending',
    },
  });

  const token = await paypalGetToken();
  const mode = process.env.PAYPAL_MODE === 'live' ? 'api-m' : 'api-m.sandbox';
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

  const { data } = await axios.post(
    `https://${mode}.paypal.com/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'USD', value: String(priceUsd) },
        custom_id: payment.id,
      }],
      application_context: {
        return_url: `${siteUrl}/payment/paypal/success`,
        cancel_url: `${siteUrl}/payment/paypal/cancel`,
      },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  const approveUrl = data.links.find((l) => l.rel === 'approve')?.href;
  return { approveUrl, paymentId: payment.id };
}

async function capturePaypalOrder(orderId) {
  const token = await paypalGetToken();
  const mode = process.env.PAYPAL_MODE === 'live' ? 'api-m' : 'api-m.sandbox';
  const { data } = await axios.post(
    `https://${mode}.paypal.com/v2/checkout/orders/${orderId}/capture`,
    {},
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return data;
}

// ─── SHARED ──────────────────────────────────────────────────────────────────

async function activateSubscription(userId, planMonths, paymentId, rawData) {
  const paidUntil = new Date();
  paidUntil.setMonth(paidUntil.getMonth() + planMonths);

  if (paymentId) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'success', metadata: rawData || null },
    });
  }

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: 'pro', paidUntil, lastPaymentId: paymentId },
    update: { plan: 'pro', paidUntil, lastPaymentId: paymentId },
  });

  await prisma.notification.create({
    data: { userId, type: 'SYSTEM', message: '🎉 تم تفعيل اشتراك Pro بنجاح!' },
  }).catch(() => {});
}

async function adminActivateManual(userId, planMonths, adminNote) {
  const paidUntil = new Date();
  paidUntil.setMonth(paidUntil.getMonth() + planMonths);

  const payment = await prisma.payment.create({
    data: {
      userId,
      provider: 'manual',
      amount: 0,
      currency: 'NIS',
      planMonths,
      status: 'success',
      metadata: { adminNote: adminNote || 'Manual activation' },
    },
  });

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: 'pro', paidUntil, lastPaymentId: payment.id },
    update: { plan: 'pro', paidUntil, lastPaymentId: payment.id },
  });

  return { paidUntil };
}

module.exports = {
  createPaymobSession, verifyPaymobHmac,
  createPaypalOrder, capturePaypalOrder,
  activateSubscription, adminActivateManual,
  PROVIDER,
};
