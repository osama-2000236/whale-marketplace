const router = require('express').Router();
const whaleService = require('../services/whaleService');
const {
  requireAuth,
  requireVerified,
  requirePro,
  requireOwner,
  requireOrderParty,
  requireSeller,
  requireBuyer,
} = require('../middleware/auth');
const { sanitizeBody } = require('../utils/sanitize');
const { upload, processImages } = require('../utils/images');
const { FALLBACK_CATEGORY, createFallbackListing } = require('../lib/fallbackMarketplace');

const CITIES = ['Gaza', 'Ramallah', 'Nablus', 'Hebron', 'Jenin', 'Jerusalem'];

// Browse listings
router.get('/', async (req, res) => {
  const filters = {
    q: req.query.q,
    categorySlug: req.query.category,
    city: req.query.city,
    condition: req.query.condition,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    sort: req.query.sort,
    cursor: req.query.cursor,
  };

  let listings = [];
  let nextCursor = null;
  let total = 0;
  let categories = [];
  let degraded = false;

  try {
    const result = await Promise.all([whaleService.getListings(filters), whaleService.getCategories()]);
    listings = result[0]?.listings || [];
    nextCursor = result[0]?.nextCursor || null;
    total = result[0]?.total || 0;
    categories = result[1] || [];
  } catch (err) {
    degraded = true;
    console.error('[whale/browse] data bootstrap failed:', err.message);
  }

  if (!categories.length) categories = [FALLBACK_CATEGORY];
  if (!listings.length) listings = [createFallbackListing()];

  res.render('whale/index', {
    title: res.locals.t('whale.browse'),
    listings,
    nextCursor,
    total,
    categories,
    filters,
    cities: CITIES,
    degraded,
  });
});

// Listing detail
router.get('/listing/:slug', async (req, res, next) => {
  try {
    let listing = await whaleService.getListing(req.params.slug);
    if (!listing && req.params.slug === '__fallback-market-item') {
      listing = createFallbackListing();
    }
    if (!listing) return res.status(404).render('404', { title: '404' });

    let isSaved = false;
    if (req.user) {
      isSaved = await whaleService.isSaved(req.user.id, listing.id);
    }

    res.render('whale/listing', { title: listing.title, listing, isSaved });
  } catch (err) {
    // Treat Prisma "table/column does not exist" as not-found rather than 500
    if (err.code === 'P2010' || err.message?.includes('does not exist')) {
      return res.status(404).render('404', { title: '404' });
    }
    next(err);
  }
});

// Seller profile
router.get('/seller/:username', async (req, res, next) => {
  try {
    const userService = require('../services/userService');
    const profile = await userService.getProfile(req.params.username, req.user?.id);
    res.render('whale/seller', {
      title: profile.sellerProfile?.displayName || profile.username,
      profile,
    });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).render('404', { title: '404' });
    next(err);
  }
});

// Save/unsave listing
router.post('/listing/:id/save', requireAuth, async (req, res, next) => {
  try {
    const result = await whaleService.toggleSaved(req.user.id, req.params.id);
    if (req.headers['content-type']?.includes('json')) {
      return res.json(result);
    }
    req.session.flash = {
      type: 'success',
      message: res.locals.t(result.saved ? 'flash.saved' : 'flash.unsaved'),
    };
    res.redirect(req.get('Referrer') || '/whale');
  } catch (err) {
    next(err);
  }
});

// Sell form
router.get('/sell', requireAuth, requireVerified, requirePro, async (req, res, next) => {
  try {
    const categories = await whaleService.getCategories();
    res.render('whale/sell', { title: res.locals.t('sell.title'), categories, cities: CITIES });
  } catch (err) {
    next(err);
  }
});

// Create listing
router.post(
  '/sell',
  requireAuth,
  requireVerified,
  requirePro,
  upload.array('images', 6),
  async (req, res, next) => {
    try {
      const images = await processImages(req.files);
      const data = sanitizeBody(req.body, {
        title: 100,
        titleAr: 100,
        description: 5000,
        descriptionAr: 5000,
        price: 20,
        condition: 20,
        categoryId: 50,
        subcategoryId: 50,
        city: 100,
        tags: 500,
      });
      data.images = images;
      data.negotiable = req.body.negotiable;

      const listing = await whaleService.createListing(req.user.id, data);
      req.session.flash = { type: 'success', message: res.locals.t('flash.listing_created') };
      res.redirect('/whale/listing/' + listing.slug);
    } catch (err) {
      req.session.flash = { type: 'danger', message: err.message };
      res.redirect('/whale/sell');
    }
  }
);

// Edit form
router.get('/listing/:id/edit', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const categories = await whaleService.getCategories();
    res.render('whale/edit', {
      title: res.locals.t('sell.edit_title'),
      listing: req.listing,
      categories,
      cities: CITIES,
    });
  } catch (err) {
    next(err);
  }
});

// Update listing
router.post(
  '/listing/:id/edit',
  requireAuth,
  requireOwner,
  upload.array('images', 6),
  async (req, res, next) => {
    try {
      const data = sanitizeBody(req.body, {
        title: 100,
        titleAr: 100,
        description: 5000,
        descriptionAr: 5000,
        price: 20,
        condition: 20,
        categoryId: 50,
        subcategoryId: 50,
        city: 100,
        tags: 500,
      });
      data.negotiable = req.body.negotiable;

      if (req.files && req.files.length > 0) {
        data.images = await processImages(req.files);
      }

      const listing = await whaleService.updateListing(req.params.id, req.user.id, data);
      req.session.flash = { type: 'success', message: res.locals.t('flash.listing_updated') };
      res.redirect('/whale/listing/' + listing.slug);
    } catch (err) {
      req.session.flash = { type: 'danger', message: err.message };
      res.redirect('/whale/listing/' + req.params.id + '/edit');
    }
  }
);

