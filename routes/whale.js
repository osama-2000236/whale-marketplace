const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requirePro } = require('../middleware/subscription');
const svc = require('../services/whaleService');
const cartService = require('../services/cartService');
const prisma = require('../lib/prisma');
const { upload, storeFiles } = require('../utils/upload');
const { sanitizeText, sanitizeInt, sanitizeTags } = require('../utils/sanitize');
const { getCitiesByRegion, getCityName } = require('../lib/cities');

function parseJsonField(input) {
  if (!input) return null;
  if (typeof input === 'object') return input;
  try { return JSON.parse(input); } catch { return null; }
}

function groupCitiesByRegion(cityOptions) {
  const grouped = {};
  for (const c of cityOptions) {
    if (!grouped[c.region]) grouped[c.region] = [];
    grouped[c.region].push(c);
  }
  return grouped;
}

async function resolveListingId(idOrSlug) {
  const listing = await svc.getListingByIdOrSlug(idOrSlug);
  return listing;
}

// ─── BROWSE ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { category, subcategory, city, condition, minPrice, maxPrice, q, sort, cursor } = req.query;
    const filters = { category, subcategory, city, condition, minPrice, maxPrice, q, sort, cursor };

    const [result, facets, categories, shippingCos] = await Promise.all([
      svc.getListings(filters),
      svc.getListingFacets(filters),
      prisma.marketCategory.findMany({ orderBy: { order: 'asc' }, include: { subcategories: true, _count: { select: { listings: { where: { status: 'ACTIVE' } } } } } }),
      prisma.shippingCompany.findMany({ where: { isActive: true }, orderBy: { basePrice: 'asc' } }),
    ]);

    // City stats
    const cityStats = await prisma.marketListing.groupBy({
      by: ['city'], where: { status: 'ACTIVE' }, _count: true, orderBy: { _count: { city: 'desc' } }, take: 10,
    });

    // User-specific data
    let heroStats = null;
    let personalCity = null;
    let nearYouListings = [];
    let sellerProfile = null;
    if (req.user?.id) {
      const [listingCount, orderCount, savedCount, profile] = await Promise.all([
        prisma.marketListing.count({ where: { sellerId: req.user.id, status: 'ACTIVE' } }),
        prisma.order.count({ where: { buyerId: req.user.id } }),
        prisma.savedListing.count({ where: { userId: req.user.id } }),
        prisma.sellerProfile.findUnique({ where: { userId: req.user.id } }),
      ]);
      heroStats = { listingCount, orderCount, savedCount };
      sellerProfile = profile;
      personalCity = profile?.city;
      if (personalCity) {
        const nearby = await svc.getListings({ city: personalCity, sort: 'newest', take: 6 });
        nearYouListings = nearby.listings;
      }
    }

    const groupedCities = groupCitiesByRegion(res.locals.cities);

    res.render('whale/index', {
      title: res.locals.t('whale.title'),
      listings: result.listings,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      totalCount: result.totalCount,
      categories,
      filters,
      facets,
      priceBounds: facets.priceBounds,
      categoryCounts: facets.categoryCountMap,
      shippingCos,
      cityStats,
      groupedCities,
      heroStats,
      personalCity,
      nearYouListings,
      sellerProfile,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/search/suggestions', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ suggestions: [] });

    const [listings, cats] = await Promise.all([
      prisma.marketListing.findMany({
        where: { status: 'ACTIVE', OR: [{ title: { contains: q, mode: 'insensitive' } }, { titleAr: { contains: q, mode: 'insensitive' } }, { tags: { has: q.toLowerCase() } }] },
        take: 5, select: { id: true, title: true, titleAr: true, price: true, images: true, slug: true },
      }),
      prisma.marketCategory.findMany({
        where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { nameAr: { contains: q, mode: 'insensitive' } }] },
        take: 3,
      }),
    ]);

    const suggestions = [
      ...listings.map((l) => ({ type: 'listing', title: res.locals.lang === 'ar' && l.titleAr ? l.titleAr : l.title, price: l.price, image: l.images?.[0], url: `/whale/listing/${l.slug || l.id}` })),
      ...cats.map((c) => ({ type: 'category', title: res.locals.lang === 'ar' ? c.nameAr : c.name, icon: c.icon, url: `/whale?category=${c.slug}` })),
    ];

    res.json({ suggestions });
  } catch {
    res.json({ suggestions: [] });
  }
});

