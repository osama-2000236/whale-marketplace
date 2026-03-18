const express = require('express');

const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requirePro } = require('../middleware/subscription');
const svc = require('../services/whaleService');
const cartService = require('../services/cartService');
const prisma = require('../lib/prisma');
const { upload, storeFiles } = require('../utils/upload');
const { sanitizeText, sanitizeInt, sanitizeTags } = require('../utils/sanitize');
const { MemoryCache } = require('../utils/cache');

const router = express.Router();

// Cache categories and shipping companies — they rarely change (5 min TTL)
const staticDataCache = new MemoryCache({ ttlMs: 5 * 60_000, maxSize: 20 });
const WHALE_CATEGORY_SLUGS = [
  'electronics',
  'phones',
  'pc-gaming',
  'clothes',
  'home-garden',
  'vehicles',
  'sports',
  'books',
  'furniture',
  'kids-toys',
  'tools',
  'other'
];

function parseJsonField(input) {
  if (!input) return null;
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(input);
  } catch (_error) {
    return null;
  }
}

function groupCitiesByRegion(cityOptions = []) {
  return cityOptions.reduce((acc, city) => {
    const region = city.region || 'Other';
    if (!acc[region]) acc[region] = [];
    acc[region].push(city);
    return acc;
  }, {});
}

async function resolveListingId(idOrSlug) {
  const found = await prisma.marketListing.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }]
    },
    select: { id: true }
  });
  return found?.id || null;
}

// ─── BROWSE (public) ──────────────────────────────────────────────────────

router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      category,
      subcategory,
      city,
      condition,
      minPrice,
      maxPrice,
      q,
      sort,
      cursor
    } = req.query;

    const cityOptions = res.locals.cities || [];
    const groupedCities = groupCitiesByRegion(cityOptions);
    const [
      result,
      facets,
      categories,
      cityStats,
      shippingCos,
      sellerProfile,
      listingCount,
      orderCount,
      savedCount
    ] = await Promise.all([
      svc.getListings({
        category,
        subcategory,
        city,
        condition,
        minPrice,
        maxPrice,
        q,
        sort,
        cursor
      }),
      svc.getListingFacets({
        category,
        subcategory,
        city,
        condition,
        q
      }),
      staticDataCache.getOrSet('categories', () =>
        prisma.marketCategory.findMany({
          where: { slug: { in: WHALE_CATEGORY_SLUGS } },
          orderBy: { order: 'asc' },
          include: { subcategories: true }
        })
      ),
      staticDataCache.getOrSet('cityStats', () =>
        prisma.marketListing.groupBy({
          by: ['city'],
          where: { status: 'ACTIVE' },
          _count: { city: true },
          orderBy: { _count: { city: 'desc' } }
        })
      ),
      staticDataCache.getOrSet('shippingCos', () =>
        prisma.shippingCompany.findMany({
          where: { isActive: true },
          orderBy: { basePrice: 'asc' }
        })
      ),
      req.user ? prisma.sellerProfile.findUnique({ where: { userId: req.user.id } }).catch(() => null) : null,
      req.user ? prisma.marketListing.count({ where: { sellerId: req.user.id, status: { not: 'REMOVED' } } }).catch(() => 0) : 0,
      req.user ? prisma.order.count({ where: { OR: [{ buyerId: req.user.id }, { sellerId: req.user.id }] } }).catch(() => 0) : 0,
      req.user ? prisma.savedListing.count({ where: { userId: req.user.id } }).catch(() => 0) : 0
    ]);

    const categoryCounts = categories.reduce((acc, categoryRow) => {
      acc[categoryRow.slug] = facets.categoryCountMap[categoryRow.slug] || 0;
      return acc;
    }, {});

    const personalCity = sellerProfile?.city || city || cityStats?.[0]?.city || null;
    const nearYouListings = personalCity
      ? (await svc.getListings({ city: personalCity, take: 8 }).catch(() => ({ listings: [] }))).listings
          .slice(0, 8)
      : [];

    return res.render('whale/index', {
      title: `${res.locals.t('nav.marketplace')} | Whale`,
      ...result,
      categories,
      cityStats,
      cities: cityOptions,
      groupedCities,
      categoryCounts,
      priceBounds: facets.priceBounds,
      shippingCos,
      heroStats: {
        listings: listingCount || 0,
        orders: orderCount || 0,
        saved: savedCount || 0
      },
      personalCity,
      nearYouListings,
      filters: { category, subcategory, city, condition, minPrice, maxPrice, q, sort },
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).render('error', {
      title: res.locals.t('error.server'),
      message: res.locals.t('error.market_load')
    });
  }
});

