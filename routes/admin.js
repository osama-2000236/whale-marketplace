const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const whaleService = require('../services/whaleService');

router.use(requireAuth, requireAdmin);

// Dashboard
router.get('/', async (req, res, next) => {
  try {
    const [userCount, listingCount, orderCount, revenue] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count(),
      prisma.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    ]);
    res.render('admin/dashboard', {
      title: res.locals.t('admin.dashboard'),
      stats: { userCount, listingCount, orderCount, revenue: revenue._sum.amount || 0 },
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
router.post('/users/:id/ban', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).render('404', { title: '404' });

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: !user.isBanned },
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
router.post('/listings/:id/remove', async (req, res, next) => {
  try {
    await whaleService.deleteListing(req.params.id, req.user.id, true);
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
router.post('/orders/:id/resolve', async (req, res, next) => {
  try {
    const resolution = req.body.resolution; // 'complete' or 'cancel'
    await whaleService.transitionOrder(req.params.id, req.user.id, 'resolve', { resolution });
    req.session.flash = { type: 'success', message: 'Dispute resolved' };
    res.redirect('/admin/orders');
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/admin/orders');
  }
  if (config.social) {
    config.social.facebook = req.body.socialFacebook || config.social.facebook;
    config.social.instagram = req.body.socialInstagram || config.social.instagram;
    config.social.tiktok = req.body.socialTiktok || config.social.tiktok;
  }
  writeJSON('config.json', config);
  res.redirect('/admin/settings?saved=1');
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

function parseSpecs(body) {
  if (!body['spec_key[]']) return null;
  const keys = Array.isArray(body['spec_key[]']) ? body['spec_key[]'] : [body['spec_key[]']];
  const vals = Array.isArray(body['spec_val[]']) ? body['spec_val[]'] : [body['spec_val[]']];
  const specs = {};
  keys.forEach((k, i) => { if (k && vals[i]) specs[k] = vals[i]; });
  return Object.keys(specs).length ? specs : null;
}

module.exports = router;
