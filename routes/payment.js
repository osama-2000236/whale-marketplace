const express = require('express');

const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const prisma = require('../lib/prisma');

// GET /upgrade — subscription upgrade page
router.get('/upgrade', async (req, res, next) => {
  try {
    let sub = null;
    let daysLeft = 0;

    if (req.session.userId) {
      sub = await prisma.subscription.findUnique({ where: { userId: req.session.userId } });
      if (sub) {
        const now = new Date();
        const expiry = sub.paidUntil || sub.trialEndsAt;
        if (expiry) {
          daysLeft = Math.max(0, Math.ceil((new Date(expiry) - now) / (1000 * 60 * 60 * 24)));
        }
      }
    }

    return res.render('payment/upgrade', {
      title: 'Upgrade to Pro',
      sub,
      daysLeft,
      reason: req.query.reason || null,
      error: req.query.error || null,
      cancelled: req.query.cancelled || null,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  } catch (error) {
    return next(error);
  }
});

// POST /payment/start — initiate payment (card via Paymob or PayPal)
router.post('/payment/start', requireAuth, async (req, res) => {
  const { planMonths = '1', provider } = req.body;
  const months = Math.min(parseInt(planMonths, 10) || 1, 12);
  const user = req.user;
  const useProvider = provider || paymentService.PROVIDER;

  try {
    if (useProvider === 'paymob') {
      const { iframeUrl } = await paymentService.createPaymobSession(user, months);
      return res.render('payment/paymob-iframe', {
        title: 'Paymob Checkout',
        iframeUrl
      });
    }

    const { approveUrl } = await paymentService.createPaypalOrder(user, months);
    return res.redirect(approveUrl);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Payment start error]', err.message);
    return res.redirect('/upgrade?error=payment_unavailable');
  }
});

// POST /webhooks/paymob — Paymob calls this after payment
router.post('/webhooks/paymob', express.json(), async (req, res) => {
  try {
    const hmac = req.query.hmac;
    const data = req.body && req.body.obj;

    if (!data || !paymentService.verifyPaymobHmac(data, hmac)) {
      return res.status(400).send('Invalid signature');
    }

    const internalPaymentId = data.order && data.order.merchant_order_id;
    if (!internalPaymentId) return res.status(200).send('OK');

    const payment = await prisma.payment.findUnique({ where: { id: internalPaymentId } });
    if (!payment) return res.status(200).send('OK');

    if (data.success === true) {
      await paymentService.activateSubscription(payment.userId, payment.planMonths, payment.id, data);
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', metadata: data }
      });
    }

    return res.status(200).send('OK');
  } catch (_error) {
    return res.status(200).send('OK');
  }
});

// GET /payment/paypal/success — PayPal redirects here after approval
router.get('/payment/paypal/success', requireAuth, async (req, res) => {
  const { token: orderId } = req.query;
  try {
    const capture = await paymentService.capturePaypalOrder(orderId);
    if (capture.status === 'COMPLETED') {
      const customId =
        capture.purchase_units &&
        capture.purchase_units[0] &&
        capture.purchase_units[0].payments &&
        capture.purchase_units[0].payments.captures &&
        capture.purchase_units[0].payments.captures[0] &&
        capture.purchase_units[0].payments.captures[0].custom_id;

      const orWhere = [{ providerPaymentId: String(orderId) }];
      if (customId) {
        orWhere.unshift({ id: customId });
      }

      const payment = await prisma.payment.findFirst({
        where: { OR: orWhere }
      });

      if (payment) {
        await paymentService.activateSubscription(payment.userId, payment.planMonths, payment.id, capture);
      }

      return res.redirect('/whale?success=pro_activated');
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PayPal capture error]', err.message);
  }

  return res.redirect('/upgrade?error=payment_failed');
});

router.get('/payment/paypal/cancel', requireAuth, (_req, res) => {
  return res.redirect('/upgrade?cancelled=1');
});

// GET /payment/history — user's payment history
router.get('/payment/history', requireAuth, async (req, res, next) => {
  try {
    const [payments, sub] = await Promise.all([
      prisma.payment.findMany({
        where: { userId: req.session.userId },
        orderBy: { createdAt: 'desc' },
        take: 24
      }),
      prisma.subscription.findUnique({ where: { userId: req.session.userId } })
    ]);

    return res.render('payment/history', {
      title: 'Payment History',
      payments,
      sub,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
