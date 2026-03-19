const express = require('express');
const rateLimit = require('express-rate-limit');

const { guestOnly, requireAuth, optionalAuth } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const passport = require('../lib/passport');
const {
  registerUser,
  authenticateUser,
  getCurrentUser
} = require('../services/userService');
const referralService = require('../services/referralService');
const emailService = require('../services/emailService');
const { upload, storeOneFile } = require('../utils/upload');
const { validate, registerSchema, loginSchema } = require('../lib/validation');
const logger = require('../lib/logger');

const webRouter = express.Router();
const apiRouter = express.Router();

// ── Account-level brute-force protection ──────────────────────────────
// Tracks failed login attempts per account identifier (email/username).
// After 5 failed attempts within 15 minutes, the account is temporarily locked.
const loginAttemptsByAccount = new Map();
const ACCOUNT_MAX_ATTEMPTS = 5;
const ACCOUNT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function recordFailedLogin(identifier) {
  const key = String(identifier || '').trim().toLowerCase();
  if (!key) return;
  const now = Date.now();
  const record = loginAttemptsByAccount.get(key) || { attempts: 0, firstAttempt: now };
  // Reset window if expired
  if (now - record.firstAttempt > ACCOUNT_WINDOW_MS) {
    record.attempts = 0;
    record.firstAttempt = now;
  }
  record.attempts += 1;
  loginAttemptsByAccount.set(key, record);
}

function clearFailedLogins(identifier) {
  const key = String(identifier || '').trim().toLowerCase();
  if (key) loginAttemptsByAccount.delete(key);
}

function isAccountLocked(identifier) {
  const key = String(identifier || '').trim().toLowerCase();
  if (!key) return false;
  const record = loginAttemptsByAccount.get(key);
  if (!record) return false;
  // Reset window if expired
  if (Date.now() - record.firstAttempt > ACCOUNT_WINDOW_MS) {
    loginAttemptsByAccount.delete(key);
    return false;
  }
  return record.attempts >= ACCOUNT_MAX_ATTEMPTS;
}

// Periodically clean up stale entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttemptsByAccount) {
    if (now - record.firstAttempt > ACCOUNT_WINDOW_MS) {
      loginAttemptsByAccount.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests' }
});
const oauthStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests' }
});

function setUserSession(req, user) {
  req.session.userId = user.id;
  req.session.isAdmin = user.role === 'ADMIN';
  req.session.adminUser = user.role === 'ADMIN' ? user.username : null;
}

function getOauthEnabled() {
  return {
    google: strategyAvailable('google'),
    facebook: strategyAvailable('facebook'),
    apple: strategyAvailable('apple')
  };
}

function strategyAvailable(name) {
  return Boolean(passport._strategy(name));
}

function startOAuth(name, options = {}) {
  return (req, res, next) => {
    if (!strategyAvailable(name)) {
      return res.redirect(`/auth/login?error=${name}_unavailable`);
    }
    return passport.authenticate(name, { session: false, ...options })(req, res, next);
  };
}

async function finalizeOAuthLogin(req, res) {
  if (!req.user || !req.user.id) {
    return res.redirect('/auth/login?error=auth_failed');
  }

  setUserSession(req, req.user);
  req.session.lang = req.session.lang || (process.env.DEFAULT_LANG === 'en' ? 'en' : 'ar');

  if (req.session.pendingRef) {
    await referralService.markCodeUsed(req.session.pendingRef).catch(() => {});
    delete req.session.pendingRef;
  }

  const returnTo = req.session.returnTo || '/whale';
  delete req.session.returnTo;
  return res.redirect(returnTo);
}

async function handleRegister(req, res, isApi) {
  try {
    // Validate input with Zod
    const validation = validate(registerSchema, req.body);
    if (!validation.success) {
      const errorMsg = validation.firstError;
      if (isApi) return res.status(400).json({ error: errorMsg, errors: validation.errors });
      return res.status(400).render('auth/register', {
        title: `${res.locals.t('register.title')} | Whale`,
        error: errorMsg,
        formData: { username: req.body.username, email: req.body.email, ref: req.body.ref || '' },
        oauthEnabled: getOauthEnabled(),
        query: req.query || {}
      });
    }
    const { username, email, password } = validation.data;

    const avatar = req.file ? await storeOneFile(req.file, 'uploads/avatars') : null;
    const user = await registerUser({
      username,
      email,
      password,
      avatar
    });

    // 1) Create subscription with 30-day Pro trial for all new users
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: 'pro',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    // 2) Apply referral code if present in session or body
    const incomingRef = req.session.pendingRef || req.body.ref;
    const refCode = typeof incomingRef === 'string' ? incomingRef.trim().toUpperCase() : '';
    if (refCode) {
      const referral = await prisma.referralCode.findUnique({ where: { code: refCode } });
      if (referral) {
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCodeId: referral.id }
        });
        await referralService.markCodeUsed(refCode);
      }
      delete req.session.pendingRef;
    }

    setUserSession(req, user);
    await emailService.sendWelcome(user).catch(() => {});

    if (isApi) {
      return res.status(201).json({ user });
    }

    return res.redirect('/whale');
  } catch (error) {
    if (isApi) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(400).render('auth/register', {
      title: `${res.locals.t('register.title')} | Whale`,
      error: error.message,
      formData: {
        username: req.body.username,
        email: req.body.email,
        ref: req.body.ref || req.session.pendingRef || ''
      },
      oauthEnabled: getOauthEnabled(),
      query: req.query || {}
    });
  }
}