// ─── SEARCH AUTOCOMPLETE ──────────────────────────────────────────────────

router.get('/search/suggestions', optionalAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ suggestions: [] });

    const [listings, categories] = await Promise.all([
      prisma.marketListing.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { titleAr: { contains: q, mode: 'insensitive' } },
            { tags: { has: q.toLowerCase() } }
          ]
        },
        select: {
          id: true,
          slug: true,
          title: true,
          titleAr: true,
          price: true,
          images: true
        },
        take: 6,
        orderBy: { views: 'desc' }
      }),
      prisma.marketCategory.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { nameAr: { contains: q, mode: 'insensitive' } }
          ]
        },
        select: { slug: true, name: true, nameAr: true, icon: true },
        take: 3
      })
    ]);

    const lang = req.session.lang || 'ar';
    return res.json({
      suggestions: [
        ...categories.map((c) => ({
          type: 'category',
          icon: c.icon,
          label: lang === 'ar' ? c.nameAr : c.name,
          url: `/whale?category=${encodeURIComponent(c.slug)}`
        })),
        ...listings.map((l) => ({
          type: 'listing',
          label: lang === 'ar' ? (l.titleAr || l.title) : l.title,
          price: `${l.price} ₪`,
          image: l.images?.[0] || null,
          url: `/whale/listing/${l.slug || l.id}`
        }))
      ]
    });
  } catch (_error) {
    return res.json({ suggestions: [] });
  }
});

router.get('/listing/:idOrSlug', optionalAuth, async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const listing = await svc.getListingByIdOrSlug(idOrSlug);
    if (!listing || ['REMOVED', 'SUSPENDED', 'DRAFT'].includes(listing.status)) {
      return res.status(404).render('404', { title: 'Listing not found' });
    }

    if (
      listing.slug &&
      idOrSlug !== listing.slug &&
      process.env.NODE_ENV !== 'test'
    ) {
      return res.redirect(301, `/whale/listing/${listing.slug}`);
    }

    await svc.incrementViews(listing.id);

    const [similarResult, shippingCos] = await Promise.all([
      svc.getListings({ category: listing.category?.slug, take: 6 }),
      prisma.shippingCompany.findMany({
        where: {
          isActive: true,
          OR: [
            { cities: { has: listing.city } },
            { cities: { isEmpty: true } }
          ]
        }
      })
    ]);

    let isSaved = false;
    if (req.user) {
      const saved = await prisma.savedListing.findUnique({
        where: {
          userId_listingId: { userId: req.user.id, listingId: listing.id }
        }
      });
      isSaved = Boolean(saved);
    }

    return res.render('whale/listing', {
      title: `${listing.title} | Whale`,
      listing,
      similar: similarResult.listings.filter((item) => item.id !== listing.id).slice(0, 6),
      isSaved,
      shippingCos,
      jsonLd: {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: listing.title,
        description: String((listing.description || '').slice(0, 200)),
        image: listing.images || [],
        offers: {
          '@type': 'Offer',
          priceCurrency: 'ILS',
          price: String(listing.price),
          availability: listing.status === 'ACTIVE' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Person',
            name: listing.seller?.username || 'Seller'
          }
        }
      },
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).render('error', {
      title: res.locals.t('error.server'),
      message: res.locals.t('error.listing_load')
    });
  }
});

