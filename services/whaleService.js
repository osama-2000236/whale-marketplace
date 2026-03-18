const prisma = require('../lib/prisma');
const slugify = require('slugify');
const emailService = require('./emailService');

const ALLOWED_CONDITIONS = ['NEW', 'LIKE_NEW', 'USED', 'GOOD', 'FAIR', 'FOR_PARTS'];
const ALLOWED_PAYMENT_METHODS = ['card', 'cod', 'wallet'];
const ALLOWED_SHIPPING_METHODS = ['company', 'self_pickup', 'hand_to_hand'];
const CATEGORY_GROUPS = [
  { surface: 'pc-gaming', slugs: ['pc-gaming', 'pc-parts', 'gaming-gear'] },
  { surface: 'home-garden', slugs: ['home-garden', 'home'] }
];

function normalizeCategorySlug(slug) {
  const clean = String(slug || '').trim();
  if (!clean) return clean;
  const match = CATEGORY_GROUPS.find((group) => group.slugs.includes(clean));
  return match ? match.surface : clean;
}

function expandCategorySlugs(slug) {
  const normalized = normalizeCategorySlug(slug);
  if (!normalized) return [];
  const match = CATEGORY_GROUPS.find((group) => group.surface === normalized);
  return match ? match.slugs : [normalized];
}

function parseMoney(value) {
  if (typeof value === 'number') return value;
  return Number(String(value || '').replace(/,/g, '').trim());
}

function hasDangerousHtml(value) {
  return /<\s*script|onerror\s*=|onload\s*=|javascript:/i.test(String(value || ''));
}

function makeListingSlug(title, id) {
  const base = slugify(String(title || ''), {
    lower: true,
    strict: true,
    locale: 'ar',
    remove: /[^\w\s-]/g
  }).slice(0, 60);
  return `${base || 'listing'}-${String(id).slice(0, 6)}`;
}

function buildListingWhere({
  category,
  subcategory,
  city,
  condition,
  minPrice,
  maxPrice,
  q
} = {}, options = {}) {
  const where = { status: 'ACTIVE' };
  const includePrice = options.includePrice !== false;
  const categorySlugs = expandCategorySlugs(category);

  if (categorySlugs.length === 1) where.category = { slug: categorySlugs[0] };
  else if (categorySlugs.length > 1) where.category = { slug: { in: categorySlugs } };
  if (subcategory) where.subcategory = { slug: subcategory };
  if (city) where.city = city;
  if (condition) where.condition = condition;

  if (includePrice && (minPrice || maxPrice)) {
    where.price = {};
    if (minPrice) where.price.gte = Number(minPrice);
    if (maxPrice) where.price.lte = Number(maxPrice);
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { titleAr: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { descriptionAr: { contains: q, mode: 'insensitive' } },
      { tags: { has: String(q).toLowerCase() } }
    ];
  }

  return where;
}

// ─── LISTINGS ─────────────────────────────────────────────────────────────

async function getListings({
  category,
  subcategory,
  city,
  condition,
  minPrice,
  maxPrice,
  q,
  sort = 'newest',
  cursor,
  take = 24
}) {
  const where = buildListingWhere({
    category,
    subcategory,
    city,
    condition,
    minPrice,
    maxPrice,
    q
  });

  const sortMap = {
    newest: { createdAt: 'desc' },
    cheapest: { price: 'asc' },
    expensive: { price: 'desc' },
    popular: { views: 'desc' }
  };

  const orderBy = sortMap[sort] || sortMap.newest;

  const [listings, totalCount] = await Promise.all([
    prisma.marketListing.findMany({
      where,
      orderBy: [{ isBoosted: 'desc' }, orderBy],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        seller: { include: { sellerProfile: true } },
        category: { select: { name: true, nameAr: true, slug: true, icon: true } },
        subcategory: { select: { name: true, slug: true } },
        _count: { select: { reviews: true, orders: true } }
      }
    }),
    prisma.marketListing.count({ where })
  ]);

  const hasMore = listings.length > take;
  return {
    listings: listings.slice(0, take),
    hasMore,
    nextCursor: hasMore ? listings[take - 1].id : null,
    totalCount
  };
}

