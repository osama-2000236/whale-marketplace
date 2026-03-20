require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const passport = require('./lib/passport');

const { optionalAuth } = require('./middleware/auth');
const { injectSubStatus, startSubscriptionCron } = require('./middleware/subscription');
const locale = require('./middleware/locale');
const notificationService = require('./services/notificationService');
const { ensureAdminFromEnv } = require('./services/userService');
const { readJSON } = require('./utils/dataStore');
const { getDirection, startsWithArabic, timeAgo } = require('./utils/text');
const { buildResponsiveImage } = require('./utils/images');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ─── BASIC SETUP ────────────────────────────────────────────────────────────

if (isProd) app.set('trust proxy', 1);
app.disable('x-powered-by');

// ─── SECURITY ───────────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://accept.paymob.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.googleusercontent.com', 'https://graph.facebook.com'],
      frameSrc: ["'self'", 'https://accept.paymob.com'],
      connectSrc: ["'self'"],
    },
  } : false,
}));

// ─── PERFORMANCE ────────────────────────────────────────────────────────────

app.use(compression());

// ─── CORS ───────────────────────────────────────────────────────────────────

const corsOptions = isProd && process.env.ALLOWED_ORIGINS
  ? { origin: process.env.ALLOWED_ORIGINS.split(','), credentials: true }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));

// ─── PARSING ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// ─── SESSIONS ───────────────────────────────────────────────────────────────

app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

app.use(passport.initialize());

// ─── RATE LIMITING ──────────────────────────────────────────────────────────

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 1000,
  skip: (req) => req.path === '/health',
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── STATIC FILES ───────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProd ? '7d' : 0,
}));

// ─── VIEW ENGINE ────────────────────────────────────────────────────────────

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── GLOBAL MIDDLEWARE ──────────────────────────────────────────────────────

app.use(optionalAuth);
app.use(injectSubStatus);
app.use(locale);

// ─── CSRF PROTECTION ────────────────────────────────────────────────────────

const csrfProtection = csrf({ cookie: { httpOnly: true, secure: isProd, sameSite: 'lax' } });
app.use((req, res, next) => {
  // Skip CSRF for webhooks and Apple OAuth callback
  if (req.path === '/webhooks/paymob') return next();
  if (req.method === 'POST' && req.path === '/auth/apple/callback') return next();
  return csrfProtection(req, res, next);
});

// ─── TEMPLATE LOCALS ────────────────────────────────────────────────────────

app.use(async (req, res, next) => {
  try {
    const config = readJSON('config.json') || {};
    res.locals.config = config;
    res.locals.currentPath = req.path;
    res.locals.currentUser = req.user || null;
    res.locals.isAdmin = Boolean(req.user?.role === 'ADMIN') || Boolean(req.session?.isAdmin);
    res.locals.whatsappNumber = process.env.WHATSAPP_NUMBER || config.contact?.whatsapp || '';
    res.locals.getDirection = getDirection;
    res.locals.startsWithArabic = startsWithArabic;
    res.locals.timeAgo = (value) => timeAgo(value, res.locals.lang || 'ar');
    res.locals.imageSet = (url, options) => buildResponsiveImage(url, options);
    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';

    if (req.user?.id) {
      res.locals.navNotifications = await notificationService.getNotifications(req.user.id, 10);
      res.locals.unreadNotificationsCount = await notificationService.getUnreadCount(req.user.id);
    } else {
      res.locals.navNotifications = [];
      res.locals.unreadNotificationsCount = 0;
    }
    res.locals.unreadCount = res.locals.unreadNotificationsCount;

    next();
  } catch (e) {
    next(e);
  }
});

// ─── ROUTES ─────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// Home / Landing page
app.get('/', async (req, res, next) => {
  try {
    const prismaClient = require('./lib/prisma');
    const [categories, latestListings, listingCount, sellerCount, cityCount] = await Promise.all([
      prismaClient.marketCategory.findMany({ orderBy: { order: 'asc' }, include: { _count: { select: { listings: { where: { status: 'ACTIVE' } } } } } }),
      prismaClient.marketListing.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 8, include: { seller: { select: { id: true, username: true, avatar: true, isVerified: true, sellerProfile: true } }, category: true } }),
      prismaClient.marketListing.count({ where: { status: 'ACTIVE' } }),
      prismaClient.sellerProfile.count(),
      prismaClient.marketListing.groupBy({ by: ['city'], where: { status: 'ACTIVE' } }).then(r => r.length),
    ]);
    res.render('index', {
      title: res.locals.t('app.name'),
      categories,
      latestListings,
      stats: { listings: listingCount, sellers: sellerCount, cities: cityCount },
    });
  } catch (e) { next(e); }
});

// Legacy redirects
app.use('/marketplace', (_req, res) => res.redirect('/whale'));
app.use('/market', (_req, res) => res.redirect('/whale'));
app.use('/rooms', (_req, res) => res.redirect('/forum'));

const authRoutes = require('./routes/auth');
const paymentRouter = require('./routes/payment');
const welcomeRouter = require('./routes/welcome');
const whaleRouter = require('./routes/whale');
const forumRouter = require('./routes/forum');
const notificationRoutes = require('./routes/notifications');
const sitemapRouter = require('./routes/sitemap');
const pagesRouter = require('./routes/pages');
const userRoutes = require('./routes/users');
const searchRoutes = require('./routes/search');

// Web routes
app.use(authRoutes.webRouter);
app.use('/', paymentRouter);
app.use('/', welcomeRouter);
app.use('/whale', whaleRouter);
app.use('/prefs', require('./routes/prefs'));
app.use(notificationRoutes.webRouter);
app.use('/forum', forumRouter);
app.use(userRoutes.webRouter);
app.use(searchRoutes.webRouter);
app.use('/', sitemapRouter);
app.use('/', pagesRouter);
app.use('/admin', require('./routes/admin'));

// API routes
app.use('/api', require('./routes/api'));
app.use('/api/auth', authRoutes.apiRouter);
app.use('/api/notifications', notificationRoutes.apiRouter);

// ─── ERROR HANDLING ─────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.use((err, req, res, _next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    return res.status(403).render('error', { title: 'Error', message: 'Invalid form token. Please try again.' });
  }

  console.error('Server Error:', err.stack || err);

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: isProd ? 'Internal server error' : err.message });
  }
  res.status(500).render('error', {
    title: 'Error',
    message: isProd ? 'Something went wrong' : err.message,
  });
});

// ─── START ──────────────────────────────────────────────────────────────────

async function start() {
  try {
    await ensureAdminFromEnv().catch((e) => console.warn('Admin bootstrap skipped:', e.message));
    startSubscriptionCron();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🐳 Whale running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') start();

// Graceful shutdown
const prisma = require('./lib/prisma');
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

module.exports = app;
module.exports.start = start;
