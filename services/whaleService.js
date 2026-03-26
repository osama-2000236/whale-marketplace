const prisma = require('../lib/prisma');
const slugify = require('slugify');
const { cursorPagination, processCursorResults } = require('../utils/pagination');
const emailService = require('./emailService');
const { validateTransition } = require('./stateMachine');

// ── CATEGORIES ──
async function getCategories() {
  return prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: { subcategories: { orderBy: { order: 'asc' } } },
  });
}

// ── LISTINGS ──
async function getListings(filters = {}) {
  const { q, categorySlug, city, condition, minPrice, maxPrice, sort, cursor } = filters;

  const where = { status: 'ACTIVE' };

  if (q) {
    const search = q.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { titleAr: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (categorySlug) {
    const cat = await prisma.category.findUnique({ where: { slug: categorySlug } });
    if (cat) where.categoryId = cat.id;
  }
  if (city) where.city = city;
  if (condition) where.condition = condition;
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  const orderBy = {
    newest: { createdAt: 'desc' },
    oldest: { createdAt: 'asc' },
    price_asc: { price: 'asc' },
    price_desc: { price: 'desc' },
    popular: { views: 'desc' },
  }[sort] || { createdAt: 'desc' };

  const pagination = cursorPagination(cursor);

  const listings = await prisma.listing.findMany({
    where,
    orderBy,
    ...pagination,
    include: {
      category: true,
      seller: { select: { username: true, slug: true, avatarUrl: true } },
    },
  });

  const { items, nextCursor } = processCursorResults(listings);
  const total = await prisma.listing.count({ where });

  return { listings: items, nextCursor, total };
}

async function getListing(slugOrId) {
  let listing = await prisma.listing.findUnique({
    where: { slug: slugOrId },
    include: {
      category: true,
      subcategory: true,
      seller: {
        include: { sellerProfile: true },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { reviewer: { select: { username: true, avatarUrl: true } } },
      },
    },
  });

  if (!listing) {
    listing = await prisma.listing.findUnique({
      where: { id: slugOrId },
      include: {
        category: true,
        subcategory: true,
        seller: {
          include: { sellerProfile: true },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { reviewer: { select: { username: true, avatarUrl: true } } },
        },
      },
    });
  }

  if (!listing) return null;

  // Increment views atomically
  await prisma.listing.update({ where: { id: listing.id }, data: { views: { increment: 1 } } });

  return listing;
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
  } = data;

  if (!title) throw new Error('TITLE_REQUIRED');
  if (!price || parseFloat(price) <= 0) throw new Error('INVALID_PRICE');
  if (!images || images.length === 0) throw new Error('IMAGE_REQUIRED');
  if (!categoryId) throw new Error('CATEGORY_REQUIRED');

  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) throw new Error('CATEGORY_NOT_FOUND');

  let slug = slugify(title, { lower: true, strict: true });
  const existing = await prisma.listing.findUnique({ where: { slug } });
  if (existing) slug += '-' + Math.random().toString(36).slice(2, 7);

  return prisma.listing.create({
    data: {
      slug,
      title,
      titleAr: titleAr || null,
      description,
      descriptionAr: descriptionAr || null,
      price: parseFloat(price),
      negotiable: negotiable === true || negotiable === 'true' || negotiable === 'on',
      condition: condition || 'USED',
      images: Array.isArray(images) ? images : [images],
      categoryId,
      subcategoryId: subcategoryId || null,
      city: city || '',
      sellerId,
      status: 'ACTIVE',
      tags: Array.isArray(tags)
        ? tags
        : tags
          ? tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      specs: specs || null,
    },
    include: { category: true },
  });
}

async function updateListing(id, sellerId, data) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) throw new Error('NOT_FOUND');
  if (listing.sellerId !== sellerId) throw new Error('UNAUTHORIZED');

  const update = {};
  if (data.title !== undefined) {
    update.title = data.title;
    update.slug = slugify(data.title, { lower: true, strict: true });
    const existing = await prisma.listing.findFirst({ where: { slug: update.slug, NOT: { id } } });
    if (existing) update.slug += '-' + Math.random().toString(36).slice(2, 7);
  }
  if (data.titleAr !== undefined) update.titleAr = data.titleAr;
  if (data.description !== undefined) update.description = data.description;
  if (data.descriptionAr !== undefined) update.descriptionAr = data.descriptionAr;
  if (data.price !== undefined) update.price = parseFloat(data.price);
  if (data.negotiable !== undefined)
    update.negotiable =
      data.negotiable === true || data.negotiable === 'true' || data.negotiable === 'on';
  if (data.condition !== undefined) update.condition = data.condition;
  if (data.images !== undefined)
    update.images = Array.isArray(data.images) ? data.images : [data.images];
  if (data.categoryId !== undefined) update.categoryId = data.categoryId;
  if (data.subcategoryId !== undefined) update.subcategoryId = data.subcategoryId || null;
  if (data.city !== undefined) update.city = data.city;
  if (data.tags !== undefined)
    update.tags = Array.isArray(data.tags)
      ? data.tags
      : data.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

  return prisma.listing.update({
    where: { id },
    data: update,
    include: { category: true },
  });
}