async function getListingFacets(filters = {}) {
  const where = buildListingWhere(filters, { includePrice: false });
  const [priceBounds, categoryCounts] = await Promise.all([
    prisma.marketListing.aggregate({
      where,
      _min: { price: true },
      _max: { price: true }
    }),
    prisma.marketListing.groupBy({
      by: ['categoryId'],
      where,
      _count: { categoryId: true }
    })
  ]);

  const categoryIds = categoryCounts.map((row) => row.categoryId).filter(Boolean);
  const categories = categoryIds.length
    ? await prisma.marketCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, slug: true }
    })
    : [];
  const categorySlugMap = categories.reduce((acc, row) => {
    acc[row.id] = row.slug;
    return acc;
  }, {});
  const categoryCountMap = categoryCounts.reduce((acc, row) => {
    const categorySlug = normalizeCategorySlug(categorySlugMap[row.categoryId]);
    if (categorySlug) {
      acc[categorySlug] = (acc[categorySlug] || 0) + row._count.categoryId;
    }
    return acc;
  }, {});

  return {
    priceBounds: {
      min: Math.max(0, Math.floor(priceBounds._min.price || 0)),
      max: Math.max(100, Math.ceil(priceBounds._max.price || 100))
    },
    categoryCountMap
  };
}

async function getListing(id) {
  return prisma.marketListing.findUnique({
    where: { id },
    include: {
      seller: { include: { sellerProfile: true } },
      category: true,
      subcategory: true,
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { reviewer: { select: { username: true, avatar: true, createdAt: true } } }
      },
      _count: { select: { reviews: true, orders: true, savedBy: true } }
    }
  });
}

async function getListingByIdOrSlug(idOrSlug) {
  return prisma.marketListing.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }]
    },
    include: {
      seller: { include: { sellerProfile: true } },
      category: true,
      subcategory: true,
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { reviewer: { select: { username: true, avatar: true, createdAt: true } } }
      },
      _count: { select: { reviews: true, orders: true, savedBy: true } }
    }
  });
}

async function incrementViews(listingId) {
  return prisma.marketListing.update({
    where: { id: listingId },
    data: { views: { increment: 1 } }
  });
}

async function incrementWaClicks(listingId) {
  return prisma.marketListing.update({
    where: { id: listingId },
    data: { waClicks: { increment: 1 } }
  });
}

async function createListing(sellerId, data) {
  const {
    title,
    titleAr,
    description,
    descriptionAr,
    price,
    negotiable,
    condition,
    images,
    categoryId,
    subcategoryId,
    city,
    tags,
    specs,
    quantity
  } = data;

  const cleanTitle = String(title || '').trim();
  const cleanDescription = String(description || '').trim();
  const parsedPrice = parseMoney(price);
  const cleanCity = String(city || '').trim();
  const finalCondition = String(condition || '').toUpperCase();

  if (!cleanTitle || cleanTitle.length < 3 || cleanTitle.length > 200) {
    throw new Error('Invalid title');
  }
  if (hasDangerousHtml(cleanTitle)) {
    throw new Error('Invalid title');
  }
  if (!cleanDescription || cleanDescription.length < 3) {
    throw new Error('Invalid description');
  }
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0 || parsedPrice > 1000000) {
    throw new Error('Invalid price');
  }
  if (!cleanCity) {
    throw new Error('Invalid city');
  }
  if (!ALLOWED_CONDITIONS.includes(finalCondition)) {
    throw new Error('Invalid condition');
  }

  await prisma.sellerProfile.upsert({
    where: { userId: sellerId },
    create: { userId: sellerId },
    update: {}
  });

  const listing = await prisma.marketListing.create({
    data: {
      title: cleanTitle,
      titleAr: titleAr ? String(titleAr).trim() : null,
      description: cleanDescription,
      descriptionAr: descriptionAr ? String(descriptionAr).trim() : null,
      price: parsedPrice,
      negotiable: negotiable === true || negotiable === 'true' || negotiable === 'on',
      condition: finalCondition,
      images: Array.isArray(images) ? images.slice(0, 6) : [],
      sellerId,
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      city: cleanCity,
      tags: Array.isArray(tags)
        ? tags.map((t) => String(t).trim()).filter(Boolean)
        : String(tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      specs: specs || null,
      quantity: Math.max(1, Number(quantity) || 1)
    }
  });

  const slug = makeListingSlug(listing.title, listing.id);
  return prisma.marketListing.update({
    where: { id: listing.id },
    data: { slug }
  });
}

