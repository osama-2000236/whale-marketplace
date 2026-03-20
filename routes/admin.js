const express = require('express');
const router = express.Router();
const { requireAdmin, guestOnly } = require('../middleware/auth');
const userService = require('../services/userService');
const productService = require('../services/productService');
const paymentService = require('../services/paymentService');
const referralService = require('../services/referralService');
const prisma = require('../lib/prisma');
const { upload, storeOneFile } = require('../utils/upload');
const { sanitizeText } = require('../utils/sanitize');
const { readJSON, writeJSON } = require('../utils/dataStore');
const fs = require('fs');
const path = require('path');

// ─── AUTH ───────────────────────────────────────────────────────────────────

router.get('/login', guestOnly, (req, res) => {
  res.render('admin/login', { title: 'Admin Login', error: null });
});

router.post('/login', guestOnly, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await userService.authenticateUser(username, password);
    if (user.role !== 'ADMIN') throw new Error('Not an admin');
    req.session.userId = user.id;
    req.session.isAdmin = true;
    req.session.adminUser = user.username;
    res.redirect('/admin/whale');
  } catch (e) {
    res.render('admin/login', { title: 'Admin Login', error: e.message });
  }
});

router.post('/logout', (req, res) => { req.session.destroy(() => res.redirect('/admin/login')); });
router.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/admin/login')); });

router.get('/', requireAdmin, (req, res) => res.redirect('/admin/whale'));

// ─── PRODUCTS ───────────────────────────────────────────────────────────────

router.get('/products', requireAdmin, async (req, res) => {
  const products = await productService.adminListProducts(req.query.category);
  res.render('admin/products', { title: 'Products', products, category: req.query.category });
});

router.get('/products/add', requireAdmin, (req, res) => {
  res.render('admin/product-form', { title: 'Add Product', product: null });
});

router.post('/products/add', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const image = await storeOneFile(req.file);
    const specs = parseSpecs(req.body);
    await productService.createProduct({
      name: req.body.name, nameAr: req.body.nameAr || null,
      category: req.body.category, price: parseInt(req.body.price, 10),
      oldPrice: req.body.oldPrice ? parseInt(req.body.oldPrice, 10) : null,
      description: req.body.description || null, specs, image,
      badge: req.body.badge || null, sortOrder: parseInt(req.body.sortOrder || '0', 10),
    });
    res.redirect('/admin/products');
  } catch (e) { res.redirect('/admin/products?error=' + encodeURIComponent(e.message)); }
});

router.get('/products/edit/:id', requireAdmin, async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  if (!product) return res.redirect('/admin/products');
  res.render('admin/product-form', { title: 'Edit Product', product });
});

router.post('/products/edit/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const data = {
      name: req.body.name, nameAr: req.body.nameAr || null,
      category: req.body.category, price: parseInt(req.body.price, 10),
      oldPrice: req.body.oldPrice ? parseInt(req.body.oldPrice, 10) : null,
      description: req.body.description || null, specs: parseSpecs(req.body),
      badge: req.body.badge || null, sortOrder: parseInt(req.body.sortOrder || '0', 10),
    };
    if (req.file) data.image = await storeOneFile(req.file);
    await productService.updateProduct(req.params.id, data);
    res.redirect('/admin/products');
  } catch (e) { res.redirect('/admin/products?error=' + encodeURIComponent(e.message)); }
});

router.post('/products/delete/:id', requireAdmin, async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (product?.image && product.image.startsWith('/uploads/')) {
      fs.unlink(path.join(__dirname, '..', 'public', product.image), () => {});
    }
    await productService.deleteProduct(req.params.id);
    res.redirect('/admin/products');
  } catch (e) { res.redirect('/admin/products'); }
});

