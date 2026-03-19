const prisma = require('../lib/prisma');
const slugify = require('slugify');
const emailService = require('./emailService');

const ALLOWED_CONDITIONS = ['NEW', 'LIKE_NEW', 'USED', 'GOOD', 'FAIR', 'FOR_PARTS'];
const ALLOWED_PAYMENT_METHODS = ['card', 'cod', 'wallet'];
const ALLOWED_SHIPPING_METHODS = ['company', 'self_pickup', 'hand_to_hand'];

const CATEGORY_GROUPS = [
  { surface: 'pc-gaming', slugs: ['pc-gaming', 'pc-parts', 'gaming-gear'] },
  { surface: 'home-garden', slugs: ['home-garden', 'home'] },
];

function normalizeCategorySlug(slug) {
  for (const group of CATEGORY_GROUPS) {
    if (group.slugs.includes(slug)) return group.surface;
  }
  return slug;
}

function expandCategorySlugs(slug) {
  for (const group of CATEGORY_GROUPS) {
    if (group.slugs.includes(slug) || group.surface === slug) return group.slugs;
  }
  return [slug];
}

function parseMoney(value) {
  if (!value) return NaN;
  return Number(String(value).replace(/,/g, ''));
}

function hasDangerousHtml(value) {
  if (!value) return false;
  return /<script|on\w+\s*=/i.test(value);
}

function makeListingSlug(title, id) {
  const base = slugify(title, { lower: true, strict: true, locale: 'ar' }) || 'listing';
  return `${base}-${id.slice(0, 6)}`;
}

function buildListingWhere({ category, subcategory, city, condition, minPrice, maxPrice, q }) {
  const where = { status: 'ACTIVE' };

  if (category) {
    const slugs = expandCategorySlugs(category);
    where.category = { slug: { in: slugs } };
  }
  if (subcategory) {
    where.subcategory = { slug: subcategory };
  }
  if (city) where.city = city;
  if (condition && ALLOWED_CONDITIONS.includes(condition)) where.condition = condition;
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseMoney(minPrice);
    if (maxPrice) where.price.lte = parseMoney(maxPrice);
  }
  if (q) {
    const search = q.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { titleAr: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ];
  }

  return where;
}

async function getListings({ category, subcategory, city, condition, minPrice, maxPrice, q, sort = 'newest', cursor, take = 24 }) {
  const where = buildListingWhere({ category, subcategory, city, condition, minPrice, maxPrice, q });

  let orderBy;
  switch (sort) {
    case 'cheapest': orderBy = [{ isBoosted: 'desc' }, { price: 'asc' }]; break;
    case 'expensive': orderBy = [{ isBoosted: 'desc' }, { price: 'desc' }]; break;
    case 'popular': orderBy = [{ isBoosted: 'desc' }, { views: 'desc' }]; break;
    default: orderBy = [{ isBoosted: 'desc' }, { createdAt: 'desc' }];
  }

  const query = {
    where,
    orderBy,
    take: take + 1,
    include: {
      seller: { select: { id: true, username: true, avatar: true, isVerified: true, sellerProfile: true } },
      category: true,
      subcategory: true,
      _count: { select: { orders: true, reviews: true } },
    },
  };
  if (cursor) query.cursor = { id: cursor };
  if (cursor) query.skip = 1;

  const items = await prisma.marketListing.findMany(query);
  const hasMore = items.length > take;
  const listings = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore ? listings[listings.length - 1].id : null;

  const totalCount = await prisma.marketListing.count({ where });

  return { listings, hasMore, nextCursor, totalCount };
}

async function getListingFacets(filters = {}) {
  const where = buildListingWhere(filters);

  const agg = await prisma.marketListing.aggregate({
    where: { status: 'ACTIVE' },
    _min: { price: true },
    _max: { price: true },
  });

  const categories = await prisma.marketCategory.findMany({
    include: { _count: { select: { listings: { where: { status: 'ACTIVE' } } } } },
    orderBy: { order: 'asc' },
  });

  const categoryCountMap = {};
  for (const cat of categories) {
    const key = normalizeCategorySlug(cat.slug);
    categoryCountMap[key] = (categoryCountMap[key] || 0) + cat._count.listings;
  }

  return {
    priceBounds: { min: agg._min.price || 0, max: agg._max.price || 10000 },
    categoryCountMap,
  };
}

async function getListing(id) {
  return prisma.marketListing.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, username: true, avatar: true, isVerified: true, createdAt: true, sellerProfile: true, lastSeenAt: true } },
      category: true,
      subcategory: true,
      reviews: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { reviewer: { select: { id: true, username: true, avatar: true } } },
      },
      _count: { select: { orders: true, reviews: true, savedBy: true } },
    },
  });
}