// ─── LISTING DETAIL ─────────────────────────────────────────────────────────

router.get('/listing/:idOrSlug', async (req, res, next) => {
  try {
    const listing = await resolveListingId(req.params.idOrSlug);
    if (!listing) return res.status(404).render('404', { title: 'Not Found' });
    if (['REMOVED', 'SUSPENDED', 'DRAFT'].includes(listing.status)) return res.status(404).render('404', { title: 'Not Found' });

    // Redirect to canonical slug URL
    if (listing.slug && req.params.idOrSlug !== listing.slug) {
      return res.redirect(301, `/whale/listing/${listing.slug}`);
    }

    svc.incrementViews(listing.id);

    const [similar, shippingCos] = await Promise.all([
      prisma.marketListing.findMany({
        where: { status: 'ACTIVE', categoryId: listing.categoryId, id: { not: listing.id } },
        take: 4, orderBy: { createdAt: 'desc' },
        include: { seller: { select: { id: true, username: true, avatar: true, isVerified: true, sellerProfile: true } }, category: true },
      }),
      prisma.shippingCompany.findMany({ where: { isActive: true }, orderBy: { basePrice: 'asc' } }),
    ]);

    let isSaved = false;
    if (req.user?.id) {
      const saved = await prisma.savedListing.findUnique({
        where: { userId_listingId: { userId: req.user.id, listingId: listing.id } },
      });
      isSaved = Boolean(saved);
    }

    // JSON-LD for SEO
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: listing.title,
      description: listing.description?.slice(0, 200),
      image: listing.images?.[0],
      offers: {
        '@type': 'Offer',
        price: listing.price,
        priceCurrency: 'ILS',
        availability: listing.status === 'ACTIVE' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      },
    };

    res.render('whale/listing', {
      title: listing.title,
      listing, similar, isSaved, shippingCos, jsonLd,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/listing/:id/wa-click', async (req, res) => {
  svc.incrementWaClicks(req.params.id);
  res.json({ ok: true });
});

router.post('/listing/:id/save', requireAuth, async (req, res) => {
  try {
    const result = await svc.toggleSaved(req.user.id, req.params.id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── SELL ───────────────────────────────────────────────────────────────────

router.get('/sell', requireAuth, requirePro, async (req, res) => {
  const categories = await prisma.marketCategory.findMany({ orderBy: { order: 'asc' }, include: { subcategories: true } });
  res.render('whale/sell', { title: res.locals.t('whale.sell'), categories });
});

router.post('/sell', requireAuth, requirePro, upload.array('images', 6), async (req, res, next) => {
  try {
    const images = await storeFiles(req.files);
    const listing = await svc.createListing(req.user.id, {
      title: sanitizeText(req.body.title, 200),
      titleAr: sanitizeText(req.body.titleAr, 200) || null,
      description: sanitizeText(req.body.description, 5000),
      descriptionAr: sanitizeText(req.body.descriptionAr, 5000) || null,
      categoryId: req.body.categoryId || null,
      subcategoryId: req.body.subcategoryId || null,
      city: req.body.city,
      price: req.body.price,
      quantity: sanitizeInt(req.body.quantity, { min: 1, max: 999, defaultVal: 1 }),
      condition: req.body.condition || 'GOOD',
      tags: sanitizeTags(req.body.tags),
      specs: parseJsonField(req.body.specs),
      negotiable: req.body.negotiable === 'on' || req.body.negotiable === 'true',
      images,
    });
    res.redirect(`/whale/listing/${listing.slug || listing.id}?created=1`);
  } catch (e) {
    next(e);
  }
});

// ─── EDIT ───────────────────────────────────────────────────────────────────

router.get('/listing/:id/edit', requireAuth, async (req, res, next) => {
  try {
    const listing = await svc.getListingByIdOrSlug(req.params.id);
    if (!listing) return res.status(404).render('404', { title: 'Not Found' });
    if (listing.sellerId !== req.user.id) return res.status(403).render('error', { title: 'Forbidden', message: 'Not your listing' });
    const categories = await prisma.marketCategory.findMany({ orderBy: { order: 'asc' }, include: { subcategories: true } });
    res.render('whale/edit', { title: 'Edit Listing', listing, categories });
  } catch (e) { next(e); }
});

router.post('/listing/:id/edit', requireAuth, upload.array('images', 6), async (req, res, next) => {
  try {
    const images = req.files?.length ? await storeFiles(req.files) : undefined;
    await svc.updateListing(req.params.id, req.user.id, {
      title: sanitizeText(req.body.title, 200),
      titleAr: sanitizeText(req.body.titleAr, 200) || undefined,
      description: sanitizeText(req.body.description, 5000),
      descriptionAr: sanitizeText(req.body.descriptionAr, 5000) || undefined,
      categoryId: req.body.categoryId || undefined,
      subcategoryId: req.body.subcategoryId || undefined,
      city: req.body.city || undefined,
      price: req.body.price || undefined,
      quantity: req.body.quantity ? sanitizeInt(req.body.quantity, { min: 1, max: 999 }) : undefined,
      condition: req.body.condition || undefined,
      tags: req.body.tags ? sanitizeTags(req.body.tags) : undefined,
      specs: req.body.specs ? parseJsonField(req.body.specs) : undefined,
      negotiable: req.body.negotiable !== undefined ? (req.body.negotiable === 'on' || req.body.negotiable === 'true') : undefined,
      images,
    });
    res.redirect(`/whale/listing/${req.params.id}`);
  } catch (e) { next(e); }
});

router.post('/listing/:id/mark-sold', requireAuth, async (req, res, next) => {
  try {
    await svc.markSold(req.params.id, req.user.id);
    res.redirect('/whale/my-listings');
  } catch (e) { next(e); }
});

router.post('/listing/:id/delete', requireAuth, async (req, res, next) => {
  try {
    await svc.deleteListing(req.params.id, req.user.id);
    res.redirect('/whale/my-listings');
  } catch (e) { next(e); }
});

// ─── BUY / CHECKOUT ─────────────────────────────────────────────────────────

router.get('/listing/:id/buy', requireAuth, async (req, res, next) => {
  try {
    const listing = await svc.getListing(req.params.id);
    if (!listing || listing.status !== 'ACTIVE') return res.status(404).render('404', { title: 'Not Found' });
    if (listing.sellerId === req.user.id) return res.redirect(`/whale/listing/${listing.slug || listing.id}`);
    const shippingCos = await prisma.shippingCompany.findMany({ where: { isActive: true } });
    res.render('whale/checkout', { title: res.locals.t('whale.checkout'), listing, shippingCos });
  } catch (e) { next(e); }
});

router.post('/listing/:id/buy', requireAuth, async (req, res, next) => {
  try {
    const { buyerName, buyerPhone, buyerCity, buyerAddress, quantity, paymentMethod, shippingMethod, shippingCompany, buyerNote } = req.body;

    const shippingAddress = (shippingMethod === 'company') ? {
      name: sanitizeText(buyerName, 100),
      phone: buyerPhone,
      city: buyerCity,
      address: sanitizeText(buyerAddress, 500),
    } : null;

    const order = await svc.createOrder({
      listingId: req.params.id,
      buyerId: req.user.id,
      quantity: sanitizeInt(quantity, { min: 1, max: 999, defaultVal: 1 }),
      paymentMethod,
      shippingMethod: shippingMethod || 'hand_to_hand',
      shippingAddress,
      shippingCompany: shippingCompany || null,
      buyerNote: sanitizeText(buyerNote, 500) || null,
    });

    if (paymentMethod === 'card') {
      return res.redirect(`/payment/start?orderId=${order.id}`);
    }
    res.redirect(`/whale/orders/${order.id}?placed=1`);
  } catch (e) { next(e); }
});

// ─── CART ───────────────────────────────────────────────────────────────────

router.get('/cart', async (req, res, next) => {
  try {
    const cart = await cartService.getCartWithDetails(req);
    const shippingCos = await prisma.shippingCompany.findMany({ where: { isActive: true } });
    res.render('whale/cart', { title: res.locals.t('whale.cart'), cart, shippingCos });
  } catch (e) { next(e); }
});

router.post('/cart/add', async (req, res) => {
  try {
    const count = await cartService.addToCart(req, req.body.listingId, sanitizeInt(req.body.quantity, { min: 1, defaultVal: 1 }));
    res.json({ ok: true, cartCount: count });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/cart/remove', async (req, res) => {
  cartService.removeFromCart(req, req.body.listingId);
  res.redirect('/whale/cart');
});

router.post('/cart/checkout', requireAuth, async (req, res, next) => {
  try {
    const cart = await cartService.getCartWithDetails(req);
    if (!cart.items.length) return res.redirect('/whale/cart');

    const { paymentMethod, shippingMethod, buyerName, buyerPhone, buyerCity, buyerAddress, shippingCompany, buyerNote } = req.body;

    if (paymentMethod === 'card' && cart.items.length > 1) {
      return res.redirect('/whale/cart?error=card_single_only');
    }

    const shippingAddress = (shippingMethod === 'company') ? {
      name: sanitizeText(buyerName, 100), phone: buyerPhone,
      city: buyerCity, address: sanitizeText(buyerAddress, 500),
    } : null;

    let firstOrder = null;
    for (const item of cart.items) {
      const order = await svc.createOrder({
        listingId: item.listingId,
        buyerId: req.user.id,
        quantity: item.quantity,
        paymentMethod,
        shippingMethod: shippingMethod || 'hand_to_hand',
        shippingAddress,
        shippingCompany: shippingCompany || null,
        buyerNote: sanitizeText(buyerNote, 500) || null,
      });
      if (!firstOrder) firstOrder = order;
    }

    cartService.clearCart(req);

    if (paymentMethod === 'card' && firstOrder) {
      return res.redirect(`/payment/start?orderId=${firstOrder.id}`);
    }
    res.redirect('/whale/orders?placed=1');
  } catch (e) { next(e); }
});

// ─── ORDERS ─────────────────────────────────────────────────────────────────

router.get('/orders', requireAuth, async (req, res, next) => {
  try {
    const tab = req.query.tab === 'selling' ? 'selling' : 'buying';
    const where = tab === 'selling' ? { sellerId: req.user.id } : { buyerId: req.user.id };

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true, titleAr: true, images: true, slug: true } },
        buyer: { select: { id: true, username: true, avatar: true } },
        seller: { select: { id: true, username: true, avatar: true } },
      },
    });

    res.render('whale/orders', { title: res.locals.t('whale.orders'), orders, tab });
  } catch (e) { next(e); }
});

router.get('/orders/:id', requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        listing: { include: { seller: { select: { id: true, username: true, avatar: true, sellerProfile: true } }, category: true } },
        buyer: { select: { id: true, username: true, avatar: true, email: true } },
        seller: { select: { id: true, username: true, avatar: true, email: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
        review: true,
      },
    });

    if (!order) return res.status(404).render('404', { title: 'Not Found' });
    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
      return res.status(403).render('error', { title: 'Forbidden', message: 'Not authorized' });
    }

    let shippingCo = null;
    if (order.shippingCompany) {
      shippingCo = await prisma.shippingCompany.findFirst({ where: { name: order.shippingCompany } });
    }

    res.render('whale/order-detail', { title: `Order #${order.orderNumber}`, order, shippingCo });
  } catch (e) { next(e); }
});

