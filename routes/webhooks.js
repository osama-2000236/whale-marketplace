const router = require('express').Router();
const paymentService = require('../services/paymentService');

// Paymob webhook (no CSRF — excluded in server.js)
router.post('/paymob', async (req, res) => {
  try {
    const hmac = req.query.hmac || req.headers['x-hmac'];
    await paymentService.verifyPaymobWebhook(req.body, hmac);
    res.json({ success: true });
  } catch (err) {
    console.error('[webhook/paymob]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// PayPal webhook (no CSRF — excluded in server.js)
router.post('/paypal', async (req, res) => {
  try {
    const event = req.body;
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource?.id;
      if (orderId) {
        await paymentService.capturePaypalOrder(orderId);
      }
    }
    if (['PAYMENT.CAPTURE.DENIED', 'CHECKOUT.ORDER.VOIDED'].includes(event.event_type)) {
      const orderId =
        event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id;
      if (orderId) {
        const payment = await paymentService.getPaymentByProviderPaymentId('paypal', orderId);
        if (payment?.id) {
          await paymentService.settlePaymentFailure(payment.id, { reason: event.event_type });
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[webhook/paypal]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Stripe webhook (needs raw body — see server.js rawBody middleware)
router.post('/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const rawBody = req.rawBody;
    if (!rawBody || !signature) {
      return res.status(400).json({ error: 'Missing body or signature' });
    }
    await paymentService.verifyStripeWebhook(rawBody, signature);
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook/stripe]', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