async function getListingByIdOrSlug(idOrSlug) {
  let listing = await prisma.marketListing.findUnique({
    where: { id: idOrSlug },
    include: {
      seller: { select: { id: true, username: true, avatar: true, isVerified: true, createdAt: true, sellerProfile: true, lastSeenAt: true } },
      category: true, subcategory: true,
      reviews: { take: 20, orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { id: true, username: true, avatar: true } } } },
      _count: { select: { orders: true, reviews: true, savedBy: true } },
    },
  });
  if (!listing) {
    listing = await prisma.marketListing.findUnique({
      where: { slug: idOrSlug },
      include: {
        seller: { select: { id: true, username: true, avatar: true, isVerified: true, createdAt: true, sellerProfile: true, lastSeenAt: true } },
        category: true, subcategory: true,
        reviews: { take: 20, orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { id: true, username: true, avatar: true } } } },
        _count: { select: { orders: true, reviews: true, savedBy: true } },
      },
    });
  }
  return listing;
}

async function incrementViews(listingId) {
  await prisma.marketListing.update({ where: { id: listingId }, data: { views: { increment: 1 } } }).catch(() => {});
}

async function incrementWaClicks(listingId) {
  await prisma.marketListing.update({ where: { id: listingId }, data: { waClicks: { increment: 1 } } }).catch(() => {});
}

async function createListing(sellerId, data) {
  const { title, titleAr, description, descriptionAr, price, negotiable, condition, images, categoryId, subcategoryId, city, tags, specs, quantity } = data;

  if (!title || title.length < 3 || title.length > 200) throw new Error('Title must be 3-200 characters');
  if (hasDangerousHtml(title) || hasDangerousHtml(description)) throw new Error('Invalid content detected');
  if (!description || description.length < 3) throw new Error('Description must be at least 3 characters');
  const parsedPrice = parseMoney(price);
  if (isNaN(parsedPrice) || parsedPrice < 1 || parsedPrice > 1000000) throw new Error('Price must be 1-1,000,000');
  if (!city) throw new Error('City is required');
  if (condition && !ALLOWED_CONDITIONS.includes(condition)) throw new Error('Invalid condition');

  // Upsert seller profile
  await prisma.sellerProfile.upsert({
    where: { userId: sellerId },
    create: { userId: sellerId, city },
    update: {},
  });

  const listing = await prisma.marketListing.create({
    data: {
      title, titleAr: titleAr || null,
      description, descriptionAr: descriptionAr || null,
      price: parsedPrice,
      negotiable: Boolean(negotiable),
      condition: condition || 'GOOD',
      images: images || [],
      sellerId,
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      city,
      tags: tags || [],
      specs: specs || null,
      quantity: quantity || 1,
    },
  });

  const slug = makeListingSlug(title, listing.id);
  return prisma.marketListing.update({ where: { id: listing.id }, data: { slug } });
}

async function updateListing(listingId, sellerId, data) {
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('Listing not found');
  if (listing.sellerId !== sellerId) throw new Error('Not authorized');

  const updateData = {};
  if (data.title !== undefined) {
    if (data.title.length < 3 || data.title.length > 200) throw new Error('Title must be 3-200 characters');
    if (hasDangerousHtml(data.title)) throw new Error('Invalid content');
    updateData.title = data.title;
  }
  if (data.titleAr !== undefined) updateData.titleAr = data.titleAr;
  if (data.description !== undefined) {
    if (data.description.length < 3) throw new Error('Description too short');
    updateData.description = data.description;
  }
  if (data.descriptionAr !== undefined) updateData.descriptionAr = data.descriptionAr;
  if (data.price !== undefined) {
    const p = parseMoney(data.price);
    if (isNaN(p) || p < 1 || p > 1000000) throw new Error('Invalid price');
    updateData.price = p;
  }
  if (data.negotiable !== undefined) updateData.negotiable = Boolean(data.negotiable);
  if (data.condition !== undefined) {
    if (!ALLOWED_CONDITIONS.includes(data.condition)) throw new Error('Invalid condition');
    updateData.condition = data.condition;
  }
  if (data.images) updateData.images = data.images;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.subcategoryId !== undefined) updateData.subcategoryId = data.subcategoryId;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.specs !== undefined) updateData.specs = data.specs;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;

  return prisma.marketListing.update({ where: { id: listingId }, data: updateData });
}

async function markSold(listingId, sellerId) {
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('Listing not found');
  if (listing.sellerId !== sellerId) throw new Error('Not authorized');
  return prisma.marketListing.update({ where: { id: listingId }, data: { status: 'SOLD' } });
}

async function deleteListing(listingId, sellerId, isAdmin = false) {
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('Listing not found');
  if (!isAdmin && listing.sellerId !== sellerId) throw new Error('Not authorized');
  return prisma.marketListing.update({ where: { id: listingId }, data: { status: 'REMOVED' } });
}