async function handleLogin(req, res, isApi) {
  // Validate input with Zod
  const validation = validate(loginSchema, req.body);
  if (!validation.success) {
    const errorMsg = validation.firstError;
    if (isApi) return res.status(400).json({ error: errorMsg, errors: validation.errors });
    return res.status(400).render('auth/login', {
      title: `${res.locals.t('login.title')} | Whale`,
      error: errorMsg,
      oauthEnabled: getOauthEnabled(),
      query: req.query || {}
    });
  }
  const identifier = validation.data.identifier;

  // Check account-level lockout before attempting authentication
  if (isAccountLocked(identifier)) {
    const msg = 'Too many failed login attempts. Please try again later.';
    if (isApi) {
      return res.status(429).json({ error: msg });
    }
    return res.status(429).render('auth/login', {
      title: `${res.locals.t('login.title')} | Whale`,
      error: msg,
      oauthEnabled: getOauthEnabled(),
      query: req.query || {}
    });
  }

  try {
    const user = await authenticateUser(identifier, req.body.password);
    clearFailedLogins(identifier);
    setUserSession(req, user);

    if (isApi) {
      return res.json({ user });
    }

    const returnTo = req.session.returnTo || '/whale';
    delete req.session.returnTo;
    return res.redirect(returnTo);
  } catch (error) {
    recordFailedLogin(identifier);

    if (isApi) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.status(401).render('auth/login', {
      title: `${res.locals.t('login.title')} | Whale`,
      error: res.locals.t('error.invalid_credentials'),
      oauthEnabled: getOauthEnabled(),
      query: req.query || {}
    });
  }
}

async function handleLogout(req, res, isApi) {
  req.session.destroy(() => {
    if (isApi) {
      return res.json({ ok: true });
    }
    return res.redirect('/auth/login');
  });
}

async function handleMe(req, res) {
  const user = req.user ? await getCurrentUser(req.user.id) : null;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user });
}

webRouter.get('/auth/login', guestOnly, (req, res, next) => {
  try {
    return res.render('auth/login', {
      title: `${res.locals.t('login.title')} | Whale`,
      error: null,
      query: req.query || {},
      oauthEnabled: getOauthEnabled()
    });
  } catch (error) {
    return next(error);
  }
});

webRouter.get('/auth/register', guestOnly, (req, res, next) => {
  try {
    if (req.query.ref) {
      req.session.pendingRef = String(req.query.ref).trim().toUpperCase();
    }

    return res.render('auth/register', {
      title: `${res.locals.t('register.title')} | Whale`,
      error: null,
      formData: {
        ref: req.session.pendingRef || ''
      },
      query: req.query || {},
      oauthEnabled: getOauthEnabled()
    });
  } catch (error) {
    return next(error);
  }
});

// Web registration uses a regular form so CSRF validation works with the global parser.
// Avatar upload can still be handled by the API route or later profile editing.
webRouter.post('/auth/register', guestOnly, authWriteLimiter, (req, res) => handleRegister(req, res, false));
webRouter.post('/auth/login', guestOnly, authWriteLimiter, (req, res) => handleLogin(req, res, false));
webRouter.post('/auth/logout', requireAuth, (req, res) => handleLogout(req, res, false));
webRouter.get('/auth/me', optionalAuth, handleMe);
webRouter.get('/auth/csrf', (_req, res) => res.json({ csrfToken: res.locals.csrfToken }));

// OAuth - Google
webRouter.get('/auth/google', guestOnly, oauthStartLimiter, startOAuth('google', { scope: ['profile', 'email'] }));

webRouter.get(
  '/auth/google/callback',
  guestOnly,
  (req, res, next) => passport.authenticate('google', {
    session: false,
    failureRedirect: '/auth/login?error=google_failed'
  })(req, res, next),
  async (req, res) => {
    try {
      await finalizeOAuthLogin(req, res);
    } catch (_error) {
      res.redirect('/auth/login?error=google_failed');
    }
  }
);

// OAuth - Facebook
webRouter.get('/auth/facebook', guestOnly, oauthStartLimiter, startOAuth('facebook', { scope: ['email', 'public_profile'] }));

webRouter.get(
  '/auth/facebook/callback',
  guestOnly,
  (req, res, next) => passport.authenticate('facebook', {
    session: false,
    failureRedirect: '/auth/login?error=facebook_failed'
  })(req, res, next),
  async (req, res) => {
    try {
      await finalizeOAuthLogin(req, res);
    } catch (_error) {
      res.redirect('/auth/login?error=facebook_failed');
    }
  }
);

// OAuth - Apple
webRouter.get('/auth/apple', guestOnly, oauthStartLimiter, startOAuth('apple'));

webRouter.post(
  '/auth/apple/callback',
  guestOnly,
  express.urlencoded({ extended: true }),
  (req, res, next) => passport.authenticate('apple', {
    session: false,
    failureRedirect: '/auth/login?error=apple_failed'
  })(req, res, next),
  async (req, res) => {
    try {
      await finalizeOAuthLogin(req, res);
    } catch (_error) {
      res.redirect('/auth/login?error=apple_failed');
    }
  }
);

apiRouter.post('/register', authWriteLimiter, upload.single('avatar'), (req, res) => handleRegister(req, res, true));
apiRouter.post('/login', authWriteLimiter, (req, res) => handleLogin(req, res, true));
apiRouter.post('/logout', requireAuth, (req, res) => handleLogout(req, res, true));
apiRouter.get('/me', optionalAuth, handleMe);
apiRouter.get('/csrf', (_req, res) => res.json({ csrfToken: res.locals.csrfToken }));

module.exports = {
  webRouter,
  apiRouter
};
