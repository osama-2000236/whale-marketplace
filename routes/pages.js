const express = require('express');

const router = express.Router();

function renderPage(view, titleKey) {
  return (req, res, next) => {
    try {
      return res.render(view, { pageTitle: res.locals.t(titleKey) });
    } catch (error) {
      return next(error);
    }
  };
}

router.get('/about', renderPage('pages/about', 'about.title'));
router.get('/contact', renderPage('pages/contact', 'contact.title'));
router.get('/safety', renderPage('pages/safety', 'safety.title'));
router.get('/pricing', renderPage('pages/pricing', 'pricing.title'));
router.get('/forum', renderPage('pages/forum', 'nav.forum'));
router.get('/terms', renderPage('pages/terms', 'footer.terms'));
router.get('/privacy', renderPage('pages/privacy', 'footer.privacy'));
router.get('/buyer-protection', renderPage('pages/buyer-protection', 'legal.buyer_protection_title'));
router.get('/unsubscribe', renderPage('pages/unsubscribe', 'legal.unsubscribe_title'));

module.exports = router;
