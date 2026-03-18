const express = require('express');

const router = express.Router();

router.post('/lang', (req, res) => {
  const { lang } = req.body;
  if (['ar', 'en'].includes(lang) && req.session) {
    req.session.lang = lang;
  }
  return res.redirect(req.get('Referer') || '/whale');
});

router.post('/theme', (req, res) => {
  const { theme } = req.body;
  if (['light', 'dark'].includes(theme) && req.session) {
    req.session.theme = theme;
  }
  return res.redirect(req.get('Referer') || '/whale');
});

module.exports = router;
