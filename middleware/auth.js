const prisma = require('../lib/prisma');

const ADMIN_SCOPE_PERMISSIONS = {
  SUPER_ADMIN: [
    'users.read',
    'users.write',
    'users.ban',
    'roles.write',
    'catalog.read',
    'catalog.write',
    'orders.read',
    'orders.write',
    'refunds.write',
    'payments.read',
    'payments.write',
  ],
  SUPPORT_AGENT: [
    'users.read',
    'users.ban',
    'orders.read',
    'orders.write',
    'refunds.write',
    'payments.read',
  ],
  WAREHOUSE: ['orders.read', 'orders.write', 'catalog.read', 'catalog.write'],
};

function hasAdminPermission(user, permission) {
  if (!user || user.role !== 'ADMIN') return false;
  const scope = user.adminScope || 'SUPER_ADMIN';
  const permissions = ADMIN_SCOPE_PERMISSIONS[scope] || ADMIN_SCOPE_PERMISSIONS.SUPER_ADMIN;
  return permissions.includes(permission);
}

const optionalAuth = (req, res, next) => {
  res.locals.user = req.user || null;
  next();
};

const requireAuth = (req, res, next) => {
  if (!req.user) {
    req.session.flash = { type: 'warning', message: 'Please log in to continue' };
    return res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));
  }
  res.locals.user = req.user;
  next();
};

function enforceAdminTwoFactor(req, res) {
  if (req.user?.twoFactorSecret && !req.session?.admin2FAVerified) {
    req.session.flash = { type: 'warning', message: 'Admin verification required.' };
    res.redirect('/auth/2fa');
    return true;
  }
  return false;
}

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).render('error', {
      title: 'Forbidden',
      message: 'You do not have permission to access this page.',
      status: 403,
    });
  }
  if (enforceAdminTwoFactor(req, res)) return;
  next();
};

const requireAdminScope = (...scopes) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).render('error', {
        title: 'Forbidden',
        message: 'You do not have permission to access this page.',
        status: 403,
      });
    }
    if (enforceAdminTwoFactor(req, res)) return;

    const scope = req.user.adminScope || 'SUPER_ADMIN';
    if (scope === 'SUPER_ADMIN' || scopes.includes(scope)) return next();

    return res.status(403).render('error', {
      title: 'Forbidden',
      message: 'You do not have the required admin scope for this action.',
      status: 403,
    });

  };
};

const requireAdmin2FA = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).render('error', {
      title: 'Forbidden',
      message: 'Admin access required.',
      status: 403,
    });
  }

  if (enforceAdminTwoFactor(req, res)) return;

  next();
};

/**
 * Requires active Pro subscription (plan='pro' with valid paidUntil, or in free trial)
 */
const requirePro = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));

    // Admins always pass
    if (req.user.role === 'ADMIN') return next();

    const sub =
      req.user.subscription ||
      (await prisma.subscription.findUnique({ where: { userId: req.user.id } }));
    if (!sub) {
      req.session.flash = { type: 'warning', message: 'flash.pro_required' };
      return res.redirect('/upgrade');
    }

    const now = new Date();
    const isPro = sub.plan === 'pro' && sub.paidUntil && sub.paidUntil > now;
    const inTrial = sub.trialEndsAt && sub.trialEndsAt > now;

    if (!isPro && !inTrial) {
      req.session.flash = { type: 'warning', message: 'flash.pro_required' };
      return res.redirect('/upgrade');
    }

    next();
  } catch (err) {
    next(err);
  }
};

const requireVerified = (req, res, next) => {
  if (!req.user) {
    req.session.flash = { type: 'warning', message: 'Please log in to continue' };
    return res.redirect('/auth/login?next=' + encodeURIComponent(req.originalUrl));
  }
  if (!req.user.isVerified) {
    req.session.flash = {
      type: 'warning',
      message: 'Please verify your email before using this action.',
    };
    return res.redirect('/profile');
  }
  next();
};

/**
 * Requires that the current user is a party (buyer or seller) of the order
 */
const requireOrderParty = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).render('404', { title: '404' });

    const isParty = req.user.id === order.buyerId || req.user.id === order.sellerId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isParty && !isAdmin) {
      return res.status(403).render('error', {
        title: 'Forbidden',
        message: 'You are not part of this order.',
        status: 403,
      });
    }

    req.order = order;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Requires that the current user is the seller of the order
 */
const requireSeller = async (req, res, next) => {
  const order = req.order || (await prisma.order.findUnique({ where: { id: req.params.id } }));
  if (!order) return res.status(404).render('404', { title: '404' });

  if (req.user.id !== order.sellerId && req.user.role !== 'ADMIN') {
    return res.status(403).render('error', {
      title: 'Forbidden',
      message: 'Only the seller can perform this action.',
      status: 403,
    });
  }
  req.order = order;
  next();
};

/**
 * Requires that the current user is the buyer of the order
 */
const requireBuyer = async (req, res, next) => {
  const order = req.order || (await prisma.order.findUnique({ where: { id: req.params.id } }));
  if (!order) return res.status(404).render('404', { title: '404' });

  if (req.user.id !== order.buyerId && req.user.role !== 'ADMIN') {
    return res.status(403).render('error', {
      title: 'Forbidden',
      message: 'Only the buyer can perform this action.',
      status: 403,
    });
  }
  req.order = order;
  next();
};

/**
 * Requires that the current user owns the listing
 */
const requireOwner = async (req, res, next) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).render('404', { title: '404' });

    if (req.user.id !== listing.sellerId && req.user.role !== 'ADMIN') {
      return res.status(403).render('error', {
        title: 'Forbidden',
        message: 'You do not own this listing.',
        status: 403,
      });
    }
    req.listing = listing;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  optionalAuth,
  requireAuth,
  requireAdmin,
  requireAdminScope,
  requireAdmin2FA,
  requireVerified,
  requirePro,
  requireOrderParty,
  requireSeller,
  requireBuyer,
  requireOwner,
  hasAdminPermission,
};