router.post('/orders/:id/confirm', requireAuth, async (req, res, next) => {
  try { await svc.sellerConfirmOrder(req.params.id, req.user.id); res.redirect(`/whale/orders/${req.params.id}`); } catch (e) { next(e); }
});

router.post('/orders/:id/ship', requireAuth, async (req, res, next) => {
  try {
    await svc.sellerShipOrder(req.params.id, req.user.id, {
      trackingNumber: req.body.trackingNumber,
      shippingCompany: req.body.shippingCompany,
      estimatedDelivery: req.body.estimatedDelivery,
    });
    res.redirect(`/whale/orders/${req.params.id}`);
  } catch (e) { next(e); }
});

router.post('/orders/:id/confirm-delivery', requireAuth, async (req, res, next) => {
  try { await svc.buyerConfirmDelivery(req.params.id, req.user.id); res.redirect(`/whale/orders/${req.params.id}`); } catch (e) { next(e); }
});

router.post('/orders/:id/cancel', requireAuth, async (req, res, next) => {
  try { await svc.cancelOrder(req.params.id, req.user.id, req.body.reason); res.redirect(`/whale/orders/${req.params.id}`); } catch (e) { next(e); }
});

router.post('/orders/:id/review', requireAuth, async (req, res, next) => {
  try {
    await svc.createReview(req.params.id, req.user.id, {
      rating: sanitizeInt(req.body.rating, { min: 1, max: 5, defaultVal: 5 }),
      title: sanitizeText(req.body.title, 200),
      body: sanitizeText(req.body.body, 2000),
    });
    res.redirect(`/whale/orders/${req.params.id}`);
  } catch (e) { next(e); }
});

