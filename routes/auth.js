const router = require('express').Router();
const passport = require('../lib/passport');
const rateLimit = require('express-rate-limit');
const userService = require('../services/userService');
const authSecurityService = require('../services/authSecurityService');
const { sanitizeBody } = require('../utils/sanitize');
const { safeRedirect } = require('../utils/safeRedirect');

function getOAuthViewFlags() {
  return {
    hasGoogle: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    hasFacebook: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    hasApple: Boolean(
      process.env.APPLE_SERVICE_ID &&
        process.env.APPLE_TEAM_ID &&
        process.env.APPLE_KEY_ID &&
        process.env.APPLE_PRIVATE_KEY
    ),
  };
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10_000 : 20,
  message: 'Too many attempts. Please try again later.',
});

// Login page
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/whale');
  res.render('auth/login', {
    title: res.locals.t('auth.login'),
    next: req.query.next || '/whale',
    ...getOAuthViewFlags(),
  });
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
  res.render('auth/register', { title: res.locals.t('auth.register'), ...getOAuthViewFlags() });
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

// Email verification
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      req.session.flash = { type: 'danger', message: res.locals.t('auth.invalid_token') };
      return res.redirect('/auth/login');
    }
    await authSecurityService.verifyEmail(token);
    req.session.flash = { type: 'success', message: res.locals.t('flash.email_verified') };
    res.redirect('/auth/login');
  } catch (err) {
    const msg = {
      INVALID_TOKEN: 'auth.invalid_token',
      TOKEN_USED: 'auth.token_used',
      TOKEN_EXPIRED: 'auth.token_expired',
    }[err.message];
    req.session.flash = { type: 'danger', message: res.locals.t(msg || 'general.error') };
    res.redirect('/auth/login');
  }
});

// Resend verification email
router.post('/resend-verification', authLimiter, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect('/auth/login');
    }
    await authSecurityService.sendVerificationEmail(req.user.id);
    req.session.flash = { type: 'success', message: res.locals.t('flash.verification_sent') };
    res.redirect('back');
  } catch (err) {
    req.session.flash = {
      type: 'info',
      message: err.message === 'ALREADY_VERIFIED'
        ? res.locals.t('auth.already_verified')
        : res.locals.t('general.error'),
    };
    res.redirect('back');
  }
});

// Forgot password page
router.get('/forgot-password', (req, res) => {
  if (req.user) return res.redirect('/whale');
  res.render('auth/forgot-password', { title: res.locals.t('auth.forgot_password') });
});

// Forgot password handler
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = sanitizeBody(req.body, { email: 255 });
    await authSecurityService.sendPasswordReset(email);
    req.session.flash = { type: 'success', message: res.locals.t('flash.reset_email_sent') };
    res.redirect('/auth/forgot-password');
  } catch {
    req.session.flash = { type: 'danger', message: res.locals.t('general.error') };
    res.redirect('/auth/forgot-password');
  }
});

// Reset password page
router.get('/reset-password', (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/auth/forgot-password');
  res.render('auth/reset-password', {
    title: res.locals.t('auth.reset_password'),
    token,
  });
});

// Reset password handler
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, password } = req.body;
    await authSecurityService.resetPassword(token, password);
    req.session.flash = { type: 'success', message: res.locals.t('flash.password_reset') };
    res.redirect('/auth/login');
  } catch (err) {
    const msg = {
      INVALID_TOKEN: 'auth.invalid_token',
      TOKEN_USED: 'auth.token_used',
      TOKEN_EXPIRED: 'auth.token_expired',
      WEAK_PASSWORD: 'auth.weak_password',
    }[err.message];
    req.session.flash = { type: 'danger', message: res.locals.t(msg || 'general.error') };
    res.redirect('back');
  }
});

// Admin 2FA verification page
router.get('/2fa', (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') return res.redirect('/');
  res.render('auth/2fa', { title: res.locals.t('auth.two_factor') });
});

// Admin 2FA verification handler
router.post('/2fa', authLimiter, (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') return res.redirect('/');
  const { code } = req.body;
  const secret = req.user.twoFactorSecret;

  if (!secret || !authSecurityService.verifyAdmin2FA(secret, code)) {
    req.session.flash = { type: 'danger', message: res.locals.t('auth.invalid_2fa') };
    return res.redirect('/auth/2fa');
  }

  req.session.admin2FAVerified = true;
  req.session.flash = { type: 'success', message: res.locals.t('flash.2fa_verified') };
  res.redirect('/admin');
});

// Logout
router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

module.exports = router;
