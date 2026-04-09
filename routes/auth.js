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

function getAuthMessage(code) {
  return (
    {
      INVALID_USERNAME: 'Username must be 3-30 characters using letters, numbers, or underscore.',
      INVALID_EMAIL: 'Please enter a valid email address.',
      WEAK_PASSWORD: 'Password must be at least 8 characters long.',
      PASSWORD_MISMATCH: 'Passwords do not match.',
      EMAIL_TAKEN: 'That email is already registered.',
      USERNAME_TAKEN: 'That username is already taken.',
      USER_NOT_FOUND: 'We could not find an account with those credentials.',
      WRONG_PASSWORD: 'The password you entered is incorrect.',
      USER_BANNED: 'This account is suspended.',
      OAUTH_ONLY: 'Please sign in with Google or set a password first.',
      OAUTH_EMAIL_REQUIRED: 'We could not read an email address from the provider.',
      ALREADY_VERIFIED: 'Your email address is already verified.',
      INVALID_TOKEN: 'This verification link is invalid.',
      TOKEN_USED: 'This verification link has already been used.',
      TOKEN_EXPIRED: 'This verification link has expired. Please request a new one.',
      NO_PENDING_EMAIL: 'There is no pending email change for this account.',
      CURRENT_PASSWORD_REQUIRED: 'Please enter your current password.',
      CURRENT_PASSWORD_INVALID: 'Your current password is incorrect.',
      PASSWORD_SETUP_REQUIRED:
        'Set a password from the email we just sent before changing account settings.',
    }[code] || code || 'Something went wrong.'
  );
}

function withQueryLocation(path, nextUrl) {
  const safeNext = safeRedirect(nextUrl, '/whale');
  return safeNext === '/whale' ? path : `${path}?next=${encodeURIComponent(safeNext)}`;
}

function storeOAuthNext(req) {
  req.session.oauthNext = safeRedirect(req.query.next, '/whale');
}

function completeOAuth(strategy) {
  return (req, res, next) => {
    passport.authenticate(strategy, (err, user, info) => {
      if (err) return next(err);

      if (!user) {
        req.session.flash = {
          type: 'danger',
          message: getAuthMessage(info?.message || 'OAUTH_EMAIL_REQUIRED'),
        };
        const fallbackNext = req.session.oauthNext || '/whale';
        delete req.session.oauthNext;
        return res.redirect(withQueryLocation('/auth/login', fallbackNext));
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        const nextUrl = safeRedirect(req.session.oauthNext, '/whale');
        delete req.session.oauthNext;
        req.session.flash = { type: 'success', message: res.locals.t('flash.login_success') };
        return res.redirect(nextUrl);
      });
    })(req, res, next);
  };
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10_000 : 20,
  message: 'Too many attempts. Please try again later.',
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/whale');
  const nextUrl = safeRedirect(req.query.next, '/whale');
  res.render('auth/login', {
    title: res.locals.t('auth.login'),
    next: nextUrl,
    ...getOAuthViewFlags(),
  });
});

router.post('/login', authLimiter, (req, res, next) => {
  const nextUrl = safeRedirect(req.body.next, '/whale');

  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.session.flash = {
        type: 'danger',
        message: getAuthMessage(info?.message || 'USER_NOT_FOUND'),
      };
      return res.redirect(withQueryLocation('/auth/login', nextUrl));
    }
    // Regenerate session to prevent session fixation attacks
    const oldSession = { ...req.session };
    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) return next(regenerateErr);
      // Restore non-auth session data (locale, cart, etc.)
      if (oldSession.locale) req.session.locale = oldSession.locale;
      if (oldSession.cart) req.session.cart = oldSession.cart;

      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        req.session.flash = { type: 'success', message: res.locals.t('flash.login_success') };
        return res.redirect(nextUrl);
      });
    });
  })(req, res, next);
});

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/whale');
  const nextUrl = safeRedirect(req.query.next, '/whale');
  res.render('auth/register', {
    title: res.locals.t('auth.register'),
    next: nextUrl,
    ...getOAuthViewFlags(),
  });
});

router.post('/register', authLimiter, async (req, res, next) => {
  const nextUrl = safeRedirect(req.body.next, '/whale');

  try {
    const data = sanitizeBody(req.body, {
      username: 30,
      email: 255,
      password: 128,
      confirmPassword: 128,
    });

    const user = await userService.register(data);

    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      req.session.flash = { type: 'success', message: res.locals.t('flash.register_success') };
      return res.redirect(nextUrl);
    });
  } catch (err) {
    req.session.flash = { type: 'danger', message: getAuthMessage(err.message) };
    return res.redirect(withQueryLocation('/auth/register', nextUrl));
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
  } catch (err) {
    req.session.flash = {
      type: 'danger',
      message: getAuthMessage(err.message),
    };
  }

  return res.redirect('/auth/login');
});

router.get('/verify-email-change', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    req.session.flash = { type: 'danger', message: 'Missing email change token.' };
    return res.redirect('/profile');
  }

  try {
    await authSecurityService.verifyEmailChange(token);
    req.session.flash = {
      type: 'success',
      message: 'Your new email address has been verified and activated.',
    };
  } catch (err) {
    req.session.flash = {
      type: 'danger',
      message: getAuthMessage(err.message),
    };
  }

  return res.redirect('/profile');
});

router.post('/resend-verification', async (req, res) => {
  if (!req.user) {
    req.session.flash = { type: 'warning', message: 'Please log in first.' };
    return res.redirect('/auth/login');
  }

  if (req.user.emailVerified || req.user.isVerified) {
    req.session.flash = {
      type: 'info',
      message: 'Your email address is already verified.',
    };
    return res.redirect('/profile');
  }

  try {
    await authSecurityService.sendVerificationEmail(req.user.id);
    req.session.flash = {
      type: 'success',
      message: 'Verification email sent. Please check your inbox.',
    };
  } catch (err) {
    req.session.flash = {
      type: 'danger',
      message: getAuthMessage(err.message),
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
    return res.redirect(`/auth/reset-password?token=${encodeURIComponent(data.token || '')}`);
  }

  try {
    await authSecurityService.resetPassword(data.token, data.password);
    req.session.flash = { type: 'success', message: 'Password updated. Please log in.' };
    return res.redirect('/auth/login');
  } catch (err) {
    req.session.flash = { type: 'danger', message: getAuthMessage(err.message) };
    return res.redirect(`/auth/reset-password?token=${encodeURIComponent(data.token || '')}`);
  }
});

router.get('/google', (req, res, next) => {
  storeOAuthNext(req);
  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', completeOAuth('google'));

router.get('/facebook', (req, res, next) => {
  storeOAuthNext(req);
  return passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

router.get('/facebook/callback', completeOAuth('facebook'));

router.get('/apple', (req, res, next) => {
  storeOAuthNext(req);
  return passport.authenticate('apple')(req, res, next);
});

router.post('/apple/callback', completeOAuth('apple'));

router.get('/2fa', (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') return res.redirect('/');
  res.render('auth/2fa', { title: res.locals.t('auth.two_factor') });
});

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
  return res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

module.exports = router;