async function updateListing(listingId, sellerId, data) {
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.sellerId !== sellerId) throw new Error('Forbidden');

  const payload = {};
  if (data.title) payload.title = String(data.title).trim();
  if (data.titleAr !== undefined) payload.titleAr = data.titleAr ? String(data.titleAr).trim() : null;
  if (data.description) payload.description = String(data.description).trim();
  if (data.descriptionAr !== undefined) payload.descriptionAr = data.descriptionAr ? String(data.descriptionAr).trim() : null;
  if (data.price !== undefined) {
    const parsedPrice = parseMoney(data.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0 || parsedPrice > 1000000) {
      throw new Error('Invalid price');
    }
    payload.price = parsedPrice;
  }
  if (data.negotiable !== undefined) {
    payload.negotiable = data.negotiable === true || data.negotiable === 'true' || data.negotiable === 'on';
  }
  if (data.condition) {
    const finalCondition = String(data.condition).toUpperCase();
    if (!ALLOWED_CONDITIONS.includes(finalCondition)) throw new Error('Invalid condition');
    payload.condition = finalCondition;
  }
  if (data.images) payload.images = Array.isArray(data.images) ? data.images.slice(0, 6) : [];
  if (data.categoryId !== undefined) payload.categoryId = data.categoryId || null;
  if (data.subcategoryId !== undefined) payload.subcategoryId = data.subcategoryId || null;
  if (data.city) payload.city = data.city;
  if (data.tags !== undefined) {
    payload.tags = Array.isArray(data.tags)
      ? data.tags.map((t) => String(t).trim()).filter(Boolean)
      : String(data.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
  }
  if (data.specs !== undefined) payload.specs = data.specs || null;
  if (data.quantity !== undefined) payload.quantity = Math.max(1, Number(data.quantity) || 1);

  return prisma.marketListing.update({
    where: { id: listingId },
    data: payload
  });
}

async function markSold(listingId, sellerId) {
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.sellerId !== sellerId) throw new Error('Forbidden');

  return prisma.marketListing.update({
    where: { id: listingId },
    data: { status: 'SOLD' }
  });
}

async function deleteListing(listingId, sellerId, isAdmin = false) {
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('Not found');
  if (!isAdmin && listing.sellerId !== sellerId) throw new Error('Forbidden');

  return prisma.marketListing.update({
    where: { id: listingId },
    data: { status: 'REMOVED' }
  });
}

// ─── ORDERS ───────────────────────────────────────────────────────────────

async function generateOrderNumber() {
  const year = new Date().getFullYear();

  for (let i = 0; i < 6; i += 1) {
    const random = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `WH-${year}-${random}`;
    // eslint-disable-next-line no-await-in-loop
    const existing = await prisma.order.findUnique({ where: { orderNumber } });
    if (!existing) return orderNumber;
  }

  return `WH-${year}-${Date.now().toString().slice(-6)}`;
}

async function createOrder({
  listingId,
  buyerId,
  quantity = 1,
  paymentMethod,
  shippingMethod,
  shippingAddress,
  shippingCompany,
  buyerNote
}) {
  const payment = String(paymentMethod || '').toLowerCase();
  if (!ALLOWED_PAYMENT_METHODS.includes(payment)) {
    throw new Error('Invalid payment method');
  }

  const shipping = String(shippingMethod || 'company').toLowerCase();
  if (!ALLOWED_SHIPPING_METHODS.includes(shipping)) {
    throw new Error('Invalid shipping method');
  }

  if (shipping === 'company') {
    const address = shippingAddress || {};
    if (!address.name || !address.phone || !address.city || !address.address) {
      throw new Error('Missing shipping address');
    }
    const phone = String(address.phone || '').replace(/\s+/g, '');
    if (!/^\+?\d{9,15}$/.test(phone)) {
      throw new Error('Invalid phone');
    }
  }

  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'ACTIVE') throw new Error('Listing not available');
  if (listing.sellerId === buyerId) throw new Error('Cannot buy your own listing');

  const quantityInt = Math.max(1, Number(quantity) || 1);
  if (quantityInt > listing.quantity) throw new Error('Requested quantity exceeds stock');

  const amount = listing.price * quantityInt;

  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: await generateOrderNumber(),
        listingId,
        buyerId,
        sellerId: listing.sellerId,
        quantity: quantityInt,
        amount,
        paymentMethod: payment,
        paymentStatus: payment === 'cod' ? 'pending' : 'held',
        orderStatus: 'PENDING',
        shippingMethod: shipping,
        shippingAddress: shippingAddress || null,
        shippingCompany: shippingCompany || null,
        buyerNote: buyerNote || null
      }
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        event: 'created',
        actorId: buyerId,
        note: `Order placed by buyer. Payment: ${payment}`
      }
    });

    await tx.notification.create({
      data: {
        userId: listing.sellerId,
        type: 'SYSTEM',
        message: `🐳 طلب جديد على Whale رقم ${order.orderNumber} — New order #${order.orderNumber} for "${listing.title}"`
      }
    });

    return order;
  });

  const buyer = await prisma.user.findUnique({ where: { id: buyerId } }).catch(() => null);
  await emailService.sendOrderPlaced(order, buyer, listing).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[Email] sendOrderPlaced failed:', err.message);
  });

  return order;
}