// ─── SELLER PAGES ───────────────────────────────────────────────────────────

router.get('/my-listings', requireAuth, async (req, res, next) => {
  try {
    const listings = await prisma.marketListing.findMany({
      where: { sellerId: req.user.id, status: { not: 'REMOVED' } },
      orderBy: { createdAt: 'desc' },
      include: { category: true, _count: { select: { orders: true } } },
    });
    res.render('whale/my-listings', { title: res.locals.t('whale.my_listings'), listings });
  } catch (e) { next(e); }
});

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const data = await svc.getSellerDashboard(req.user.id);
    const totalListings = await prisma.marketListing.count({ where: { sellerId: req.user.id } });
    const totalOrders = await prisma.order.count({ where: { sellerId: req.user.id } });
    const totalRevenue = (await prisma.order.aggregate({ where: { sellerId: req.user.id, orderStatus: 'DELIVERED' }, _sum: { amount: true } }))._sum.amount || 0;
    const totalViews = (await prisma.marketListing.aggregate({ where: { sellerId: req.user.id }, _sum: { views: true } }))._sum.views || 0;
    const avgRating = (await prisma.sellerReview.aggregate({ where: { sellerId: req.user.id }, _avg: { rating: true } }))._avg.rating;
    const stats = { totalListings, activeListings: data.activeListings, totalOrders, totalRevenue, totalViews, averageRating: avgRating };
    res.render('whale/dashboard', { title: res.locals.t('whale.dashboard'), stats, ...data });
  } catch (e) { next(e); }
});

router.get('/saved', requireAuth, async (req, res, next) => {
  try {
    const listings = await svc.getSavedListings(req.user.id);
    res.render('whale/saved', { title: res.locals.t('whale.saved'), listings });
  } catch (e) { next(e); }
});

router.get('/seller/:username', async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { username: { equals: req.params.username, mode: 'insensitive' } },
      select: { id: true, username: true, avatar: true, isVerified: true, createdAt: true, sellerProfile: true },
    });
    if (!user) return res.status(404).render('404', { title: 'Not Found' });

    const [listings, reviews] = await Promise.all([
      prisma.marketListing.findMany({
        where: { sellerId: user.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      prisma.sellerReview.findMany({
        where: { sellerId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { reviewer: { select: { id: true, username: true, avatar: true } } },
      }),
    ]);

    res.render('whale/seller-profile', { title: user.username, seller: user, listings, reviews });
  } catch (e) { next(e); }
});

module.exports = router;
