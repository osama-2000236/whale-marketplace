const express = require('express');
const router = express.Router();

const pages = [
  { path: '/about', view: 'pages/about', titleKey: 'about.title' },
  { path: '/contact', view: 'pages/contact', titleKey: 'contact.title' },
  { path: '/safety', view: 'pages/safety', titleKey: 'safety.title' },
  { path: '/pricing', view: 'pages/pricing', titleKey: 'pricing.title' },
  { path: '/terms', view: 'pages/terms', titleKey: 'terms.title' },
  { path: '/privacy', view: 'pages/privacy', titleKey: 'privacy.title' },
  { path: '/buyer-protection', view: 'pages/buyer-protection', titleKey: 'buyer_protection.title' },
  { path: '/unsubscribe', view: 'pages/unsubscribe', titleKey: 'unsubscribe.title' },
];

for (const page of pages) {
  router.get(page.path, (req, res) => {
    res.render(page.view, { title: res.locals.t(page.titleKey) });
  });
}

module.exports = router;