async function sellerConfirmOrder(orderId, sellerId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.sellerId !== sellerId) throw new Error('Forbidden');
  if (order.orderStatus !== 'PENDING') throw new Error('Invalid state');

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { orderStatus: 'SELLER_CONFIRMED' }
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        event: 'seller_confirmed',
        actorId: sellerId,
        note: 'Seller confirmed the order'
      }
    });

    await tx.notification.create({
      data: {
        userId: order.buyerId,
        type: 'SYSTEM',
        message: `✅ البائع قبل طلبك رقم ${order.orderNumber} — Seller confirmed order #${order.orderNumber}`
      }
    });

    return updated;
  });

  const buyer = await prisma.user.findUnique({ where: { id: order.buyerId } }).catch(() => null);
  await emailService.sendOrderConfirmed(updated, buyer).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[Email] sendOrderConfirmed failed:', err.message);
  });

  return updated;
}

async function sellerShipOrder(orderId, sellerId, { trackingNumber, shippingCompany, estimatedDelivery }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.sellerId !== sellerId) throw new Error('Forbidden');
  if (!['SELLER_CONFIRMED', 'PENDING'].includes(order.orderStatus)) throw new Error('Invalid state');

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'SHIPPED',
        trackingNumber: trackingNumber || null,
        shippingCompany: shippingCompany || null,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null
      }
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        event: 'shipped',
        actorId: sellerId,
        note: `Shipped via ${shippingCompany || 'N/A'}. Tracking: ${trackingNumber || 'N/A'}`
      }
    });

    await tx.notification.create({
      data: {
        userId: order.buyerId,
        type: 'SYSTEM',
        message: `🚚 تم شحن طلبك رقم ${order.orderNumber} — Order #${order.orderNumber} shipped. Tracking: ${trackingNumber || '-'}`
      }
    });

    return updated;
  });

  const buyer = await prisma.user.findUnique({ where: { id: order.buyerId } }).catch(() => null);
  await emailService.sendOrderShipped(updated, buyer, trackingNumber, shippingCompany).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[Email] sendOrderShipped failed:', err.message);
  });

  return updated;
}

async function buyerConfirmDelivery(orderId, buyerId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyerId !== buyerId) throw new Error('Forbidden');
  if (!['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(order.orderStatus)) throw new Error('Invalid state');

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'COMPLETED',
        paymentStatus: 'released',
        deliveredAt: new Date(),
        confirmedAt: new Date()
      }
    });

    await tx.sellerProfile.upsert({
      where: { userId: order.sellerId },
      create: { userId: order.sellerId, totalSales: 1, totalRevenue: order.amount },
      update: {
        totalSales: { increment: 1 },
        totalRevenue: { increment: order.amount }
      }
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        event: 'completed',
        actorId: buyerId,
        note: 'Buyer confirmed delivery — order complete'
      }
    });

    await tx.notification.create({
      data: {
        userId: order.sellerId,
        type: 'SYSTEM',
        message: `💰 تم تأكيد الاستلام للطلب ${order.orderNumber} — Order #${order.orderNumber} completed. Leave a review!`
      }
    });

    await tx.notification.create({
      data: {
        userId: order.buyerId,
        type: 'SYSTEM',
        message: `⭐ شارك تجربتك — Please review your order #${order.orderNumber}`
      }
    });

    return updated;
  });

  const seller = await prisma.user.findUnique({ where: { id: order.sellerId } }).catch(() => null);
  await emailService.sendOrderCompleted(updated, seller).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[Email] sendOrderCompleted failed:', err.message);
  });

  return updated;
}

