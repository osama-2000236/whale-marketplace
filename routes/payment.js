const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const paymentService = require('../services/paymentService');

// Upgrade page
router.get('/upgrade', requireAuth, (req, res) => {
  res.render('payment/upgrade', {
    title: res.locals.t('upgrade.title'),
    plans: paymentService.PLANS,
  });
});

// Paymob checkout
router.post('/upgrade/paymob', requireAuth, async (req, res, next) => {
  try {
    const { planMonths } = req.body;
    const result = await paymentService.createPaymobSession(req.user.id, parseInt(planMonths) || 1);
    if (result.error) {
      req.session.flash = { type: 'warning', message: result.error };
      return res.redirect('/upgrade');
    }
    res.redirect(result.iframeUrl);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/upgrade');
  }
});

// PayPal checkout
router.post('/upgrade/paypal', requireAuth, async (req, res, next) => {
  try {
    const { planMonths } = req.body;
    const result = await paymentService.createPaypalOrder(req.user.id, parseInt(planMonths) || 1);
    if (result.error) {
      req.session.flash = { type: 'warning', message: result.error };
      return res.redirect('/upgrade');
    }
    res.redirect(result.approvalUrl);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/upgrade');
  }
});

// Stripe checkout (Visa / Mastercard)
router.post('/upgrade/stripe', requireAuth, async (req, res, next) => {
  try {
    const { planMonths } = req.body;
    const result = await paymentService.createStripeSession(req.user.id, parseInt(planMonths) || 1);
    if (result.error) {
      req.session.flash = { type: 'warning', message: result.error };
      return res.redirect('/upgrade');
    }
    res.redirect(result.sessionUrl);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/upgrade');
  }
});

// Success page
router.get('/payment/success', requireAuth, async (req, res, next) => {
  try {
    // If PayPal, capture the order
    if (req.query.token) {
      await paymentService.capturePaypalOrder(req.query.token).catch(() => {});
    }
    res.render('payment/success', { title: res.locals.t('payment.success') });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
