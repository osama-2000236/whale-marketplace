const express = require('express');
const router = express.Router();

router.get('/welcome', (req, res) => {
  if (req.user) return res.redirect('/whale');
  if (req.query.ref) req.session.pendingRef = req.query.ref;
  res.render('welcome', { title: 'Welcome to Whale' });
});

module.exports = router;
