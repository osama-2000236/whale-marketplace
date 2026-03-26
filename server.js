require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const { csrfSync } = require('csrf-sync');
const rateLimit = require('express-rate-limit');
const passport = require('./lib/passport');
const { localeMiddleware } = require('./middleware/locale');
const { subscriptionMiddleware } = require('./middleware/subscription');
const { optionalAuth } = require('./middleware/auth');
const path = require('path');

const app = express();

// 1. Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'res.cloudinary.com'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

// 2. Body parsing (preserve raw body for Stripe webhook signature verification)
app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/webhooks/stripe')) {
        req.rawBody = buf;
      }
    },
  })
);

// 3. Static files
app.use(express.static(path.join(__dirname, 'public')));

// 4. Session
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'change-me-in-production-32-chars',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// 5. Passport
app.use(passport.initialize());
app.use(passport.session());

// 6. Locale
app.use(localeMiddleware);

// 7. CSRF (exclude webhooks)
const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body._csrf || req.headers['x-csrf-token'],
});
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks/')) return next();
  // Apple Sign In sends a POST callback — exempt from CSRF
  if (req.path === '/auth/apple/callback' && req.method === 'POST') return next();
  csrfSynchronisedProtection(req, res, next);
});
app.use((req, res, next) => {
  res.locals.csrfToken = generateToken(req);
  next();
});

// 8. Auth (populate res.locals.user)
app.use(optionalAuth);

// 9. Subscription status
app.use(subscriptionMiddleware);

// 10. Flash messages
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  // Flash helper
  req.flash = (type, message) => {
    req.session.flash = { type, message };
  };
  next();
});

// 11. Notification count
app.use(async (req, res, next) => {
  if (req.user) {
    try {
      const prisma = require('./lib/prisma');
      res.locals.unreadCount = await prisma.notification.count({
        where: { userId: req.user.id, isRead: false },
      });
    } catch {
      res.locals.unreadCount = 0;
    }
  } else {
    res.locals.unreadCount = 0;
  }
  next();
});

// 12. View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 13. Global rate limit
const isTestEnv = process.env.NODE_ENV === 'test';
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTestEnv ? 1_000_000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// 14. Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/whale', require('./routes/whale'));
app.use('/profile', require('./routes/profile'));
app.use('/', require('./routes/payment'));
app.use('/webhooks', require('./routes/webhooks'));
app.use('/admin', require('./routes/admin'));

// 15. Redirects
app.get('/marketplace', (req, res) => res.redirect(301, '/whale'));
app.get('/market', (req, res) => res.redirect(301, '/whale'));
app.get('/rooms', (req, res) => res.redirect(301, '/whale'));
app.get('/search', (req, res) =>
  res.redirect(301, '/whale?q=' + encodeURIComponent(req.query.q || ''))
);

// 16. Ensure all template locals exist (safety net for 404/error pages)
function ensureLocals(res) {
  const defaults = {
    csrfToken: '',
    locale: 'en',
    dir: 'ltr',
    theme: 'light',
    t: (k) => k,
    user: null,
    canSell: false,
    isPro: false,
    inTrial: false,
    notifCount: 0,
    flash: { success: [], error: [], info: [] },
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (res.locals[k] === undefined) res.locals[k] = v;
  }
}

// 17. 404
app.use((req, res) => {
  ensureLocals(res);
  res.status(404).render('404', { title: '404' });
});

// 18. Error handler
app.use((err, req, res, next) => {
  ensureLocals(res);

  if (err.code === 'EBADCSRFTOKEN' || (err.message && err.message.toLowerCase().includes('csrf'))) {
    return res.status(403).render('error', {
      title: 'Error',
      message: 'Invalid CSRF token — please refresh and try again.',
      status: 403,
    });
  }
  console.error(err.stack || err);
  res.status(err.status || 500).render('error', {
    title: 'Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    status: err.status || 500,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Whale running on port ${PORT}`));

module.exports = app;
