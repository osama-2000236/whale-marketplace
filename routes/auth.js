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
    const data = sanitizeBody(req.body, {
      username: 30,
      email: 255,
      password: 128,
      confirmPassword: 128,
    });

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
      PASSWORD_MISMATCH: 'Passwords do not match',
      EMAIL_TAKEN: 'Email already registered',
      USERNAME_TAKEN: 'Username already taken',
    };
    req.session.flash = { type: 'danger', message: messages[err.message] || err.message };
    res.redirect('/auth/register');
  }
});

router.get('/verify-email', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    req.session.flash = { type: 'danger', message: 'Missing verification token.' };
    return res.redirect('/auth/login');
  }

  try {
    await authSecurityService.verifyEmail(token);
    req.session.flash = {
      type: 'success',
      message: 'Your email has been verified. You can continue safely.',
    };
    return res.redirect('/auth/login');
  } catch {
    req.session.flash = {
      type: 'danger',
      message: 'Verification link is invalid or expired. Please request a new one.',
    };
    return res.redirect('/auth/login');
  }
});

router.post('/resend-verification', async (req, res) => {
  if (!req.user) {
    req.session.flash = { type: 'warning', message: 'Please log in first.' };
    return res.redirect('/auth/login');
  }

  try {
    await authSecurityService.sendVerificationEmail(req.user.id);
    req.session.flash = {
      type: 'success',
      message: 'Verification email sent. Please check your inbox.',
    };
  } catch {
    req.session.flash = {
      type: 'danger',
      message: 'Unable to send verification email right now.',
    };
  }
  return res.redirect('/profile');
});

router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password' });
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  const email = sanitizeBody(req.body, { email: 255 }).email;
  await authSecurityService.sendPasswordReset(email).catch(() => {});
  req.session.flash = {
    type: 'info',
    message: 'If your account exists, a reset link was sent to your email.',
  };
  res.redirect('/auth/login');
});

router.get('/reset-password', (req, res) => {
  res.render('auth/reset-password', { title: 'Reset Password', token: req.query.token || '' });
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const data = sanitizeBody(req.body, { token: 512, password: 128, confirmPassword: 128 });
  if (!data.password || data.password !== data.confirmPassword) {
    req.session.flash = { type: 'danger', message: 'Passwords do not match.' };
    return res.redirect('/auth/reset-password?token=' + encodeURIComponent(data.token || ''));
  }

  try {
    await authSecurityService.resetPassword(data.token, data.password);
    req.session.flash = { type: 'success', message: 'Password updated. Please log in.' };
    return res.redirect('/auth/login');
  } catch (err) {
    const map = {
      TOKEN_INVALID_OR_EXPIRED: 'Reset link is invalid or expired.',
      WEAK_PASSWORD: 'Password must be at least 8 characters.',
    };
    req.session.flash = { type: 'danger', message: map[err.message] || 'Unable to reset password.' };
    return res.redirect('/auth/reset-password?token=' + encodeURIComponent(data.token || ''));
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
  req.session.admin2faVerifiedAt = new Date().toISOString();
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
