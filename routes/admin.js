const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin, requireAdminScope } = require('../middleware/auth');
const whaleService = require('../services/whaleService');
const auditService = require('../services/adminAuditService');
const authSecurityService = require('../services/authSecurityService');
const { sanitizeBody } = require('../utils/sanitize');

router.use(requireAuth, requireAdmin);

// Dashboard
router.get('/', async (req, res, next) => {
  try {
    const [userCount, listingCount, orderCount, revenue, refundCount] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count(),
      prisma.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.refundRequest.count({ where: { status: 'REQUESTED' } }),
    ]);
    res.render('admin/dashboard', {
      title: res.locals.t('admin.dashboard'),
      stats: {
        userCount,
        listingCount,
        orderCount,
        revenue: revenue._sum.amount || 0,
        refundCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Users
router.get('/users', async (req, res, next) => {
  try {
    const q = req.query.q || '';
    const where = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { subscription: true },
    });
    res.render('admin/users', { title: res.locals.t('admin.users'), users, q });
  } catch (err) {
    next(err);
  }
});

// Ban/unban user
router.post('/users/:id/ban', requireAdminScope('SUPER_ADMIN', 'SUPPORT_AGENT'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).render('404', { title: '404' });

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: !user.isBanned },
    });

    await auditService.log({
      adminId: req.user.id,
      action: user.isBanned ? 'USER_UNBAN' : 'USER_BAN',
      target: 'User',
      targetId: req.params.id,
      details: { username: user.username },
      ip: req.ip,
    });

    req.session.flash = {
      type: 'success',
      message: user.isBanned ? 'User unbanned' : 'User banned',
    };
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
});

// Listings moderation
router.get('/listings', async (req, res, next) => {
  try {
    const listings = await prisma.listing.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        seller: { select: { username: true } },
        category: true,
      },
    });
    res.render('admin/listings', { title: res.locals.t('admin.listings'), listings });
  } catch (err) {
    next(err);
  }
});

// Remove listing
router.post('/listings/:id/remove', requireAdminScope('SUPER_ADMIN', 'SUPPORT_AGENT'), async (req, res, next) => {
  try {
    await whaleService.deleteListing(req.params.id, req.user.id, true);

    await auditService.log({
      adminId: req.user.id,
      action: 'LISTING_REMOVE',
      target: 'Listing',
      targetId: req.params.id,
      ip: req.ip,
    });

    req.session.flash = { type: 'success', message: 'Listing removed' };
    res.redirect('/admin/listings');
  } catch (err) {
    next(err);
  }
});

// Orders
router.get('/orders', async (req, res, next) => {
  try {
    const status = req.query.status;
    const where = status ? { status } : {};
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        listing: { select: { title: true } },
        buyer: { select: { username: true } },
        seller: { select: { username: true } },
      },
    });
    res.render('admin/orders', {
      title: res.locals.t('admin.orders'),
      orders,
      status: status || '',
    });
  } catch (err) {
    next(err);
  }
});

// Resolve dispute
router.post('/orders/:id/resolve', requireAdminScope('SUPER_ADMIN', 'SUPPORT_AGENT'), async (req, res, next) => {
  try {
    const resolution = req.body.resolution;
    await whaleService.transitionOrder(req.params.id, req.user.id, 'resolve', { resolution });

    await auditService.log({
      adminId: req.user.id,
      action: 'DISPUTE_RESOLVE',
      target: 'Order',
      targetId: req.params.id,
      details: { resolution },
      ip: req.ip,
    });

    req.session.flash = { type: 'success', message: 'Dispute resolved' };
    res.redirect('/admin/orders');
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/admin/orders');
  }
});

// Audit logs
router.get('/audit', requireAdminScope('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { logs, nextCursor } = await auditService.getLogs({
      action: req.query.action,
      cursor: req.query.cursor,
    });
    res.render('admin/audit', {
      title: res.locals.t('admin.audit'),
      logs,
      nextCursor,
      action: req.query.action || '',
    });
  } catch (err) {
    next(err);
  }
});

// Coupons management
router.get('/coupons', requireAdminScope('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const coupons = await auditService.getCoupons();
    res.render('admin/coupons', { title: res.locals.t('admin.coupons'), coupons });
  } catch (err) {
    next(err);
  }
});

router.post('/coupons', requireAdminScope('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body, {
      code: 30,
      discountType: 10,
      discountValue: 10,
      minOrderAmount: 10,
      maxUses: 10,
      expiresAt: 30,
    });
    await auditService.createCoupon(data);

    await auditService.log({
      adminId: req.user.id,
      action: 'COUPON_CREATE',
      target: 'Coupon',
      details: { code: data.code },
      ip: req.ip,
    });

    req.session.flash = { type: 'success', message: 'Coupon created' };
    res.redirect('/admin/coupons');
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/admin/coupons');
  }
});

router.post('/coupons/:id/toggle', requireAdminScope('SUPER_ADMIN'), async (req, res, next) => {
  try {
    await auditService.toggleCoupon(req.params.id);
    res.redirect('/admin/coupons');
  } catch (err) {
    next(err);
  }
});

// Refund requests
router.get('/refunds', requireAdminScope('SUPER_ADMIN', 'SUPPORT_AGENT'), async (req, res, next) => {
  try {
    const refunds = await auditService.getRefundRequests(req.query.status);
    res.render('admin/refunds', {
      title: res.locals.t('admin.refunds'),
      refunds,
      status: req.query.status || '',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refunds/:id', requireAdminScope('SUPER_ADMIN', 'SUPPORT_AGENT'), async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    await auditService.processRefund(req.params.id, req.user.id, { status, adminNote });

    await auditService.log({
      adminId: req.user.id,
      action: 'REFUND_' + status.toUpperCase(),
      target: 'RefundRequest',
      targetId: req.params.id,
      details: { adminNote },
      ip: req.ip,
    });

    req.session.flash = { type: 'success', message: 'Refund ' + status };
    res.redirect('/admin/refunds');
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/admin/refunds');
  }
});

// Admin 2FA setup
router.post('/setup-2fa', requireAdminScope('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { secret, otpauthUrl } = await authSecurityService.setupAdmin2FA(req.user.id);
    // Never expose the raw secret in flash messages — store in session for one-time display
    req.session.pending2FA = { secret, otpauthUrl };
    req.session.flash = { type: 'success', message: '2FA enabled. Please scan the QR code or copy your secret from the setup page.' };
    res.redirect('/admin/confirm-2fa');
  } catch (err) {
    next(err);
  }
});

// 2FA setup confirmation page — shows secret once, then clears it from session
router.get('/confirm-2fa', requireAdminScope('SUPER_ADMIN'), (req, res) => {
  const pending = req.session.pending2FA;
  if (!pending) {
    req.session.flash = { type: 'info', message: '2FA setup has already been completed.' };
    return res.redirect('/admin');
  }
  // Clear from session after reading — secret is shown only once
  delete req.session.pending2FA;
  req.session.save();
  res.render('admin/confirm-2fa', {
    title: '2FA Setup',
    secret: pending.secret,
    otpauthUrl: pending.otpauthUrl,
  });
});

module.exports = router;
