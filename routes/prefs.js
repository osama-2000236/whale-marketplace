const express = require('express');
const router = express.Router();

router.post('/lang', (req, res) => {
  const lang = req.body.lang;
  if (['ar', 'en'].includes(lang)) req.session.lang = lang;
  res.redirect('back');
});

router.post('/theme', (req, res) => {
  const theme = req.body.theme;
  if (['light', 'dark'].includes(theme)) req.session.theme = theme;
  res.redirect('back');
});

module.exports = router;
