const express = require('express');
const rateLimit = require('express-rate-limit');
const passport = require('../lib/passport');
const { requireAuth, guestOnly } = require('../middleware/auth');
const userService = require('../services/userService');
const referralService = require('../services/referralService');
const emailService = require('../services/emailService');
const prisma = require('../lib/prisma');
const { upload } = require('../utils/upload');

const webRouter = express.Router();
const apiRouter = express.Router();

const authWriteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, message: 'Too many attempts' });
const oauthStartLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });

function setUserSession(req, user) {
  req.session.userId = user.id;
  if (user.role === 'ADMIN') {
    req.session.isAdmin = true;
    req.session.adminUser = user.username;
  }
}

function getOauthEnabled() {
  return {
    google: Boolean(passport._strategies?.google),
    facebook: Boolean(passport._strategies?.facebook),
    apple: Boolean(passport._strategies?.apple),
  };
}

function strategyAvailable(name) {
  return Boolean(passport._strategies?.[name]);
}

function startOAuth(name, options = {}) {
  return (req, res, next) => {
    if (!strategyAvailable(name)) return res.redirect('/auth/login?error=oauth_unavailable');
    return passport.authenticate(name, options)(req, res, next);
  };
}

function finalizeOAuthLogin(req, res) {
  if (!req.user) return res.redirect('/auth/login?error=oauth_failed');
  setUserSession(req, req.user);

  // Handle pending referral
  const ref = req.session.pendingRef;
  if (ref) {
    delete req.session.pendingRef;
    referralService.markCodeUsed(ref).catch(() => {});
  }

  const returnTo = req.session.returnTo || '/whale';
  delete req.session.returnTo;
  return res.redirect(returnTo);
}

// ─── WEB ROUTES ─────────────────────────────────────────────────────────────

webRouter.get('/auth/login', guestOnly, (req, res) => {
  res.render('auth/login', {
    title: res.locals.t('login.title'),
    error: req.query.error || null,
    oauthEnabled: getOauthEnabled(),
    query: req.query,
  });
});

webRouter.post('/auth/login', guestOnly, authWriteLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await userService.authenticateUser(identifier, password);
    setUserSession(req, user);
    const returnTo = req.session.returnTo || '/whale';
    delete req.session.returnTo;
    return res.redirect(returnTo);
  } catch (e) {
    return res.render('auth/login', {
      title: res.locals.t('login.title'),
      error: e.message,
      oauthEnabled: getOauthEnabled(),
      query: req.query,
    });
  }
});

webRouter.get('/auth/register', guestOnly, (req, res) => {
  if (req.query.ref) req.session.pendingRef = req.query.ref;
  res.render('auth/register', {
    title: res.locals.t('register.title'),
    error: null,
    formData: {},
    oauthEnabled: getOauthEnabled(),
    query: req.query,
  });
});

webRouter.post('/auth/register', guestOnly, authWriteLimiter, async (req, res) => {
  try {
    const { username, email, password, ref } = req.body;
    const user = await userService.registerUser({ username: username?.toLowerCase(), email, password });

    // 30-day Pro trial
    await prisma.subscription.create({
      data: { userId: user.id, plan: 'pro', trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    // Welcome notification
    await prisma.notification.create({
      data: { userId: user.id, type: 'SYSTEM', message: `🐳 مرحباً ${user.username}! حسابك جاهز — 30 يوم Pro مجاناً.` },
    }).catch(() => {});

    // Referral
    const refCode = ref || req.session.pendingRef;
    if (refCode) {
      delete req.session.pendingRef;
      referralService.markCodeUsed(refCode).catch(() => {});
      await prisma.referralCode.findUnique({ where: { code: refCode.toUpperCase() } }).then((r) => {
        if (r) prisma.user.update({ where: { id: user.id }, data: { referralCodeId: r.id } }).catch(() => {});
      }).catch(() => {});
    }

    setUserSession(req, user);
    emailService.sendWelcome(user).catch(() => {});
    return res.redirect('/whale');
  } catch (e) {
    return res.render('auth/register', {
      title: res.locals.t('register.title'),
      error: e.message,
      formData: req.body,
      oauthEnabled: getOauthEnabled(),
      query: req.query,
    });
  }
});

webRouter.post('/auth/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

webRouter.get('/auth/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  return res.json({ user: req.user });
});

webRouter.get('/auth/csrf', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// ─── OAUTH ──────────────────────────────────────────────────────────────────

webRouter.get('/auth/google', guestOnly, oauthStartLimiter, startOAuth('google', { scope: ['profile', 'email'] }));
webRouter.get('/auth/google/callback',
  (req, res, next) => passport.authenticate('google', { failureRedirect: '/auth/login?error=google_failed' })(req, res, next),
  finalizeOAuthLogin
);

webRouter.get('/auth/facebook', guestOnly, oauthStartLimiter, startOAuth('facebook', { scope: ['email'] }));
webRouter.get('/auth/facebook/callback',
  (req, res, next) => passport.authenticate('facebook', { failureRedirect: '/auth/login?error=facebook_failed' })(req, res, next),
  finalizeOAuthLogin
);

webRouter.get('/auth/apple', guestOnly, oauthStartLimiter, startOAuth('apple'));
webRouter.post('/auth/apple/callback',
  (req, res, next) => passport.authenticate('apple', { failureRedirect: '/auth/login?error=apple_failed' })(req, res, next),
  finalizeOAuthLogin
);

// ─── API ROUTES ─────────────────────────────────────────────────────────────

apiRouter.post('/register', authWriteLimiter, upload.single('avatar'), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const avatar = req.file ? `/uploads/whale/${req.file.filename}` : null;
    const user = await userService.registerUser({ username: username?.toLowerCase(), email, password, avatar });

    await prisma.subscription.create({
      data: { userId: user.id, plan: 'pro', trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    setUserSession(req, user);
    emailService.sendWelcome(user).catch(() => {});
    return res.status(201).json({ user });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

apiRouter.post('/login', authWriteLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await userService.authenticateUser(identifier, password);
    setUserSession(req, user);
    return res.json({ user });
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }
});

apiRouter.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

apiRouter.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

apiRouter.get('/csrf', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

module.exports = { webRouter, apiRouter };
