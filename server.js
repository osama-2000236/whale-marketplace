/**
 * Whale Marketplace - Server Bootstrap
 * Node.js + Express + Prisma
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');

const prisma = require('./lib/prisma');
const { optionalAuth } = require('./middleware/auth');
const { injectSubStatus, startSubscriptionCron } = require('./middleware/subscription');
const locale = require('./middleware/locale');
const passport = require('./lib/passport');
const { ensureAdminFromEnv } = require('./services/userService');
const notificationService = require('./services/notificationService');
const { t } = require('./lib/i18n');
const { getDirection, startsWithArabic } = require('./utils/text');
const { buildResponsiveImage } = require('./utils/images');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

const authRoutes = require('./routes/auth');
const paymentRouter = require('./routes/payment');
const welcomeRouter = require('./routes/welcome');
const whaleRouter = require('./routes/whale');
const pagesRouter = require('./routes/pages');
const sitemapRouter = require('./routes/sitemap');
const notificationRoutes = require('./routes/notifications');

function timeAgo(input, lang = 'ar') {
  if (!input) return '';
  const date = new Date(input);
  const now = new Date();
  const diffMs = Math.max(0, now - date);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diffMs < minute) return t('time.just_now', lang);
  if (diffMs < hour) {
    const m = Math.floor(diffMs / minute);
    return t('time.minutes_ago', lang, { n: m });
  }
  if (diffMs < day) {
    const h = Math.floor(diffMs / hour);
    return t('time.hours_ago', lang, { n: h });
  }
  if (diffMs < week) {
    const d = Math.floor(diffMs / day);
    return t('time.days_ago', lang, { n: d });
  }
  return date.toLocaleDateString(lang === 'ar' ? 'ar-PS' : 'en-GB');
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.use(passport.initialize());

if (isProd) {
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' }
    })
  );
}

app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '7d' : 0
  })
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(optionalAuth);
app.use(injectSubStatus);
app.use(locale);

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax'
  }
});

app.use((req, res, next) => {
  if (req.path === '/webhooks/paymob') return next();
  if (req.method === 'POST' && req.path === '/auth/apple/callback') return next();
  return csrfProtection(req, res, next);
});

app.use(async (req, res, next) => {
  try {
    const config = require('./data/config.json');

    res.locals.config = config;
    res.locals.currentPath = req.path;
    res.locals.path = req.path;
    res.locals.currentUser = req.user || null;
    res.locals.isAdmin = Boolean(req.user && req.user.role === 'ADMIN') || Boolean(req.session?.isAdmin);
    res.locals.whatsappNumber = process.env.WHATSAPP_NUMBER || config.contact.whatsapp;
    res.locals.getDirection = getDirection;
    res.locals.startsWithArabic = startsWithArabic;
    res.locals.timeAgo = (value) => timeAgo(value, res.locals.lang || 'ar');
    res.locals.imageSet = (url, options) => buildResponsiveImage(url, options);
    res.locals.csrfToken = req.csrfToken();

    if (req.user?.id) {
      const [navNotifications, unreadNotificationsCount] = await Promise.all([
        notificationService.getNotifications(req.user.id, 10),
        notificationService.getUnreadCount(req.user.id)
      ]);

      res.locals.navNotifications = navNotifications;
      res.locals.unreadNotificationsCount = unreadNotificationsCount;
    } else {
      res.locals.navNotifications = [];
      res.locals.unreadNotificationsCount = 0;
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

// Health check at root level — Railway uses this to know if the app is alive
app.get('/health', (_req, res) => res.redirect('/api/health'));

// Whale-first routing
app.get('/', (_req, res) => res.redirect('/whale'));

// Redirect legacy paths to Whale
app.use('/marketplace', (_req, res) => res.redirect('/whale'));
app.use('/market', (_req, res) => res.redirect('/whale'));
app.use('/rooms', (_req, res) => res.redirect('/whale'));
app.use('/posts', (_req, res) => res.redirect('/whale'));
app.use('/products', (_req, res) => res.redirect('/whale'));

// Web routes
app.use(authRoutes.webRouter);
app.use('/', paymentRouter);
app.use('/', welcomeRouter);
app.use('/whale', whaleRouter);
app.use('/prefs', require('./routes/prefs'));
app.use(notificationRoutes.webRouter);
app.use('/', sitemapRouter);
app.use('/', pagesRouter);
app.use('/admin', require('./routes/admin'));

// Health check — used by Railway to verify the app is running
app.use('/api', require('./routes/api'));

// JSON API routes
app.use('/api/auth', authRoutes.apiRouter);
app.use('/api/notifications', notificationRoutes.apiRouter);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    return res.status(403).render('error', {
      title: 'CSRF Error',
      message: 'جلسة غير صالحة، الرجاء تحديث الصفحة والمحاولة مجددا | Invalid session token, refresh and retry'
    });
  }

  // eslint-disable-next-line no-console
  console.error('Server Error:', err);

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(500).render('error', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

async function start() {
  try {
    await ensureAdminFromEnv();
    startSubscriptionCron();
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`
╔═════════════════════════════════════════════════════════╗
║   WHALE · Palestine's Big Marketplace                 ║
║   Server: http://localhost:${PORT}                          ║
║   API:    http://localhost:${PORT}/api                      ║
╚═════════════════════════════════════════════════════════╝
`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
module.exports.start = start;
