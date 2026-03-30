const router = require('express').Router();
const { requireAuth, requireVerified } = require('../middleware/auth');
const paymentService = require('../services/paymentService');

function getPaymentRouteMessage(code) {
  return (
    {
      PAYMENT_PROVIDER_DISABLED: 'That payment method is not available right now.',
      PAYMENT_NOT_FOUND: 'We could not find that payment.',
      PAYMENT_MISMATCH: 'The payment confirmation did not match this session.',
      STRIPE_NOT_CONFIGURED: 'Stripe is not configured.',
      HMAC_NOT_CONFIGURED: 'Paymob is not configured.',
    }[code] || code || 'Unable to process payment right now.'
  );
}

router.get('/upgrade', requireAuth, (req, res) => {
  const providerAvailability = paymentService.getProviderAvailability();
  res.render('payment/upgrade', {
    title: res.locals.t('upgrade.title'),
    plans: paymentService.getPlans(),
    providerAvailability,
  });
});

router.post('/upgrade/paymob', requireAuth, requireVerified, async (req, res) => {
  try {
    const result = await paymentService.createPaymobSession(req.user.id, parseInt(req.body.planMonths) || 1);
    return res.redirect(result.iframeUrl);
  } catch (err) {
    req.session.flash = { type: 'danger', message: getPaymentRouteMessage(err.message) };
    return res.redirect('/upgrade');
  }
});

router.post('/upgrade/paypal', requireAuth, requireVerified, async (req, res) => {
  try {
    const result = await paymentService.createPaypalOrder(req.user.id, parseInt(req.body.planMonths) || 1);
    return res.redirect(result.approvalUrl);
  } catch (err) {
    req.session.flash = { type: 'danger', message: getPaymentRouteMessage(err.message) };
    return res.redirect('/upgrade');
  }
});

router.post('/upgrade/stripe', requireAuth, requireVerified, async (req, res) => {
  try {
    const result = await paymentService.createStripeSession(req.user.id, parseInt(req.body.planMonths) || 1);
    return res.redirect(result.sessionUrl);
  } catch (err) {
    req.session.flash = { type: 'danger', message: getPaymentRouteMessage(err.message) };
    return res.redirect('/upgrade');
  }
});

router.get('/payment/success', requireAuth, async (req, res, next) => {
  try {
    if (!req.query.paymentId) {
      return res.render('payment/success', {
        title: res.locals.t('payment.success'),
        purpose: 'SUBSCRIPTION',
        primaryHref: '/upgrade',
        primaryLabel: res.locals.t('nav.upgrade'),
        secondaryHref: '/whale',
        secondaryLabel: res.locals.t('nav.browse'),
      });
    }

    const payment = await paymentService.handleSuccessReturn({
      paymentId: req.query.paymentId,
      token: req.query.token,
      sessionId: req.query.session_id,
    });

    if (payment?.purpose === 'ORDER') {
      req.session.flash = {
        type: 'success',
        message: 'Payment completed successfully.',
      };
      return res.redirect(paymentService.getOrderRedirectPath(payment));
    }

    return res.render('payment/success', {
      title: res.locals.t('payment.success'),
      purpose: payment?.purpose || 'SUBSCRIPTION',
      primaryHref: '/whale/sell',
      primaryLabel: res.locals.t('nav.sell'),
      secondaryHref: '/whale',
      secondaryLabel: res.locals.t('nav.browse'),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/payment/cancel', requireAuth, async (req, res) => {
  if (!req.query.paymentId) {
    req.session.flash = { type: 'warning', message: 'Payment was cancelled.' };
    return res.redirect('/upgrade');
  }

  try {
    const payment = await paymentService.handleCancellationReturn(req.query.paymentId);
    req.session.flash = { type: 'warning', message: 'Payment was cancelled.' };
    return res.redirect(paymentService.getCancellationRedirectPath(payment));
  } catch (err) {
    req.session.flash = { type: 'danger', message: getPaymentRouteMessage(err.message) };
    return res.redirect('/upgrade');
  }
});

module.exports = router;