async function cancelOrder(orderId, actorId, reason) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Not found');
  if (order.buyerId !== actorId && order.sellerId !== actorId) throw new Error('Forbidden');
  if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.orderStatus)) throw new Error('Cannot cancel');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'CANCELLED',
        paymentStatus: order.paymentStatus === 'held' ? 'refunded' : order.paymentStatus,
        cancelReason: reason || 'Cancelled by user'
      }
    });

    await tx.orderEvent.create({
      data: { orderId, event: 'cancelled', actorId, note: `Cancelled: ${reason || '-'}` }
    });

    const notifyId = actorId === order.buyerId ? order.sellerId : order.buyerId;
    await tx.notification.create({
      data: {
        userId: notifyId,
        type: 'SYSTEM',
        message: `❌ تم إلغاء الطلب ${order.orderNumber} — Order #${order.orderNumber} was cancelled`
      }
    });

    return updated;
  });
}

// ─── REVIEWS ──────────────────────────────────────────────────────────────

async function createReview(orderId, reviewerId, { rating, title, body }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { review: true }
  });

  if (!order || order.buyerId !== reviewerId) throw new Error('Forbidden');
  if (order.orderStatus !== 'COMPLETED') throw new Error('Order not completed');
  if (order.review) throw new Error('Already reviewed');

  const ratingInt = Number(rating);
  if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  return prisma.$transaction(async (tx) => {
    const review = await tx.sellerReview.create({
      data: {
        orderId,
        listingId: order.listingId,
        reviewerId,
        sellerId: order.sellerId,
        rating: ratingInt,
        title: title || null,
        body: body || null
      }
    });

    const allReviews = await tx.sellerReview.findMany({
      where: { sellerId: order.sellerId },
      select: { rating: true }
    });

    const avg = allReviews.length
      ? allReviews.reduce((sum, item) => sum + item.rating, 0) / allReviews.length
      : 0;

    await tx.sellerProfile.upsert({
      where: { userId: order.sellerId },
      create: {
        userId: order.sellerId,
        averageRating: avg,
        reviewCount: allReviews.length
      },
      update: {
        averageRating: avg,
        reviewCount: allReviews.length
      }
    });

    return review;
  });
}

// ─── SAVED LISTINGS ───────────────────────────────────────────────────────

async function toggleSaved(userId, listingId) {
  const existing = await prisma.savedListing.findUnique({
    where: { userId_listingId: { userId, listingId } }
  });

  if (existing) {
    await prisma.savedListing.delete({
      where: { userId_listingId: { userId, listingId } }
    });
    return { saved: false };
  }

  await prisma.savedListing.create({ data: { userId, listingId } });
  return { saved: true };
}

async function getSavedListings(userId) {
  return prisma.savedListing.findMany({
    where: { userId },
    include: {
      listing: {
        include: {
          seller: { include: { sellerProfile: true } },
          category: true
        }
      }
    },
    orderBy: { savedAt: 'desc' }
  });
}

// ─── SELLER DASHBOARD ─────────────────────────────────────────────────────

async function getSellerDashboard(sellerId) {
  const [profile, activeListings, pendingOrders, recentOrders, recentReviews, myListingsPreview] = await Promise.all([
    prisma.sellerProfile.findUnique({ where: { userId: sellerId } }),
    prisma.marketListing.count({ where: { sellerId, status: 'ACTIVE' } }),
    prisma.order.count({
      where: { sellerId, orderStatus: { in: ['PENDING', 'SELLER_CONFIRMED', 'SHIPPED'] } }
    }),
    prisma.order.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        listing: { select: { title: true, images: true } },
        buyer: { select: { username: true, avatar: true } }
      }
    }),
    prisma.sellerReview.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { reviewer: { select: { username: true, avatar: true } } }
    }),
    prisma.marketListing.findMany({
      where: { sellerId, status: { in: ['ACTIVE', 'SOLD'] } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { _count: { select: { orders: true } } }
    })
  ]);

  return { profile, activeListings, pendingOrders, recentOrders, recentReviews, myListingsPreview };
}

module.exports = {
  getListings,
  getListingFacets,
  getListing,
  getListingByIdOrSlug,
  incrementViews,
  incrementWaClicks,
  createListing,
  updateListing,
  markSold,
  deleteListing,
  createOrder,
  sellerConfirmOrder,
  sellerShipOrder,
  buyerConfirmDelivery,
  cancelOrder,
  createReview,
  toggleSaved,
  getSavedListings,
  getSellerDashboard
};
