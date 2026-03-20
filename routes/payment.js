const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const prisma = require('../lib/prisma');

router.get('/upgrade', async (req, res) => {
  let sub = null;
  let daysLeft = 0;
  if (req.user?.id) {
    sub = await prisma.subscription.findUnique({ where: { userId: req.user.id } });
    if (sub) {
      const endDate = sub.paidUntil || sub.trialEndsAt;
      if (endDate) daysLeft = Math.max(0, Math.ceil((new Date(endDate) - Date.now()) / (1000 * 60 * 60 * 24)));
    }
  }
  res.render('payment/upgrade', {
    title: res.locals.t('pricing.title'),
    sub, daysLeft,
    reason: req.query.reason || null,
    error: req.query.error || null,
    cancelled: req.query.cancelled || null,
  });
});

router.post('/payment/start', requireAuth, async (req, res) => {
  try {
    const planMonths = Math.max(1, Math.min(12, parseInt(req.body.planMonths || '1', 10)));
    const provider = req.body.provider || paymentService.PROVIDER;

    if (provider === 'paypal') {
      const { approveUrl } = await paymentService.createPaypalOrder(req.user, planMonths);
      return res.redirect(approveUrl);
    }

    // Default: paymob
    const { iframeUrl } = await paymentService.createPaymobSession(req.user, planMonths);
    res.render('payment/paymob-iframe', { title: 'Payment', iframeUrl });
  } catch (e) {
    res.redirect('/upgrade?error=' + encodeURIComponent(e.message));
  }
});

router.post('/webhooks/paymob', async (req, res) => {
  try {
    const obj = req.body.obj || req.body;
    const hmac = req.query.hmac || req.body.hmac;

    if (!paymentService.verifyPaymobHmac(obj, hmac)) {
      return res.status(400).json({ error: 'Invalid HMAC' });
    }

    const merchantOrderId = obj.order?.merchant_order_id || obj.merchant_order_id;
    const isSuccess = obj.success === true || obj.success === 'true';

    if (merchantOrderId && isSuccess) {
      const payment = await prisma.payment.findUnique({ where: { id: merchantOrderId } });
      if (payment && payment.status === 'pending') {
        await paymentService.activateSubscription(payment.userId, payment.planMonths, payment.id, obj);
      }
    } else if (merchantOrderId) {
      await prisma.payment.update({ where: { id: merchantOrderId }, data: { status: 'failed' } }).catch(() => {});
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[Paymob Webhook Error]', e.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.get('/payment/paypal/success', requireAuth, async (req, res) => {
  try {
    const orderId = req.query.token;
    if (!orderId) return res.redirect('/upgrade?error=missing_token');

    const result = await paymentService.capturePaypalOrder(orderId);
    if (result.status === 'COMPLETED') {
      const customId = result.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id;
      if (customId) {
        const payment = await prisma.payment.findUnique({ where: { id: customId } });
        if (payment) {
          await paymentService.activateSubscription(payment.userId, payment.planMonths, payment.id, result);
        }
      }
    }
    res.redirect('/whale?upgraded=1');
  } catch (e) {
    res.redirect('/upgrade?error=' + encodeURIComponent(e.message));
  }
});

router.get('/payment/paypal/cancel', (req, res) => {
  res.redirect('/upgrade?cancelled=1');
});

router.get('/payment/history', requireAuth, async (req, res) => {
  const [payments, sub] = await Promise.all([
    prisma.payment.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 24 }),
    prisma.subscription.findUnique({ where: { userId: req.user.id } }),
  ]);
  res.render('payment/history', { title: res.locals.t('payment.history'), payments, sub });
});

module.exports = router;