// Delete listing
router.post('/listing/:id/delete', requireAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    await whaleService.deleteListing(req.params.id, req.user.id, isAdmin);
    req.session.flash = { type: 'success', message: res.locals.t('flash.listing_deleted') };
    res.redirect('/whale');
  } catch (err) {
    next(err);
  }
});

// Checkout
router.get('/checkout/:id', requireAuth, requireVerified, async (req, res, next) => {
  try {
    const listing = await whaleService.getListing(req.params.id);
    if (!listing) return res.status(404).render('404', { title: '404' });
    res.render('whale/checkout', {
      title: res.locals.t('checkout.title'),
      listing,
      cities: CITIES,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/checkout/:id', requireAuth, requireVerified, async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body, {
      paymentMethod: 20,
      street: 200,
      city: 100,
      phone: 20,
      buyerNote: 500,
    });
    const order = await whaleService.createOrder({
      listingId: req.params.id,
      buyerId: req.user.id,
      paymentMethod: data.paymentMethod,
      shippingAddress: { street: data.street, city: data.city, phone: data.phone },
      buyerNote: data.buyerNote,
    });
    req.session.flash = { type: 'success', message: res.locals.t('flash.order_placed') };
    res.redirect('/whale/orders/' + order.id);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/whale/listing/' + req.params.id);
  }
});

// Orders list
router.get('/orders', requireAuth, async (req, res, next) => {
  try {
    const tab = req.query.tab || 'buying';
    const orders = await whaleService.getUserOrders(req.user.id, tab);
    res.render('whale/orders', { title: res.locals.t('order.title'), orders, tab });
  } catch (err) {
    next(err);
  }
});

// Order detail
router.get('/orders/:id', requireAuth, requireOrderParty, async (req, res, next) => {
  try {
    const order = await whaleService.getOrder(req.params.id);
    if (!order) return res.status(404).render('404', { title: '404' });
    res.render('whale/order', { title: res.locals.t('order.number') + order.orderNumber, order });
  } catch (err) {
    next(err);
  }
});

// Order actions
router.post('/orders/:id/confirm', requireAuth, requireSeller, async (req, res, next) => {
  try {
    await whaleService.transitionOrder(req.params.id, req.user.id, 'confirm');
    req.session.flash = { type: 'success', message: res.locals.t('flash.order_confirmed') };
    res.redirect('/whale/orders/' + req.params.id);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/whale/orders/' + req.params.id);
  }
});

router.post('/orders/:id/ship', requireAuth, requireSeller, async (req, res, next) => {
  try {
    await whaleService.transitionOrder(req.params.id, req.user.id, 'ship', {
      trackingNumber: req.body.trackingNumber,
      shippingCompany: req.body.shippingCompany,
    });
    req.session.flash = { type: 'success', message: res.locals.t('flash.order_shipped') };
    res.redirect('/whale/orders/' + req.params.id);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/whale/orders/' + req.params.id);
  }
});

router.post('/orders/:id/deliver', requireAuth, requireBuyer, async (req, res, next) => {
  try {
    await whaleService.transitionOrder(req.params.id, req.user.id, 'deliver');
    req.session.flash = { type: 'success', message: res.locals.t('flash.order_completed') };
    res.redirect('/whale/orders/' + req.params.id);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/whale/orders/' + req.params.id);
  }
});

router.post('/orders/:id/cancel', requireAuth, requireOrderParty, async (req, res, next) => {
  try {
    await whaleService.transitionOrder(req.params.id, req.user.id, 'cancel', {
      reason: req.body.reason,
    });
    req.session.flash = { type: 'success', message: res.locals.t('flash.order_cancelled') };
    res.redirect('/whale/orders/' + req.params.id);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/whale/orders/' + req.params.id);
  }
});

router.post('/orders/:id/dispute', requireAuth, requireBuyer, async (req, res, next) => {
  try {
    await whaleService.transitionOrder(req.params.id, req.user.id, 'dispute');
    req.session.flash = { type: 'warning', message: 'Dispute opened' };
    res.redirect('/whale/orders/' + req.params.id);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/whale/orders/' + req.params.id);
  }
});

router.post('/orders/:id/review', requireAuth, requireBuyer, async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body, { rating: 1, body: 1000 });
    data.rating = parseInt(req.body.rating);
    await whaleService.postReview(req.params.id, req.user.id, data);
    req.session.flash = { type: 'success', message: res.locals.t('flash.review_posted') };
    res.redirect('/whale/orders/' + req.params.id);
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/whale/orders/' + req.params.id);
  }
});

// Dashboard
// My listings (seller's own inventory)
router.get('/my-listings', requireAuth, async (req, res, next) => {
  try {
    const prisma = require('../lib/prisma');
    const listings = await prisma.listing.findMany({
      where: { sellerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });
    res.render('whale/my-listings', { title: res.locals.t('my_listings.title'), listings });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const stats = await whaleService.getSellerDashboard(req.user.id);
    res.render('whale/dashboard', { title: res.locals.t('dashboard.title'), stats });
  } catch (err) {
    next(err);
  }
});

// Saved listings
router.get('/saved', requireAuth, async (req, res, next) => {
  try {
    const listings = await whaleService.getSavedListings(req.user.id);
    res.render('whale/saved', { title: res.locals.t('nav.saved'), listings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
