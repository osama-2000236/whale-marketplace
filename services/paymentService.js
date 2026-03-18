const prisma = require('../lib/prisma');
const axios = require('axios');
const crypto = require('crypto');

const PROVIDER = process.env.PAYMENT_PROVIDER || 'paymob';

// ─── PAYMOB ───────────────────────────────────────────────────────────────

async function paymobGetAuthToken() {
  const res = await axios.post('https://accept.paymob.com/api/auth/tokens', {
    api_key: process.env.PAYMOB_API_KEY
  });
  return res.data.token;
}

async function paymobCreateOrder(authToken, amountCents, internalPaymentId) {
  const res = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
    auth_token: authToken,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: 'EGP',
    merchant_order_id: internalPaymentId,
    items: [{ name: 'PC Gaming Pro', amount_cents: amountCents, quantity: 1 }]
  });
  return res.data.id;
}

async function paymobGetPaymentKey(authToken, paymobOrderId, amountCents, user) {
  const res = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
    auth_token: authToken,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: paymobOrderId,
    billing_data: {
      first_name: user.username || 'Player',
      last_name: 'PS',
      email: user.email || 'player@pcgaming.ps',
      phone_number: '+970000000000',
      apartment: 'NA',
      floor: 'NA',
      street: 'NA',
      building: 'NA',
      city: 'Tulkarem',
      country: 'PS',
      state: 'PS',
      postal_code: '00000'
    },
    currency: 'EGP',
    integration_id: parseInt(process.env.PAYMOB_INTEGRATION_ID, 10),
    lock_order_when_paid: false
  });
  return res.data.token;
}

/**
 * Full Paymob session: returns { iframeUrl }
 */
async function createPaymobSession(user, planMonths) {
  const priceNIS = parseInt(process.env.SUBSCRIPTION_PRICE_NIS || 20, 10) * planMonths;
  const priceEGP = parseInt(process.env.SUBSCRIPTION_PRICE_EGP || 170, 10) * planMonths;
  const amountCents = priceEGP * 100;

  // Create pending payment record first — use its ID as merchant_order_id
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      provider: 'paymob',
      amount: priceNIS,
      currency: 'NIS',
      status: 'pending',
      planMonths
    }
  });

  const authToken = await paymobGetAuthToken();
  const paymobOrderId = await paymobCreateOrder(authToken, amountCents, payment.id);

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerPaymentId: String(paymobOrderId) }
  });

  const paymentKey = await paymobGetPaymentKey(authToken, paymobOrderId, amountCents, user);
  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`;

  return { iframeUrl, paymentId: payment.id };
}

/**
 * Verify Paymob HMAC webhook signature.
 */
function verifyPaymobHmac(obj, receivedHmac) {
  const fields = [
    'amount_cents',
    'created_at',
    'currency',
    'error_occured',
    'has_parent_transaction',
    'id',
    'integration_id',
    'is_3d_secure',
    'is_auth',
    'is_capture',
    'is_refunded',
    'is_standalone_payment',
    'is_voided',
    'order',
    'owner',
    'pending',
    'source_data.pan',
    'source_data.sub_type',
    'source_data.type',
    'success'
  ];

  const str = fields
    .map((f) => {
      const val = f.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
      return val !== undefined ? String(val) : '';
    })
    .join('');

  const hmac = crypto.createHmac('sha512', process.env.PAYMOB_HMAC_SECRET || '').update(str).digest('hex');
  return hmac === receivedHmac;
}

// ─── PAYPAL ───────────────────────────────────────────────────────────────

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function paypalGetToken() {
  const res = await axios.post(
    `${PAYPAL_BASE}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_CLIENT_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );
  return res.data.access_token;
}

async function createPaypalOrder(user, planMonths) {
  const priceNIS = parseInt(process.env.SUBSCRIPTION_PRICE_NIS || 20, 10) * planMonths;
  const unitUSD = parseFloat(process.env.SUBSCRIPTION_PRICE_USD || 6);
  const priceUSD = (unitUSD * planMonths).toFixed(2);
  const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'http://localhost:3000';

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      provider: 'paypal',
      amount: priceNIS,
      currency: 'NIS',
      status: 'pending',
      planMonths
    }
  });

  const token = await paypalGetToken();
  const res = await axios.post(
    `${PAYPAL_BASE}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: payment.id,
          description: `PC Gaming Pro — ${planMonths} شهر / month`,
          amount: { currency_code: 'USD', value: priceUSD }
        }
      ],
      application_context: {
        return_url: `${baseUrl}/payment/paypal/success`,
        cancel_url: `${baseUrl}/payment/paypal/cancel`,
        brand_name: 'PC Gaming Tulkarem',
        user_action: 'PAY_NOW'
      }
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const approveUrl = res.data.links.find((l) => l.rel === 'approve').href;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerPaymentId: res.data.id }
  });

  return { approveUrl, paymentId: payment.id };
}

async function capturePaypalOrder(orderId) {
  const token = await paypalGetToken();
  const res = await axios.post(
    `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

// ─── SHARED ACTIVATION ───────────────────────────────────────────────────

/**
 * Activate Pro after successful payment.
 * Call this from both Paymob webhook and PayPal capture.
 */
async function activateSubscription(userId, planMonths, paymentId, rawData) {
  const now = new Date();
  const paidUntil = new Date(now);
  paidUntil.setMonth(paidUntil.getMonth() + planMonths);

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'success', metadata: rawData }
  });

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: 'pro', paidUntil, lastPaymentId: paymentId },
    update: { plan: 'pro', paidUntil, lastPaymentId: paymentId }
  });

  await prisma.notification
    .create({
      data: {
        userId,
        type: 'SYSTEM',
        message: `✅ تم تفعيل اشتراك Pro! الوصول حتى ${paidUntil.toLocaleDateString('ar-PS')} — Pro subscription activated! Valid until ${paidUntil.toLocaleDateString('en-GB')}`
      }
    })
    .catch(() => {});
}

/**
 * Admin manual activation (no payment required — cash/bank transfer).
 */
async function adminActivateManual(userId, planMonths, adminNote) {
  const now = new Date();
  const paidUntil = new Date(now);
  paidUntil.setMonth(paidUntil.getMonth() + planMonths);

  const payment = await prisma.payment.create({
    data: {
      userId,
      provider: 'manual',
      amount: parseInt(process.env.SUBSCRIPTION_PRICE_NIS || 20, 10) * planMonths,
      currency: 'NIS',
      status: 'success',
      planMonths,
      metadata: { note: adminNote, activatedBy: 'admin', activatedAt: now.toISOString() }
    }
  });

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: 'pro', paidUntil, lastPaymentId: payment.id },
    update: { plan: 'pro', paidUntil, lastPaymentId: payment.id }
  });

  await prisma.notification
    .create({
      data: {
        userId,
        type: 'SYSTEM',
        message: `✅ تم تفعيل اشتراك Pro يدوياً! — Pro manually activated by admin. Valid until ${paidUntil.toLocaleDateString('en-GB')}`
      }
    })
    .catch(() => {});

  return { paidUntil };
}

module.exports = {
  createPaymobSession,
  verifyPaymobHmac,
  createPaypalOrder,
  capturePaypalOrder,
  activateSubscription,
  adminActivateManual,
  PROVIDER
};
