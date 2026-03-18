const express = require('express');

const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /welcome — public landing page (QR code target)
router.get('/welcome', optionalAuth, (req, res) => {
  const ref = req.query.ref;

  if (ref) {
    req.session.pendingRef = String(ref).trim().toUpperCase();
  }

  if (req.user) return res.redirect('/whale');

  return res.render('welcome', {
    title: 'Whale | Join',
    ref: ref || req.session.pendingRef || null,
    csrfToken: req.csrfToken()
  });
});

module.exports = router;