router.post('/listing/:id/wa-click', optionalAuth, async (req, res) => {
  try {
    const listingId = await resolveListingId(req.params.id);
    if (!listingId) return res.status(404).json({ ok: false, error: 'not_found' });
    await svc.incrementWaClicks(listingId);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

router.post('/listing/:id/save', requireAuth, async (req, res) => {
  try {
    const listingId = await resolveListingId(req.params.id);
    if (!listingId) return res.status(400).json({ error: 'not_found' });
    const result = await svc.toggleSaved(req.session.userId, listingId);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// ─── CREATE LISTING (Pro required) ────────────────────────────────────────

router.get('/sell', requireAuth, requirePro, async (req, res) => {
  try {
    const categories = await prisma.marketCategory.findMany({
      where: { slug: { in: WHALE_CATEGORY_SLUGS } },
      orderBy: { order: 'asc' },
      include: { subcategories: true }
    });
    const cities = res.locals.cities || [];

    return res.render('whale/sell', {
      title: `${res.locals.t('home.cta_sell')} | Whale`,
      categories,
      cities,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

router.post('/sell', requireAuth, requirePro, upload.array('images', 6), async (req, res) => {
  try {
    const images = await storeFiles(req.files || [], 'uploads/whale', 6);
    const listing = await svc.createListing(req.session.userId, {
      title: sanitizeText(req.body.title, 200),
      titleAr: sanitizeText(req.body.titleAr, 200),
      description: sanitizeText(req.body.description, 5000),
      descriptionAr: sanitizeText(req.body.descriptionAr, 5000),
      categoryId: req.body.categoryId || null,
      subcategoryId: req.body.subcategoryId || null,
      city: sanitizeText(req.body.city, 100),
      price: sanitizeInt(req.body.price, { min: 1, max: 10000000 }),
      quantity: sanitizeInt(req.body.quantity, { min: 1, max: 9999, defaultVal: 1 }),
      condition: req.body.condition,
      tags: typeof req.body.tags === 'string' ? sanitizeTags(req.body.tags) : [],
      negotiable: req.body.negotiable === 'true',
      specs: parseJsonField(req.body.specs),
      images
    });
    return res.redirect(`/whale/listing/${listing.slug || listing.id}?created=1`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.redirect('/whale/sell?error=1');
  }
});

// ─── EDIT LISTING ─────────────────────────────────────────────────────────

router.get('/listing/:id/edit', requireAuth, async (req, res) => {
  try {
    const listingId = await resolveListingId(req.params.id);
    const listing = listingId ? await prisma.marketListing.findUnique({ where: { id: listingId } }) : null;
    if (!listing || listing.sellerId !== req.session.userId) {
      return res.status(403).render('error', {
        title: res.locals.t('ui.error'),
        message: res.locals.t('error.forbidden_edit_listing')
      });
    }

    const categories = await prisma.marketCategory.findMany({
      where: { slug: { in: WHALE_CATEGORY_SLUGS } },
      orderBy: { order: 'asc' },
      include: { subcategories: true }
    });

    return res.render('whale/edit', {
      title: `${res.locals.t('listing.edit')} | Whale`,
      listing,
      categories,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

router.post('/listing/:id/edit', requireAuth, upload.array('images', 6), async (req, res) => {
  try {
    const listingId = await resolveListingId(req.params.id);
    if (!listingId) return res.status(404).render('404', { title: 'Listing not found' });
    const images = await storeFiles(req.files || [], 'uploads/whale', 6);
    const updated = await svc.updateListing(listingId, req.session.userId, {
      title: sanitizeText(req.body.title, 200),
      titleAr: sanitizeText(req.body.titleAr, 200),
      description: sanitizeText(req.body.description, 5000),
      descriptionAr: sanitizeText(req.body.descriptionAr, 5000),
      categoryId: req.body.categoryId || null,
      subcategoryId: req.body.subcategoryId || null,
      city: sanitizeText(req.body.city, 100),
      price: sanitizeInt(req.body.price, { min: 1, max: 10000000 }),
      quantity: sanitizeInt(req.body.quantity, { min: 1, max: 9999, defaultVal: 1 }),
      condition: req.body.condition,
      tags: typeof req.body.tags === 'string' ? sanitizeTags(req.body.tags) : [],
      negotiable: req.body.negotiable === 'true',
      specs: parseJsonField(req.body.specs),
      ...(images.length ? { images } : {})
    });
    return res.redirect(`/whale/listing/${updated.slug || updated.id}?updated=1`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.redirect(`/whale/listing/${req.params.id}/edit?error=1`);
  }
});

router.post('/listing/:id/mark-sold', requireAuth, async (req, res) => {
  try {
    const listingId = await resolveListingId(req.params.id);
    if (!listingId) return res.status(404).render('404', { title: 'Listing not found' });
    await svc.markSold(listingId, req.session.userId);
    return res.redirect('/whale/my-listings');
  } catch (error) {
    return res.status(400).render('error', {
      title: 'Error',
      message: error.message
    });
  }
});

router.post('/listing/:id/delete', requireAuth, async (req, res) => {
  try {
    const listingId = await resolveListingId(req.params.id);
    if (!listingId) return res.status(404).render('404', { title: 'Listing not found' });
    await svc.deleteListing(listingId, req.session.userId);
    return res.redirect('/whale/my-listings');
  } catch (error) {
    return res.status(400).render('error', {
      title: 'Error',
      message: error.message
    });
  }
});

// ─── ORDER FLOW ───────────────────────────────────────────────────────────

router.get('/listing/:id/buy', requireAuth, async (req, res) => {
  try {
    const listing = await svc.getListingByIdOrSlug(req.params.id);
    if (!listing || listing.status !== 'ACTIVE') {
      return res.status(404).render('404', { title: 'Listing not found' });
    }
    if (listing.sellerId === req.session.userId) {
      return res.redirect(`/whale/listing/${listing.id}`);
    }

    const shippingCos = await prisma.shippingCompany.findMany({
      where: { isActive: true },
      orderBy: { basePrice: 'asc' }
    });

    return res.render('whale/checkout', {
      title: `${res.locals.t('checkout.title')} | Whale`,
      listing,
      shippingCos,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

router.post('/listing/:id/buy', requireAuth, async (req, res) => {
  try {
    const listingId = await resolveListingId(req.params.id);
    if (!listingId) return res.status(404).render('404', { title: 'Listing not found' });
    const shippingAddress = {
      name: sanitizeText(req.body.buyerName, 100),
      phone: sanitizeText(req.body.buyerPhone, 20),
      city: sanitizeText(req.body.buyerCity, 100),
      address: sanitizeText(req.body.buyerAddress, 300)
    };

    const order = await svc.createOrder({
      listingId,
      buyerId: req.session.userId,
      quantity: sanitizeInt(req.body.quantity, { min: 1, max: 9999, defaultVal: 1 }),
      paymentMethod: req.body.paymentMethod,
      shippingMethod: req.body.shippingMethod,
      shippingCompany: sanitizeText(req.body.shippingCompany, 100),
      shippingAddress,
      buyerNote: sanitizeText(req.body.buyerNote, 1000)
    });

    if (paymentMethod === 'card') {
      req.session.pendingOrderId = order.id;
      return res.redirect(`/payment/start?orderId=${order.id}`);
    }

    return res.redirect(`/whale/orders/${order.id}?placed=1`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.redirect(`/whale/listing/${req.params.id}/buy?error=${encodeURIComponent(err.message)}`);
  }
});

// ─── CART ─────────────────────────────────────────────────────────────────

router.get('/cart', optionalAuth, async (req, res) => {
  try {
    const [cart, shippingCos] = await Promise.all([
      cartService.getCartWithDetails(req),
      prisma.shippingCompany.findMany({
        where: { isActive: true },
        orderBy: { basePrice: 'asc' }
      })
    ]);
    return res.render('whale/cart', {
      title: res.locals.t('cart.title'),
      cart,
      shippingCos,
      cities: res.locals.cities || [],
      query: req.query || {},
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

router.post('/cart/add', optionalAuth, async (req, res) => {
  try {
    const listingId = String(req.body.listingId || '').trim();
    const quantity = Number(req.body.quantity) || 1;
    if (!listingId) return res.status(400).json({ error: 'missing_listingId' });
    const count = await cartService.addToCart(req, listingId, quantity);
    return res.json({ ok: true, cartCount: count });
  } catch (err) {
    const t = res.locals.t || ((key) => key);
    const messageMap = {
      listing_unavailable: t('cart.err_unavailable'),
      own_listing: t('cart.err_own')
    };
    return res.status(400).json({
      error: err.message,
      message: messageMap[err.message] || t('ui.error')
    });
  }
});

router.post('/cart/remove', optionalAuth, async (req, res) => {
  try {
    const listingId = String(req.body.listingId || '').trim();
    await cartService.removeFromCart(req, listingId);
    return res.redirect('/whale/cart');
  } catch (error) {
    return res.redirect('/whale/cart?error=remove_failed');
  }
});

router.post('/cart/checkout', requireAuth, async (req, res) => {
  try {
    const cart = await cartService.getCartWithDetails(req);
    if (!cart.items.length) return res.redirect('/whale/cart?error=empty');

    const paymentMethod = req.body.paymentMethod;
    const shippingMethod = req.body.shippingMethod;

    if (String(paymentMethod || '').toLowerCase() === 'card' && cart.items.length > 1) {
      return res.redirect('/whale/cart?error=card_multi_not_supported');
    }

    const shippingAddress = {
      name: sanitizeText(req.body.buyerName, 100),
      phone: sanitizeText(req.body.buyerPhone, 20),
      city: sanitizeText(req.body.buyerCity, 100),
      address: sanitizeText(req.body.buyerAddress, 300)
    };
    const sanitizedNote = sanitizeText(req.body.buyerNote, 1000);
    const sanitizedShippingCo = sanitizeText(req.body.shippingCompany, 100);

    const orders = [];
    for (const item of cart.items) {
      // eslint-disable-next-line no-await-in-loop
      const order = await svc.createOrder({
        listingId: item.listingId,
        buyerId: req.session.userId,
        quantity: item.quantity,
        paymentMethod,
        shippingMethod,
        shippingCompany: sanitizedShippingCo,
        shippingAddress,
        buyerNote: sanitizedNote
      });
      orders.push(order);
    }

    await cartService.clearCart(req);

    if (String(paymentMethod || '').toLowerCase() === 'card' && orders.length > 0) {
      req.session.pendingOrderId = orders[0].id;
      return res.redirect(`/payment/start?orderId=${orders[0].id}`);
    }

    return res.redirect(`/whale/orders?placed=${orders.map((o) => o.orderNumber).join(',')}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Cart checkout error]', err);
    return res.redirect('/whale/cart?error=checkout_failed');
  }
});

// ─── ORDER MANAGEMENT ─────────────────────────────────────────────────────

router.get('/orders', requireAuth, async (req, res) => {
  try {
    const { tab = 'buying' } = req.query;
    let orders;

    if (tab === 'selling') {
      orders = await prisma.order.findMany({
        where: { sellerId: req.session.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          listing: { select: { title: true, images: true } },
          buyer: { select: { username: true, avatar: true } }
        }
      });
    } else {
      orders = await prisma.order.findMany({
        where: { buyerId: req.session.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          listing: { select: { title: true, images: true } },
          seller: { select: { username: true, avatar: true } }
        }
      });
    }

    return res.render('whale/orders', {
      title: `${res.locals.t('nav.my_orders')} | Whale`,
      orders,
      tab,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        listing: { include: { category: true } },
        buyer: { select: { id: true, username: true, avatar: true } },
        seller: { include: { sellerProfile: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
        review: true
      }
    });

    if (!order) return res.status(404).render('404', { title: 'Order not found' });
    if (![order.buyerId, order.sellerId].includes(req.session.userId)) {
      return res.status(403).render('error', {
        title: res.locals.t('ui.error'),
        message: res.locals.t('error.order_forbidden')
      });
    }

    const shippingCo = order.shippingCompany
      ? await staticDataCache.getOrSet(`shipco:${order.shippingCompany}`, () =>
          prisma.shippingCompany.findFirst({ where: { name: order.shippingCompany } })
        )
      : null;

    return res.render('whale/order-detail', {
      title: `Order ${order.orderNumber}`,
      order,
      shippingCo,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

router.post('/orders/:id/confirm', requireAuth, async (req, res) => {
  try {
    await svc.sellerConfirmOrder(req.params.id, req.session.userId);
    return res.redirect(`/whale/orders/${req.params.id}`);
  } catch (error) {
    return res.status(400).render('error', {
      title: 'Error',
      message: error.message
    });
  }
});

router.post('/orders/:id/ship', requireAuth, async (req, res) => {
  try {
    await svc.sellerShipOrder(req.params.id, req.session.userId, {
      trackingNumber: sanitizeText(req.body.trackingNumber, 100),
      shippingCompany: sanitizeText(req.body.shippingCompany, 100),
      estimatedDelivery: req.body.estimatedDelivery || null
    });
    return res.redirect(`/whale/orders/${req.params.id}`);
  } catch (error) {
    return res.status(400).render('error', {
      title: 'Error',
      message: error.message
    });
  }
});

router.post('/orders/:id/confirm-delivery', requireAuth, async (req, res) => {
  try {
    await svc.buyerConfirmDelivery(req.params.id, req.session.userId);
    return res.redirect(`/whale/orders/${req.params.id}?confirmed=1`);
  } catch (error) {
    return res.status(400).render('error', {
      title: 'Error',
      message: error.message
    });
  }
});

router.post('/orders/:id/cancel', requireAuth, async (req, res) => {
  try {
    const reason = sanitizeText(req.body.reason, 500);
    await svc.cancelOrder(req.params.id, req.session.userId, reason);
    return res.redirect(`/whale/orders/${req.params.id}`);
  } catch (error) {
    return res.status(400).render('error', {
      title: 'Error',
      message: error.message
    });
  }
});

// ─── REVIEWS ──────────────────────────────────────────────────────────────

router.post('/orders/:id/review', requireAuth, async (req, res) => {
  try {
    await svc.createReview(req.params.id, req.session.userId, {
      rating: sanitizeInt(req.body.rating, { min: 1, max: 5, defaultVal: 5 }),
      title: sanitizeText(req.body.title, 200),
      body: sanitizeText(req.body.body, 2000)
    });
    return res.redirect(`/whale/orders/${req.params.id}?reviewed=1`);
  } catch (error) {
    return res.status(400).render('error', {
      title: 'Error',
      message: error.message
    });
  }
});

// ─── MY LISTINGS & DASHBOARD ──────────────────────────────────────────────

router.get('/my-listings', requireAuth, async (req, res) => {
  try {
    const listings = await prisma.marketListing.findMany({
      where: { sellerId: req.session.userId, status: { not: 'REMOVED' } },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { orders: true } } }
    });

    return res.render('whale/my-listings', {
      title: `${res.locals.t('nav.my_listings')} | Whale`,
      listings,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const data = await svc.getSellerDashboard(req.session.userId);
    return res.render('whale/dashboard', {
      title: `${res.locals.t('nav.dashboard')} | Whale`,
      ...data,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

router.get('/saved', requireAuth, async (req, res) => {
  try {
    const saved = await svc.getSavedListings(req.session.userId);
    return res.render('whale/saved', {
      title: `${res.locals.t('nav.saved')} | Whale`,
      saved,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

// ─── SELLER PROFILE (public) ──────────────────────────────────────────────

router.get('/seller/:username', optionalAuth, async (req, res) => {
  try {
    const seller = await prisma.user.findUnique({
      where: { username: req.params.username },
      include: { sellerProfile: true }
    });
    if (!seller) return res.status(404).render('404', { title: 'Seller not found' });

    const [listings, reviews] = await Promise.all([
      prisma.marketListing.findMany({
        where: { sellerId: seller.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 24,
        include: { category: true }
      }),
      prisma.sellerReview.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { reviewer: { select: { username: true, avatar: true } } }
      })
    ]);

    return res.render('whale/seller-profile', {
      title: `${seller.username} | Seller`,
      seller,
      listings,
      reviews
    });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Server Error',
      message: error.message
    });
  }
});

module.exports = router;