router.post('/products/toggle/:id', requireAdmin, async (req, res) => {
  try {
    const field = req.body.field;
    if (!['inStock', 'featured'].includes(field)) return res.status(400).json({ error: 'Invalid field' });
    const product = await productService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    const updated = await productService.updateProduct(req.params.id, { [field]: !product[field] });
    res.json({ [field]: updated[field] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── LISTINGS ───────────────────────────────────────────────────────────────

router.get('/listings', requireAdmin, async (req, res) => {
  const listings = await prisma.marketplaceListing.findMany({
    orderBy: { createdAt: 'desc' },
    include: { seller: { select: { id: true, username: true } } },
  });
  res.render('admin/listings', { title: 'Listings', listings });
});

router.post('/listings/:id/remove', requireAdmin, async (req, res) => {
  await prisma.marketplaceListing.update({ where: { id: req.params.id }, data: { status: 'REMOVED' } });
  res.redirect('/admin/listings');
});

// ─── WHALE MODERATION ───────────────────────────────────────────────────────

router.get('/whale', requireAdmin, async (req, res) => {
  const [listings, orders, disputes, pendingVerifications] = await Promise.all([
    prisma.marketListing.findMany({ where: { status: 'ACTIVE' }, take: 50, orderBy: { createdAt: 'desc' }, include: { seller: { select: { id: true, username: true } }, category: true } }),
    prisma.order.findMany({ where: { orderStatus: { in: ['PENDING', 'DISPUTED'] } }, take: 30, orderBy: { createdAt: 'desc' }, include: { listing: true, buyer: { select: { id: true, username: true } }, seller: { select: { id: true, username: true } } } }),
    prisma.dispute.findMany({ where: { status: 'open' }, take: 20, orderBy: { createdAt: 'desc' }, include: { order: { include: { listing: true } } } }),
    prisma.sellerProfile.findMany({ where: { isVerified: false, totalSales: { gt: 0 } }, include: { user: { select: { id: true, username: true, avatar: true } } } }),
  ]);
  res.render('admin/whale', { title: 'Whale Admin', listings, orders, disputes, pendingVerifications });
});
router.get('/market', requireAdmin, (req, res) => res.redirect('/admin/whale'));

router.post('/whale/verify-seller', requireAdmin, async (req, res) => {
  const { userId } = req.body;
  await prisma.sellerProfile.upsert({
    where: { userId },
    create: { userId, isVerified: true, verifiedAt: new Date() },
    update: { isVerified: true, verifiedAt: new Date() },
  });
  await prisma.notification.create({
    data: { userId, type: 'SYSTEM', message: '✅ تم توثيق حسابك كبائع موثوق!' },
  }).catch(() => {});
  res.redirect('/admin/whale');
});

router.post('/whale/suspend-listing', requireAdmin, async (req, res) => {
  const { listingId, reason } = req.body;
  const listing = await prisma.marketListing.update({ where: { id: listingId }, data: { status: 'SUSPENDED' } });
  await prisma.notification.create({
    data: { userId: listing.sellerId, type: 'SYSTEM', message: `تم إيقاف إعلانك: ${reason || 'مخالفة الشروط'}`, referenceId: listingId, referenceType: 'listing' },
  }).catch(() => {});
  res.redirect('/admin/whale');
});

router.post('/whale/resolve-dispute', requireAdmin, async (req, res) => {
  const { disputeId, resolution, winner } = req.body;
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId }, include: { order: true } });
  if (!dispute) return res.redirect('/admin/whale');

  await prisma.dispute.update({ where: { id: disputeId }, data: { status: 'resolved', resolution } });

  if (winner === 'buyer') {
    await prisma.order.update({ where: { id: dispute.orderId }, data: { orderStatus: 'REFUNDED', paymentStatus: 'refunded' } });
  } else {
    await prisma.order.update({ where: { id: dispute.orderId }, data: { orderStatus: 'COMPLETED', paymentStatus: 'released' } });
  }

  await prisma.notification.create({ data: { userId: dispute.order.buyerId, type: 'SYSTEM', message: `تم حل النزاع: ${resolution}` } }).catch(() => {});
  await prisma.notification.create({ data: { userId: dispute.order.sellerId, type: 'SYSTEM', message: `تم حل النزاع: ${resolution}` } }).catch(() => {});

  res.redirect('/admin/whale');
});

// ─── QR / REFERRALS ─────────────────────────────────────────────────────────

router.get('/qr', requireAdmin, async (req, res) => {
  const codes = await referralService.getAllCodes();
  const generalUrls = referralService.getGeneralQRUrls();
  const qrCodes = [];
  for (const c of codes) {
    const url = `${process.env.SITE_URL || 'https://whale.ps'}/welcome?ref=${c.code}`;
    const dataUrl = await referralService.generateQRDataUrl(url, 256);
    qrCodes.push({ ...c, url, dataUrl });
  }
  const generalQRs = [];
  for (const g of generalUrls) {
    const dataUrl = await referralService.generateQRDataUrl(g.url, 256);
    generalQRs.push({ ...g, dataUrl });
  }
  res.render('admin/qr', { title: 'QR Codes', qrCodes, generalQRs });
});

router.post('/qr/generate', requireAdmin, async (req, res) => {
  const label = sanitizeText(req.body.label, 100);
  if (label.length < 3) return res.redirect('/admin/qr?error=label_too_short');
  await referralService.createReferralCode(label);
  res.redirect('/admin/qr');
});

router.get('/qr/download/:code', requireAdmin, async (req, res) => {
  const url = `${process.env.SITE_URL || 'https://whale.ps'}/welcome?ref=${req.params.code}`;
  const buffer = await referralService.generateQRBuffer(url, 512);
  res.set({ 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="whale-qr-${req.params.code}.png"` });
  res.send(buffer);
});

router.get('/qr/download-general', requireAdmin, async (req, res) => {
  const url = req.query.url || `${process.env.SITE_URL || 'https://whale.ps'}/whale`;
  const label = req.query.label || 'whale';
  const buffer = await referralService.generateQRBuffer(url, 512);
  res.set({ 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="whale-qr-${label}.png"` });
  res.send(buffer);
});

// ─── SUBSCRIPTIONS ──────────────────────────────────────────────────────────

router.get('/subscriptions', requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    include: { subscription: true },
    orderBy: { createdAt: 'desc' },
  });
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { id: true, username: true } } },
  });
  const totalRevenue = await prisma.payment.aggregate({ where: { status: 'success' }, _sum: { amount: true } });
  res.render('admin/subscriptions', { title: 'Subscriptions', users, payments, totalRevenue: totalRevenue._sum.amount || 0 });
});

router.post('/subscriptions/activate', requireAdmin, async (req, res) => {
  try {
    const { userId, planMonths, note } = req.body;
    await paymentService.adminActivateManual(userId, parseInt(planMonths || '1', 10), note);
    res.redirect('/admin/subscriptions');
  } catch (e) { res.redirect('/admin/subscriptions?error=' + encodeURIComponent(e.message)); }
});

// ─── SETTINGS ───────────────────────────────────────────────────────────────

router.get('/settings', requireAdmin, (req, res) => {
  const config = readJSON('config.json') || {};
  res.render('admin/settings', { title: 'Settings', config });
});

router.post('/settings', requireAdmin, (req, res) => {
  const config = readJSON('config.json') || {};
  config.siteName = req.body.siteName || config.siteName;
  config.siteNameAr = req.body.siteNameAr || config.siteNameAr;
  config.tagline = req.body.tagline || config.tagline;
  config.taglineAr = req.body.taglineAr || config.taglineAr;
  if (config.contact) {
    config.contact.email = req.body.contactEmail || config.contact.email;
    config.contact.phone = req.body.contactPhone || config.contact.phone;
    config.contact.whatsapp = req.body.contactWhatsapp || config.contact.whatsapp;
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