async function deleteListing(id, actorId, isAdmin = false) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) throw new Error('NOT_FOUND');
  if (!isAdmin && listing.sellerId !== actorId) throw new Error('UNAUTHORIZED');

  return prisma.listing.update({
    where: { id },
    data: { status: 'REMOVED' },
  });
}

// ── ORDERS ──
async function createOrder(data) {
  const { listingId, buyerId, quantity, paymentMethod, shippingAddress, buyerNote } = data;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('LISTING_NOT_FOUND');
  if (listing.status !== 'ACTIVE') throw new Error('LISTING_NOT_ACTIVE');
  if (listing.sellerId === buyerId) throw new Error('CANNOT_BUY_OWN');

  // Check for existing pending order
  const pendingOrder = await prisma.order.findFirst({
    where: { listingId, status: 'PENDING' },
  });
  if (pendingOrder) throw new Error('ORDER_ALREADY_PENDING');

  const order = await prisma.order.create({
    data: {
      listingId,
      buyerId,
      sellerId: listing.sellerId,
      quantity: parseInt(quantity) || 1,
      amount: listing.price,
      currency: listing.currency,
      paymentMethod: paymentMethod || 'manual',
      shippingAddress: shippingAddress || null,
      buyerNote: buyerNote || null,
      status: 'PENDING',
      events: {
        create: { event: 'created', actorId: buyerId, note: 'Order placed' },
      },
    },
    include: {
      listing: true,
      buyer: { select: { id: true, username: true, email: true } },
      seller: { select: { id: true, username: true, email: true } },
    },
  });

  // Notify seller
  await prisma.notification.create({
    data: {
      userId: listing.sellerId,
      type: 'ORDER',
      title: 'طلب جديد | New Order',
      body: `Order #${order.orderNumber} for "${listing.title}"`,
      link: `/whale/orders/${order.id}`,
    },
  });

  emailService.sendOrderPlaced(order).catch(() => {});

  return order;
}

async function transitionOrder(orderId, actorId, action, payload = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: { select: { id: true, username: true, email: true, role: true } },
      seller: { select: { id: true, username: true, email: true, role: true } },
      listing: true,
    },
  });
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const actorUser =
    actorId === order.buyerId ? order.buyer : actorId === order.sellerId ? order.seller : null;
  const actorRole = actorUser?.role || 'MEMBER';

  // If actor is admin but not a party, we need to fetch their role
  let resolvedRole = actorRole;
  if (!actorUser) {
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
    resolvedRole = actor?.role || 'MEMBER';
  }

  const newStatus = validateTransition(order, actorId, resolvedRole, action, payload);

  const updateData = { status: newStatus };
  if (action === 'ship' && payload.trackingNumber) {
    updateData.trackingNumber = payload.trackingNumber;
    if (payload.shippingCompany) updateData.shippingCompany = payload.shippingCompany;
  }
  if (action === 'cancel' && payload.reason) {
    updateData.cancelReason = payload.reason;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...updateData,
      events: {
        create: {
          event: action,
          actorId,
          note: payload.note || payload.reason || null,
        },
      },
    },
    include: {
      buyer: { select: { id: true, username: true, email: true } },
      seller: { select: { id: true, username: true, email: true } },
      listing: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  // Notify the other party
  const notifyUserId = actorId === order.buyerId ? order.sellerId : order.buyerId;
  await prisma.notification.create({
    data: {
      userId: notifyUserId,
      type: 'ORDER',
      title: `Order ${newStatus}`,
      body: `Order #${order.orderNumber} is now ${newStatus}`,
      link: `/whale/orders/${order.id}`,
    },
  });

  // Send emails based on transition
  if (newStatus === 'CONFIRMED') emailService.sendOrderConfirmed(updated).catch(() => {});
  if (newStatus === 'SHIPPED') emailService.sendOrderShipped(updated).catch(() => {});
  if (newStatus === 'COMPLETED') {
    emailService.sendOrderCompleted(updated).catch(() => {});
    // Update seller stats
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: order.sellerId },
    });
    if (sellerProfile) {
      await prisma.sellerProfile.update({
        where: { userId: order.sellerId },
        data: {
          totalSales: { increment: 1 },
          totalRevenue: { increment: parseFloat(order.amount) },
        },
      });
    }
  }

  return updated;
}

