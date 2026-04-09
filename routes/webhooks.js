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
// SEC-01: Verify PayPal webhook signature before processing events
router.post('/paypal', async (req, res) => {
  try {
    // Verify webhook signature with PayPal API
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.error('[webhook/paypal] PAYPAL_WEBHOOK_ID not configured — rejecting unverified webhook');
      return res.status(503).json({ error: 'Webhook verification not configured' });
    }

    const verificationPayload = {
      auth_algo: req.headers['paypal-auth-algo'],
      cert_url: req.headers['paypal-cert-url'],
      transmission_id: req.headers['paypal-transmission-id'],
      transmission_sig: req.headers['paypal-transmission-sig'],
      transmission_time: req.headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: req.body,
    };

    // All PayPal webhook headers must be present
    if (
      !verificationPayload.auth_algo ||
      !verificationPayload.cert_url ||
      !verificationPayload.transmission_id ||
      !verificationPayload.transmission_sig ||
      !verificationPayload.transmission_time
    ) {
      console.error('[webhook/paypal] Missing PayPal signature headers');
      return res.status(400).json({ error: 'Missing PayPal signature headers' });
    }

    // Verify with PayPal's API
    await paymentService.verifyPaypalWebhook(verificationPayload);

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