function generateOrderNumber() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(10000 + Math.random() * 90000));
  return `WH-${year}-${rand}`;
}

async function createOrder({ listingId, buyerId, quantity = 1, paymentMethod, shippingMethod, shippingAddress, shippingCompany, buyerNote }) {
  const payment = String(paymentMethod || '').toLowerCase();
  if (!ALLOWED_PAYMENT_METHODS.includes(payment)) throw new Error('Invalid payment method');
  const shipping = String(shippingMethod || '').toLowerCase();
  if (!ALLOWED_SHIPPING_METHODS.includes(shipping)) throw new Error('Invalid shipping method');

  if (shipping === 'company' && shippingAddress) {
    const addr = shippingAddress;
    if (!addr.name || !addr.phone || !addr.city || !addr.address) {
      throw new Error('Complete shipping address is required');
    }
    if (!/^\+?\d{9,15}$/.test(addr.phone.replace(/[\s-]/g, ''))) {
      throw new Error('Invalid phone number');
    }
  }

  const listing = await prisma.marketListing.findUnique({ where: { id: listingId }, include: { seller: true } });
  if (!listing || listing.status !== 'ACTIVE') throw new Error('Listing not available');
  if (listing.sellerId === buyerId) throw new Error('Cannot buy your own listing');
  if (quantity > listing.quantity) throw new Error('Insufficient quantity');

  const amount = listing.price * quantity;
  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        listingId,
        buyerId,
        sellerId: listing.sellerId,
        quantity,
        amount,
        paymentMethod: payment,
        paymentStatus: payment === 'card' ? 'held' : 'pending',
        shippingMethod: shipping,
        shippingAddress: shippingAddress || null,
        shippingCompany: shippingCompany || null,
        buyerNote: buyerNote || null,
      },
    });

    await tx.orderEvent.create({
      data: { orderId: newOrder.id, event: 'created', note: 'Order placed', actorId: buyerId },
    });

    await tx.notification.create({
      data: {
        userId: listing.sellerId,
        type: 'SALE_INQUIRY',
        message: `New order #${orderNumber} for "${listing.title}"`,
        referenceId: newOrder.id,
        referenceType: 'order',
      },
    });

    return newOrder;
  });

  // Send emails (fire-and-forget)
  const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { username: true, email: true } });
  emailService.sendOrderPlaced(order, buyer, listing).catch(() => {});

  return order;
}

async function sellerConfirmOrder(orderId, sellerId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');
  if (order.sellerId !== sellerId) throw new Error('Not authorized');
  if (order.orderStatus !== 'PENDING') throw new Error('Order cannot be confirmed');

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { orderStatus: 'SELLER_CONFIRMED' } });
    await tx.orderEvent.create({ data: { orderId, event: 'seller_confirmed', actorId: sellerId } });
    await tx.notification.create({
      data: { userId: order.buyerId, type: 'SYSTEM', message: `Seller confirmed your order #${order.orderNumber}`, referenceId: orderId, referenceType: 'order' },
    });
  });

  const buyer = await prisma.user.findUnique({ where: { id: order.buyerId }, select: { email: true, username: true } });
  emailService.sendOrderConfirmed(order, buyer).catch(() => {});
}

async function sellerShipOrder(orderId, sellerId, { trackingNumber, shippingCompany, estimatedDelivery }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');
  if (order.sellerId !== sellerId) throw new Error('Not authorized');
  if (!['PENDING', 'SELLER_CONFIRMED'].includes(order.orderStatus)) throw new Error('Order cannot be shipped');

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'SHIPPED',
        trackingNumber: trackingNumber || null,
        shippingCompany: shippingCompany || order.shippingCompany,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
      },
    });
    await tx.orderEvent.create({ data: { orderId, event: 'shipped', note: trackingNumber ? `Tracking: ${trackingNumber}` : null, actorId: sellerId } });
    await tx.notification.create({
      data: { userId: order.buyerId, type: 'SYSTEM', message: `Your order #${order.orderNumber} has been shipped!`, referenceId: orderId, referenceType: 'order' },
    });
  });

  const buyer = await prisma.user.findUnique({ where: { id: order.buyerId }, select: { email: true, username: true } });
  emailService.sendOrderShipped(order, buyer, trackingNumber, shippingCompany).catch(() => {});
}

