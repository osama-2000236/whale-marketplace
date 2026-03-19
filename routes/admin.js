/**
 * Admin Routes
 * لوحة التحكم التقليدية للمتجر
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const { guestOnly, requireAdmin, optionalAuth } = require('../middleware/auth');
const { authenticateUser } = require('../services/userService');
const productService = require('../services/productService');
const marketplaceService = require('../services/marketplaceService');
const referralService = require('../services/referralService');
const paymentService = require('../services/paymentService');
const { upload, storeOneFile } = require('../utils/upload');
const { sanitizeText } = require('../utils/sanitize');
const prisma = require('../lib/prisma');

const router = express.Router();
const categories = require('../data/categories.json');

// Rate limiter for admin login — stricter than regular auth
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again later.'
});

function parseSpecs(body) {
  const specKeys = body.specKey || [];
  const specValues = body.specValue || [];
  const specs = {};

  if (Array.isArray(specKeys)) {
    specKeys.forEach((key, i) => {
      if (key && specValues[i]) specs[key] = specValues[i];
    });
  } else if (specKeys && specValues) {
    specs[specKeys] = specValues;
  }

  return specs;
}

router.get('/login', guestOnly, (req, res) => {
  res.render('admin/login', {
    title: 'Admin Login',
    error: null,
    layout: false
  });
});

router.post('/login', guestOnly, adminLoginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await authenticateUser(username, password);
    if (user.role !== 'ADMIN') {
      throw new Error('Only admins can access this panel');
    }

    // Capture returnTo before regeneration and validate it
    const rawReturnTo = req.session.returnTo;
    const returnTo = (rawReturnTo && typeof rawReturnTo === 'string' &&
      rawReturnTo.startsWith('/admin') && !rawReturnTo.startsWith('//'))
      ? rawReturnTo : '/admin';

    // Regenerate session to prevent session fixation
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    req.session.userId = user.id;
    req.session.isAdmin = true;
    req.session.adminUser = user.username;

    return res.redirect(returnTo);
  } catch (_error) {
    return res.status(401).render('admin/login', {
      title: 'Admin Login',
      error: 'Invalid username or password',
      layout: false
    });
  }
});

router.post('/logout', optionalAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// GET /admin/logout removed — POST-only to prevent CSRF-based logout

router.get('/', requireAdmin, (_req, res) => res.redirect('/admin/whale'));

router.get('/products', requireAdmin, async (req, res, next) => {
  try {
    const { category } = req.query;
    const allProducts = await productService.adminListProducts(category || undefined);

    return res.render('admin/products', {
      title: 'Manage Products',
      products: allProducts,
      categories,
      activeCategory: category || ''
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/products/add', requireAdmin, (_req, res) => {
  res.render('admin/product-form', {
    title: 'Add Product',
    product: null,
    categories,
    error: null
  });
});

router.post('/products/add', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const image = req.file ? await storeOneFile(req.file, 'images/products') : '/images/products/placeholder.svg';

    await productService.createProduct({
      name: req.body.name || req.body.nameAr,
      nameAr: req.body.nameAr,
      category: req.body.category,
      price: Number(req.body.price) || 0,
      oldPrice: req.body.oldPrice ? Number(req.body.oldPrice) : null,
      description: req.body.description,
      specs: parseSpecs(req.body),
      image,
      badge: req.body.badge || '',
      inStock: req.body.inStock === 'on' || req.body.inStock === 'true',
      featured: req.body.featured === 'on' || req.body.featured === 'true',
      sortOrder: Number(req.body.sortOrder) || Date.now()
    });

    return res.redirect('/admin/products');
  } catch (error) {
    return res.status(400).render('admin/product-form', {
      title: 'Add Product',
      product: req.body,
      categories,
      error: error.message
    });
  }
});

router.get('/products/edit/:id', requireAdmin, async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) return res.redirect('/admin/products');

    return res.render('admin/product-form', {
      title: 'Edit Product',
      product,
      categories,
      error: null
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/products/edit/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).render('error', {
        title: 'غير موجود | Not found',
        message: 'المنتج غير موجود | Product not found'
      });
    }

    const updates = {
      name: req.body.name || req.body.nameAr,
      nameAr: req.body.nameAr,
      category: req.body.category,
      price: Number(req.body.price) || 0,
      oldPrice: req.body.oldPrice ? Number(req.body.oldPrice) : null,
      description: req.body.description,
      specs: parseSpecs(req.body),
      badge: req.body.badge || '',
      inStock: req.body.inStock === 'on' || req.body.inStock === 'true',
      featured: req.body.featured === 'on' || req.body.featured === 'true'
    };

    if (req.file) {
      updates.image = await storeOneFile(req.file, 'images/products');

      if (product.image && !product.image.includes('placeholder') && product.image.startsWith('/')) {
        const oldPath = path.join(__dirname, '..', 'public', product.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    await productService.updateProduct(req.params.id, updates);
    return res.redirect('/admin/products');
  } catch (error) {
    return res.status(400).render('admin/product-form', {
      title: 'Edit Product',
      product: { ...req.body, id: req.params.id },
      categories,
      error: error.message
    });
  }
});

router.post('/products/delete/:id', requireAdmin, async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (product) {
      if (product.image && !product.image.includes('placeholder') && product.image.startsWith('/')) {
        const imgPath = path.join(__dirname, '..', 'public', product.image);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
      await productService.deleteProduct(req.params.id);
    }

    return res.redirect('/admin/products');
  } catch (error) {
    return res.status(400).render('error', {
      title: 'خطأ | Error',
      message: error.message
    });
  }
});

router.post('/products/toggle/:id', requireAdmin, async (req, res) => {
  try {
    const { field } = req.body;
    if (!['inStock', 'featured'].includes(field)) {
      return res.status(400).json({ error: 'Invalid field' });
    }

    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Not found' });
    }

    const updated = await productService.updateProduct(req.params.id, {
      [field]: !product[field]
    });

    return res.json({ success: true, value: updated[field] });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/listings', requireAdmin, async (req, res, next) => {
  try {
    const listings = await prisma.marketplaceListing.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        seller: {
          select: {
            username: true
          }
        }
      }
    });

    return res.render('admin/listings', {
      title: 'Marketplace Moderation',
      listings
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/listings/:id/remove', requireAdmin, async (req, res) => {
  try {
    await marketplaceService.updateListing({
      listingId: req.params.id,
      actor: req.user,
      data: { status: 'REMOVED' }
    });
    return res.redirect('/admin/listings');
  } catch (error) {
    return res.status(400).render('error', {
      title: 'خطأ | Error',
      message: error.message
    });
  }
});

// GET /admin/qr — QR management page
router.get('/qr', requireAdmin, async (req, res) => {
  try {
    const codes = await referralService.getAllCodes();
    const generalUrls = referralService.getGeneralQRUrls();

    const generalQRs = await Promise.all(
      generalUrls.map(async (item) => ({
        ...item,
        qrDataUrl: await referralService.generateQRDataUrl(item.url, 256)
      }))
    );

    return res.render('admin/qr', {
      title: 'QR & Referral Management',
      codes,
      generalQRs,
      success: req.query.success || null,
      error: req.query.error || null,
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).render('error', { message: 'Server error', title: 'Server Error' });
  }
});

// POST /admin/qr/generate — generate a new customer QR
router.post('/qr/generate', requireAdmin, async (req, res) => {
  try {
    const { label } = req.body;
    if (!label || label.trim().length < 3) {
      return res.redirect('/admin/qr?error=label_required');
    }

    await referralService.createReferralCode(label.trim());
    return res.redirect('/admin/qr?success=1');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.redirect('/admin/qr?error=server');
  }
});

// GET /admin/qr/download/:code — download QR as PNG
router.get('/qr/download/:code', requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;
    const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/welcome?ref=${encodeURIComponent(code)}`;
    const buffer = await referralService.generateQRBuffer(url, 512);

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${code}.png"`
    });
    return res.send(buffer);
  } catch (_err) {
    return res.status(500).send('Error generating QR');
  }
});

// GET /admin/qr/download-general — download a general QR by URL param
router.get('/qr/download-general', requireAdmin, async (req, res) => {
  try {
    const { url, label } = req.query;
    if (!url) return res.status(400).send('Missing url');

    const buffer = await referralService.generateQRBuffer(String(url), 512);
    const safeLabel = String(label || 'qr').replace(/[^a-z0-9]/gi, '-').toLowerCase();

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${safeLabel}.png"`
    });

    return res.send(buffer);
  } catch (_err) {
    return res.status(500).send('Error generating QR');
  }
});

// GET /admin/subscriptions — manage all user subscriptions
router.get('/subscriptions', requireAdmin, async (req, res, next) => {
  try {
    const [users, recentPayments, totalRevenue] = await Promise.all([
      prisma.user.findMany({
        include: { subscription: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.findMany({
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.payment.aggregate({
        where: { status: 'success', currency: 'NIS' },
        _sum: { amount: true }
      })
    ]);

    return res.render('admin/subscriptions', {
      title: 'Subscriptions Management',
      users,
      recentPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return next(error);
  }
});

// POST /admin/subscriptions/activate — one-click Pro activation
router.post('/subscriptions/activate', requireAdmin, async (req, res) => {
  const { userId, planMonths = '1', note = 'Admin manual activation' } = req.body;
  try {
    const months = Math.max(1, Math.min(12, parseInt(planMonths, 10) || 1));
    await paymentService.adminActivateManual(userId, months, note);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /admin/market or /admin/whale — marketplace moderation
router.get(['/market', '/whale'], requireAdmin, async (req, res) => {
  try {
    const [listings, orders, disputes, pendingVerifications] = await Promise.all([
      prisma.marketListing.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          seller: { select: { username: true } },
          category: true
        }
      }),
      prisma.order.findMany({
        where: { orderStatus: { in: ['PENDING', 'DISPUTED'] } },
        take: 30,
        include: {
          listing: true,
          buyer: { select: { username: true } },
          seller: { select: { username: true } }
        }
      }),
      prisma.dispute.findMany({
        where: { status: 'open' },
        take: 20,
        include: {
          order: {
            select: { orderNumber: true, buyerId: true, sellerId: true }
          }
        }
      }),
      prisma.sellerProfile.findMany({
        where: { isVerified: false, totalSales: { gt: 0 } },
        include: {
          user: { select: { id: true, username: true } }
        },
        orderBy: { totalSales: 'desc' }
      })
    ]);

    return res.render('admin/whale', {
      title: 'Whale Moderation',
      listings,
      orders,
      disputes,
      pendingVerifications,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

// POST /admin/whale/verify-seller
router.post('/whale/verify-seller', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    await prisma.sellerProfile.upsert({
      where: { userId },
      update: { isVerified: true, verifiedAt: new Date() },
      create: { userId, isVerified: true, verifiedAt: new Date() }
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        message: '✅ تم توثيق حسابك كبائع موثق — Your seller account is now verified!'
      }
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /admin/whale/suspend-listing
router.post('/whale/suspend-listing', requireAdmin, async (req, res) => {
  try {
    const { listingId, reason } = req.body;
    if (!listingId) return res.status(400).json({ error: 'listingId required' });

    const listing = await prisma.marketListing.update({
      where: { id: listingId },
      data: { status: 'SUSPENDED' },
      include: { seller: { select: { id: true } } }
    });

    await prisma.notification.create({
      data: {
        userId: listing.seller.id,
        type: 'SYSTEM',
        message: `⚠️ تم تعليق إعلانك من الإدارة | Your listing was suspended by admin. ${reason || ''}`.trim()
      }
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /admin/whale/resolve-dispute
router.post('/whale/resolve-dispute', requireAdmin, async (req, res) => {
  try {
    const { disputeId, resolution, winner } = req.body;
    if (!disputeId || !winner) {
      return res.status(400).json({ error: 'disputeId and winner are required' });
    }
    if (!['buyer', 'seller'].includes(winner)) {
      return res.status(400).json({ error: 'winner must be buyer or seller' });
    }

    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: `resolved_${winner}`,
        resolution: resolution || null,
        resolvedBy: req.session.userId
      },
      include: {
        order: true
      }
    });

    await prisma.order.update({
      where: { id: updatedDispute.orderId },
      data: {
        orderStatus: winner === 'buyer' ? 'REFUNDED' : 'COMPLETED',
        paymentStatus: winner === 'buyer' ? 'refunded' : 'released'
      }
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: updatedDispute.order.buyerId,
          type: 'SYSTEM',
          message: `📣 تم حسم النزاع للطلب ${updatedDispute.order.orderNumber} | Dispute resolved by admin`
        },
        {
          userId: updatedDispute.order.sellerId,
          type: 'SYSTEM',
          message: `📣 تم حسم النزاع للطلب ${updatedDispute.order.orderNumber} | Dispute resolved by admin`
        }
      ]
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/settings', requireAdmin, (_req, res) => {
  const configPath = path.join(__dirname, '..', 'data', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  res.render('admin/settings', {
    title: 'Site Settings',
    siteConfig: config,
    success: _req.query.success === 'true'
  });
});

router.post('/settings', requireAdmin, (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'data', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    if (req.body.siteName) config.siteName = sanitizeText(req.body.siteName, 100);
    if (req.body.taglineAr) config.taglineAr = sanitizeText(req.body.taglineAr, 200);
    if (req.body.description) config.description = sanitizeText(req.body.description, 1000);
    if (req.body.phone) config.contact.phone = sanitizeText(req.body.phone, 20);
    if (req.body.email) config.contact.email = sanitizeText(req.body.email, 255);
    if (req.body.whatsapp) config.contact.whatsapp = sanitizeText(req.body.whatsapp, 20);
    if (req.body.facebook) config.social.facebook = sanitizeText(req.body.facebook, 200);
    if (req.body.instagram) config.social.instagram = sanitizeText(req.body.instagram, 200);
    if (req.body.cityAr) config.location.cityAr = sanitizeText(req.body.cityAr, 100);
    if (req.body.fullAddress) config.location.fullAddress = sanitizeText(req.body.fullAddress, 300);

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return res.redirect('/admin/settings?success=true');
  } catch (_error) {
    return res.redirect('/admin/settings');
  }
});

module.exports = router;
