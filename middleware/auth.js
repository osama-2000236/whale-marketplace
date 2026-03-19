/**
 * Authentication & Authorization Middleware
 * يدعم نظام الجلسات الجديد مع التوافق مع لوحة الإدارة القديمة.
 */

const prisma = require('../lib/prisma');

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    pcSpecs: user.pcSpecs,
    role: user.role,
    reputation: user.reputation,
    reputationPoints: user.reputationPoints,
    isVerified: user.isVerified,
    isBanned: user.isBanned,
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt
  };
}

async function hydrateUser(req, res) {
  // Skip re-hydration if optionalAuth already populated req.user this request
  if (req._userHydrated) return;

  if (!req.session) {
    req.user = null;
    res.locals.currentUser = null;
    req._userHydrated = true;
    return;
  }

  // Legacy admin flag without a real userId is no longer trusted.
  // Admin access requires a valid userId linked to an ADMIN-role user in the DB.
  if (req.session.isAdmin && !req.session.userId) {
    req.session.isAdmin = false;
    req.user = null;
    res.locals.currentUser = null;
    req._userHydrated = true;
    return;
  }

  if (!req.session.userId) {
    req.user = null;
    res.locals.currentUser = null;
    req._userHydrated = true;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      bio: true,
      pcSpecs: true,
      role: true,
      reputation: true,
      reputationPoints: true,
      isVerified: true,
      isBanned: true,
      createdAt: true,
      lastSeenAt: true
    }
  });

  if (!user || user.isBanned) {
    req.session.userId = null;
    req.user = null;
    res.locals.currentUser = null;
    req._userHydrated = true;
    return;
  }

  req.user = sanitizeUser(user);
  res.locals.currentUser = req.user;
  req._userHydrated = true;
}

async function optionalAuth(req, res, next) {
  try {
    await hydrateUser(req, res);
    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireAuth(req, res, next) {
  try {
    await hydrateUser(req, res);

    if (!req.user) {
      if (req.accepts('html')) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireAdmin(req, res, next) {
  try {
    await hydrateUser(req, res);

    if (!req.user) {
      if (req.accepts('html')) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'ADMIN') {
      if (req.accepts('html')) {
        return res.status(403).render('error', {
          title: 'غير مصرح | Forbidden',
          message: 'هذه الصفحة للإدارة فقط | Admin only page'
        });
      }
      return res.status(403).json({ error: 'Admin access required' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireModerator(req, res, next) {
  try {
    await hydrateUser(req, res);

    if (!req.user) {
      if (req.accepts('html')) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!['ADMIN', 'MODERATOR'].includes(req.user.role)) {
      if (req.accepts('html')) {
        return res.status(403).render('error', {
          title: 'غير مصرح | Forbidden',
          message: 'هذه الصفحة للمشرفين والإدارة فقط | Moderators/Admin only'
        });
      }
      return res.status(403).json({ error: 'Moderator access required' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

function guestOnly(req, res, next) {
  if (req.session && (req.session.userId || req.session.isAdmin)) {
    return res.redirect('/');
  }
  return next();
}

module.exports = {
  optionalAuth,
  requireAuth,
  requireAdmin,
  requireModerator,
  guestOnly
};
