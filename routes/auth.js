const router = require('express').Router();
const passport = require('../lib/passport');
const rateLimit = require('express-rate-limit');
const userService = require('../services/userService');
const { sanitizeBody } = require('../utils/sanitize');
const { safeRedirect } = require('../utils/safeRedirect');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts. Please try again later.',
});

// Login page
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/whale');
  res.render('auth/login', { title: res.locals.t('auth.login'), next: req.query.next || '/whale' });
});

// Login handler
router.post('/login', authLimiter, (req, res, next) => {
  const nextUrl = safeRedirect(req.body.next, '/whale');

  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      const errorKey = 'auth.error.' + (info?.message || 'USER_NOT_FOUND');
      req.session.flash = { type: 'danger', message: res.locals.t(errorKey) };
      return res.redirect('/auth/login');
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      req.session.flash = { type: 'success', message: res.locals.t('flash.login_success') };
      res.redirect(nextUrl);
    });
  })(req, res, next);
});

// Register page
router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/whale');
  res.render('auth/register', { title: res.locals.t('auth.register') });
});

// Register handler
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body, { username: 30, email: 255, password: 128 });

    const user = await userService.register(data);

    req.logIn(user, (err) => {
      if (err) return next(err);
      req.session.flash = { type: 'success', message: res.locals.t('flash.register_success') };
      res.redirect('/whale');
    });
  } catch (err) {
    const messages = {
      INVALID_USERNAME: 'Username must be 3-30 alphanumeric characters',
      INVALID_EMAIL: 'Invalid email address',
      WEAK_PASSWORD: 'Password must be at least 8 characters',
      EMAIL_TAKEN: 'Email already registered',
      USERNAME_TAKEN: 'Username already taken',
    };
    req.session.flash = { type: 'danger', message: messages[err.message] || err.message };
    res.redirect('/auth/register');
  }
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/login' }),
  (req, res) => {
    req.session.flash = { type: 'success', message: res.locals.t('flash.login_success') };
    res.redirect('/whale');
  }
);

// Facebook OAuth
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/auth/login' }),
  (req, res) => {
    req.session.flash = { type: 'success', message: res.locals.t('flash.login_success') };
    res.redirect('/whale');
  }
);

// Apple Sign In
router.get('/apple', passport.authenticate('apple'));

router.post(
  '/apple/callback',
  passport.authenticate('apple', { failureRedirect: '/auth/login' }),
  (req, res) => {
    req.session.flash = { type: 'success', message: res.locals.t('flash.login_success') };
    res.redirect('/whale');
  }
);

// Logout
router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

module.exports = router;