// ── REVIEWS ──
async function postReview(orderId, reviewerId, data) {
  const { rating, body } = data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { review: true },
  });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status !== 'COMPLETED') throw new Error('ORDER_NOT_COMPLETED');
  if (order.buyerId !== reviewerId) throw new Error('NOT_BUYER');
  if (order.review) throw new Error('ALREADY_REVIEWED');
  if (!rating || rating < 1 || rating > 5) throw new Error('INVALID_RATING');

  const review = await prisma.review.create({
    data: {
      orderId,
      listingId: order.listingId,
      reviewerId,
      sellerId: order.sellerId,
      rating: parseInt(rating),
      body: body || null,
    },
    include: { reviewer: { select: { username: true, avatarUrl: true } } },
  });

  // Recalculate seller ratings
  const agg = await prisma.review.aggregate({
    where: { sellerId: order.sellerId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.sellerProfile.update({
    where: { userId: order.sellerId },
    data: {
      avgRating: agg._avg.rating || 0,
      reviewCount: agg._count.rating || 0,
    },
  });

  // Notify seller
  await prisma.notification.create({
    data: {
      userId: order.sellerId,
      type: 'REVIEW',
      title: 'تقييم جديد | New Review',
      body: `${rating} stars for order #${order.orderNumber}`,
      link: `/whale/orders/${order.id}`,
    },
  });

  return review;
}

// ── SAVED ──
async function toggleSaved(userId, listingId) {
  const existing = await prisma.savedListing.findUnique({
    where: { userId_listingId: { userId, listingId } },
  });
  if (existing) {
    await prisma.savedListing.delete({ where: { userId_listingId: { userId, listingId } } });
    return { saved: false };
  }
  await prisma.savedListing.create({ data: { userId, listingId } });
  return { saved: true };
}

async function getSavedListings(userId) {
  const saved = await prisma.savedListing.findMany({
    where: { userId },
    orderBy: { savedAt: 'desc' },
    include: {
      listing: {
        include: {
          category: true,
          seller: { select: { username: true, slug: true, avatarUrl: true } },
        },
      },
    },
  });
  return saved.map((s) => s.listing);
}

// ── DASHBOARD ──
async function getSellerDashboard(sellerId) {
  const [totalListings, activeListings, totalOrders, pendingOrders, recentOrders, profile] =
    await Promise.all([
      prisma.listing.count({ where: { sellerId } }),
      prisma.listing.count({ where: { sellerId, status: 'ACTIVE' } }),
      prisma.order.count({ where: { sellerId } }),
      prisma.order.count({ where: { sellerId, status: 'PENDING' } }),
      prisma.order.findMany({
        where: { sellerId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: { select: { title: true, slug: true } },
          buyer: { select: { username: true } },
        },
      }),
      prisma.sellerProfile.findUnique({ where: { userId: sellerId } }),
    ]);

  return {
    totalListings,
    activeListings,
    totalOrders,
    pendingOrders,
    totalRevenue: profile?.totalRevenue || 0,
    avgRating: profile?.avgRating || 0,
    reviewCount: profile?.reviewCount || 0,
    recentOrders,
  };
}

// ── ORDERS LIST ──
async function getUserOrders(userId, tab = 'buying') {
  const where = tab === 'selling' ? { sellerId: userId } : { buyerId: userId };
  return prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      listing: { select: { title: true, titleAr: true, slug: true, images: true, price: true } },
      buyer: { select: { username: true, avatarUrl: true } },
      seller: { select: { username: true, avatarUrl: true } },
    },
  });
}

async function getOrder(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      listing: {
        include: { category: true },
      },
      buyer: { select: { id: true, username: true, avatarUrl: true, email: true } },
      seller: { select: { id: true, username: true, avatarUrl: true, email: true } },
      events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { username: true } } } },
      review: true,
    },
  });
}

module.exports = {
  validateTransition,
  getCategories,
  getListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
  createOrder,
  transitionOrder,
  postReview,
  toggleSaved,
  getSavedListings,
  getSellerDashboard,
  getUserOrders,
  getOrder,
};