async function buyerConfirmDelivery(orderId, buyerId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');
  if (order.buyerId !== buyerId) throw new Error('Not authorized');
  if (!['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(order.orderStatus)) throw new Error('Order not eligible for delivery confirmation');

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { orderStatus: 'COMPLETED', paymentStatus: 'released', deliveredAt: now, confirmedAt: now },
    });
    await tx.orderEvent.create({ data: { orderId, event: 'completed', note: 'Buyer confirmed delivery', actorId: buyerId } });
    await tx.sellerProfile.upsert({
      where: { userId: order.sellerId },
      create: { userId: order.sellerId, totalSales: 1, totalRevenue: order.amount },
      update: { totalSales: { increment: 1 }, totalRevenue: { increment: order.amount } },
    });
    await tx.notification.create({
      data: { userId: order.sellerId, type: 'SYSTEM', message: `Order #${order.orderNumber} completed! Payment released.`, referenceId: orderId, referenceType: 'order' },
    });
    await tx.notification.create({
      data: { userId: order.buyerId, type: 'SYSTEM', message: `Order #${order.orderNumber} completed! Thank you.`, referenceId: orderId, referenceType: 'order' },
    });
  });

  const seller = await prisma.user.findUnique({ where: { id: order.sellerId }, select: { email: true, username: true } });
  emailService.sendOrderCompleted(order, seller).catch(() => {});
}

async function cancelOrder(orderId, actorId, reason) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');
  if (order.buyerId !== actorId && order.sellerId !== actorId) throw new Error('Not authorized');
  if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.orderStatus)) throw new Error('Order cannot be cancelled');

  const isBuyer = order.buyerId === actorId;
  const otherUserId = isBuyer ? order.sellerId : order.buyerId;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'CANCELLED',
        paymentStatus: order.paymentStatus === 'held' ? 'refunded' : order.paymentStatus,
        cancelReason: reason || null,
      },
    });
    await tx.orderEvent.create({
      data: { orderId, event: 'cancelled', note: reason || null, actorId },
    });
    await tx.notification.create({
      data: {
        userId: otherUserId,
        type: 'SYSTEM',
        message: `Order #${order.orderNumber} has been cancelled.`,
        referenceId: orderId,
        referenceType: 'order',
      },
    });
  });
}

async function createReview(orderId, reviewerId, { rating, title, body }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error('Order not found');
  if (order.buyerId !== reviewerId) throw new Error('Only the buyer can review');
  if (order.orderStatus !== 'COMPLETED') throw new Error('Order must be completed');

  const existing = await prisma.sellerReview.findUnique({ where: { orderId } });
  if (existing) throw new Error('Already reviewed');

  const r = Math.max(1, Math.min(5, Math.round(Number(rating))));
  if (isNaN(r)) throw new Error('Rating must be 1-5');

  const review = await prisma.$transaction(async (tx) => {
    const rev = await tx.sellerReview.create({
      data: {
        orderId,
        listingId: order.listingId,
        reviewerId,
        sellerId: order.sellerId,
        rating: r,
        title: title || null,
        body: body || null,
      },
    });

    // Recalculate seller average
    const agg = await tx.sellerReview.aggregate({
      where: { sellerId: order.sellerId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.sellerProfile.upsert({
      where: { userId: order.sellerId },
      create: { userId: order.sellerId, averageRating: agg._avg.rating || 0, reviewCount: agg._count.rating },
      update: { averageRating: agg._avg.rating || 0, reviewCount: agg._count.rating },
    });

    return rev;
  });

  return review;
}

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
  return prisma.savedListing.findMany({
    where: { userId },
    orderBy: { savedAt: 'desc' },
    include: {
      listing: {
        include: {
          seller: { select: { id: true, username: true, avatar: true, isVerified: true, sellerProfile: true } },
          category: true,
        },
      },
    },
  });
}

async function getSellerDashboard(sellerId) {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: sellerId } });

  const activeListings = await prisma.marketListing.count({
    where: { sellerId, status: 'ACTIVE' },
  });

  const pendingOrders = await prisma.order.count({
    where: { sellerId, orderStatus: { in: ['PENDING', 'SELLER_CONFIRMED', 'SHIPPED'] } },
  });

  const recentOrders = await prisma.order.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      listing: { select: { id: true, title: true, images: true } },
      buyer: { select: { id: true, username: true, avatar: true } },
    },
  });

  const recentReviews = await prisma.sellerReview.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { reviewer: { select: { id: true, username: true, avatar: true } } },
  });

  const myListingsPreview = await prisma.marketListing.findMany({
    where: { sellerId, status: { not: 'REMOVED' } },
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { _count: { select: { orders: true } } },
  });

  return { profile, activeListings, pendingOrders, recentOrders, recentReviews, myListingsPreview };
}

module.exports = {
  getListings, getListingFacets, getListing, getListingByIdOrSlug,
  incrementViews, incrementWaClicks,
  createListing, updateListing, markSold, deleteListing,
  createOrder, sellerConfirmOrder, sellerShipOrder, buyerConfirmDelivery, cancelOrder,
  createReview, toggleSaved, getSavedListings, getSellerDashboard,
};
