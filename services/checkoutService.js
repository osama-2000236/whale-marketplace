const prisma = require('../lib/prisma');
const fallbackStore = require('../lib/fallbackStore');
const cartService = require('./cartService');
const emailService = require('./emailService');
const paymentService = require('./paymentService');

const hasDatabase = Boolean(process.env.DATABASE_URL);

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

function centsToAmount(cents) {
  return (cents / 100).toFixed(2);
}

function calculateSubtotalCents(items) {
  return items.reduce((sum, item) => sum + toCents(item.listing.price) * item.quantity, 0);
}

function calculateDiscountCents(subtotalCents, coupon) {
  if (!coupon || subtotalCents <= 0) return 0;

  const requestedDiscount =
    coupon.discountType === 'percent'
      ? Math.round(subtotalCents * (Number(coupon.discountValue) / 100))
      : toCents(coupon.discountValue);

  return Math.min(subtotalCents, requestedDiscount);
}

function prorateDiscounts(items, totalDiscountCents) {
  const allocations = new Map();
  if (totalDiscountCents <= 0 || items.length === 0) return allocations;

  let remainingSubtotal = calculateSubtotalCents(items);
  let remainingDiscount = totalDiscountCents;

  items.forEach((item, index) => {
    const itemSubtotal = toCents(item.listing.price) * item.quantity;
    const itemDiscount =
      index === items.length - 1
        ? remainingDiscount
        : Math.floor((remainingDiscount * itemSubtotal) / remainingSubtotal);

    allocations.set(item.id, itemDiscount);
    remainingSubtotal -= itemSubtotal;
    remainingDiscount -= itemDiscount;
  });

  return allocations;
}

function ensureHostedProviderAvailable(paymentMethod) {
  const provider = String(paymentMethod || '').toLowerCase();
  const availability = paymentService.getProviderAvailability();
  if (!availability[provider]) {
    throw new Error('PAYMENT_PROVIDER_DISABLED');
  }
}

async function loadValidatedCoupon(tx, couponCode, activeItems) {
  if (!couponCode) return null;

  const coupon = await tx.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
  if (!coupon || !coupon.isActive) throw new Error('INVALID_COUPON');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new Error('COUPON_EXPIRED');
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new Error('COUPON_EXHAUSTED');

  const subtotal = calculateSubtotalCents(activeItems) / 100;
  if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
    throw new Error('COUPON_MIN_NOT_MET');
  }

  return coupon;
}

async function createPendingOrder(
  tx,
  { buyerId, listingId, quantity, paymentMethod, shippingAddress, buyerNote, amountCents, note }
) {
  const listing = await tx.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('LISTING_NOT_FOUND');
  if (listing.status !== 'ACTIVE') throw new Error('LISTING_NOT_AVAILABLE');
  if (listing.sellerId === buyerId) throw new Error('CANNOT_BUY_OWN');
  if (quantity < 1) throw new Error('INVALID_QUANTITY');
  if (quantity > listing.stock) throw new Error('INSUFFICIENT_STOCK');

  const existing = await tx.order.findFirst({
    where: { listingId, buyerId, status: 'PENDING' },
  });
  if (existing) throw new Error('ORDER_ALREADY_PENDING');

  const order = await tx.order.create({
    data: {
      listingId,
      buyerId,
      sellerId: listing.sellerId,
      quantity,
      amount: centsToAmount(amountCents),
      currency: listing.currency,
      paymentMethod,
      paymentStatus: paymentService.ORDER_PAYMENT_STATUS.pending,
      shippingAddress,
      buyerNote,
      events: {
        create: { event: 'created', actorId: buyerId, note },
      },
    },
    include: {
      listing: true,
      buyer: { select: { username: true, email: true } },
      seller: { select: { username: true, email: true } },
    },
  });

  await tx.listing.update({
    where: { id: listingId },
    data: { stock: { decrement: quantity } },
  });

  await tx.notification.create({
    data: {
      userId: listing.sellerId,
      type: 'ORDER',
      title: `New order #${order.orderNumber}`,
      body: `${order.buyer.username} placed an order for ${listing.title}`,
      link: `/whale/orders/${order.id}`,
    },
  });

  return order;
}

function createFallbackPendingOrder({
  buyerId,
  listingId,
  quantity,
  paymentMethod,
  shippingAddress,
  buyerNote,
  amountCents,
  note,
}) {
  const listing = fallbackStore.findListingBySlugOrId(listingId);
  if (!listing) throw new Error('LISTING_NOT_FOUND');
  if (listing.status !== 'ACTIVE') throw new Error('LISTING_NOT_AVAILABLE');
  if (listing.sellerId === buyerId) throw new Error('CANNOT_BUY_OWN');
  if (quantity < 1) throw new Error('INVALID_QUANTITY');
  if (quantity > listing.stock) throw new Error('INSUFFICIENT_STOCK');

  const existing = fallbackStore
    .listOrdersForUser(buyerId, 'buying')
    .find((order) => order.listingId === listingId && order.status === 'PENDING');
  if (existing) throw new Error('ORDER_ALREADY_PENDING');

  listing.stock -= quantity;

  return fallbackStore.createOrder({
    listingId,
    buyerId,
    sellerId: listing.sellerId,
    quantity,
    amount: centsToAmount(amountCents),
    currency: listing.currency,
    paymentMethod,
    paymentStatus: paymentService.ORDER_PAYMENT_STATUS.pending,
    shippingAddress,
    buyerNote,
    note,
  });
}

async function validateCartCheckout(userId) {
  const { cart, itemCount } = await cartService.getCartSummary(userId);
  if (itemCount === 0) throw new Error('CART_EMPTY');

  const activeItems = cart.items.filter((item) => item.listing.status === 'ACTIVE');
  if (activeItems.length === 0) throw new Error('CART_EMPTY');

  for (const item of activeItems) {
    if (item.quantity > item.listing.stock) {
      throw new Error(`INSUFFICIENT_STOCK:${item.listing.title}`);
    }
    if (item.listing.sellerId === userId) {
      throw new Error('CANNOT_BUY_OWN');
    }
  }

  return { cart, activeItems };
}

async function buildCartOrders(
  tx,
  userId,
  { activeItems, paymentMethod, shippingAddress, buyerNote, couponCode, eventNote }
) {
  const coupon = await loadValidatedCoupon(tx, couponCode, activeItems);
  const subtotalCents = calculateSubtotalCents(activeItems);
  const totalDiscountCents = calculateDiscountCents(subtotalCents, coupon);
  const discountByItemId = prorateDiscounts(activeItems, totalDiscountCents);
  const orders = [];

  for (const item of activeItems) {
    const itemSubtotalCents = toCents(item.listing.price) * item.quantity;
    const itemDiscountCents = discountByItemId.get(item.id) || 0;

    const order = await createPendingOrder(tx, {
      buyerId: userId,
      listingId: item.listing.id,
      quantity: item.quantity,
      paymentMethod,
      shippingAddress,
      buyerNote,
      amountCents: Math.max(0, itemSubtotalCents - itemDiscountCents),
      note: eventNote,
    });

    orders.push(order);
  }

  if (coupon) {
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    });
  }

  return orders;
}

async function checkoutFromCart(userId, { paymentMethod, shippingAddress, buyerNote, couponCode }) {
  const { cart, activeItems } = await validateCartCheckout(userId);

  if (!hasDatabase) {
    if (couponCode) throw new Error('INVALID_COUPON');

    const orders = activeItems.map((item) =>
      createFallbackPendingOrder({
        buyerId: userId,
        listingId: item.listing.id,
        quantity: item.quantity,
        paymentMethod,
        shippingAddress,
        buyerNote,
        amountCents: toCents(item.listing.price) * item.quantity,
        note: 'Order placed from cart',
      }),
    );

    fallbackStore.clearCartItems(userId);

    for (const order of orders) {
      emailService.sendOrderPlaced(order).catch(() => {});
    }

    return orders;
  }

  const orders = [];

  await prisma.$transaction(async (tx) => {
    const createdOrders = await buildCartOrders(tx, userId, {
      activeItems,
      paymentMethod,
      shippingAddress,
      buyerNote,
      couponCode,
      eventNote: 'Order placed from cart',
    });

    orders.push(...createdOrders);
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  });

  for (const order of orders) {
    emailService.sendOrderPlaced(order).catch(() => {});
  }

  return orders;
}

async function startCartHostedCheckout(
  userId,
  { paymentMethod, shippingAddress, buyerNote, couponCode }
) {
  if (!hasDatabase) {
    throw new Error('PAYMENT_PROVIDER_DISABLED');
  }

  ensureHostedProviderAvailable(paymentMethod);

  const { cart, activeItems } = await validateCartCheckout(userId);
  const cartSnapshot = {
    items: activeItems.map((item) => ({
      listingId: item.listing.id,
      quantity: item.quantity,
    })),
  };

  const orders = [];

  await prisma.$transaction(async (tx) => {
    const createdOrders = await buildCartOrders(tx, userId, {
      activeItems,
      paymentMethod,
      shippingAddress,
      buyerNote,
      couponCode,
      eventNote: 'Order reserved awaiting payment',
    });

    orders.push(...createdOrders);
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  });

  try {
    const hostedPayment = await paymentService.createOrderPaymentSession(paymentMethod, {
      userId,
      orderIds: orders.map((order) => order.id),
      amount: orders.reduce((sum, order) => sum + Number(order.amount), 0),
      currency: orders[0]?.currency || 'USD',
      flow: 'cart',
      cartSnapshot,
      shippingAddress,
    });

    for (const order of orders) {
      emailService.sendOrderPlaced(order).catch(() => {});
    }

    return { ...hostedPayment, orders };
  } catch (err) {
    throw err;
  }
}

async function checkoutSingle(userId, listingId, data) {
  const { paymentMethod, shippingAddress, buyerNote, quantity = 1 } = data;

  if (!hasDatabase) {
    const order = createFallbackPendingOrder({
      buyerId: userId,
      listingId,
      quantity,
      paymentMethod,
      shippingAddress,
      buyerNote,
      amountCents: toCents(fallbackStore.findListingBySlugOrId(listingId)?.price || 0) * quantity,
      note: 'Order placed',
    });

    emailService.sendOrderPlaced(order).catch(() => {});
    return order;
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('LISTING_NOT_FOUND');
  if (listing.status !== 'ACTIVE') throw new Error('LISTING_NOT_AVAILABLE');
  if (listing.sellerId === userId) throw new Error('CANNOT_BUY_OWN');
  if (quantity > listing.stock) throw new Error('INSUFFICIENT_STOCK');

  const order = await prisma.$transaction(async (tx) =>
    createPendingOrder(tx, {
      buyerId: userId,
      listingId,
      quantity,
      paymentMethod,
      shippingAddress,
      buyerNote,
      amountCents: toCents(listing.price) * quantity,
      note: 'Order placed',
    })
  );

  emailService.sendOrderPlaced(order).catch(() => {});
  return order;
}

async function startSingleHostedCheckout(userId, listingId, data) {
  const { paymentMethod, shippingAddress, buyerNote, quantity = 1 } = data;
  if (!hasDatabase) {
    throw new Error('PAYMENT_PROVIDER_DISABLED');
  }
  ensureHostedProviderAvailable(paymentMethod);

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('LISTING_NOT_FOUND');
  if (listing.status !== 'ACTIVE') throw new Error('LISTING_NOT_AVAILABLE');
  if (listing.sellerId === userId) throw new Error('CANNOT_BUY_OWN');
  if (quantity > listing.stock) throw new Error('INSUFFICIENT_STOCK');

  const order = await prisma.$transaction(async (tx) =>
    createPendingOrder(tx, {
      buyerId: userId,
      listingId,
      quantity,
      paymentMethod,
      shippingAddress,
      buyerNote,
      amountCents: toCents(listing.price) * quantity,
      note: 'Order reserved awaiting payment',
    })
  );

  try {
    const hostedPayment = await paymentService.createOrderPaymentSession(paymentMethod, {
      userId,
      orderIds: [order.id],
      amount: Number(order.amount),
      currency: order.currency,
      flow: 'single',
      listingId,
      shippingAddress,
    });

    emailService.sendOrderPlaced(order).catch(() => {});
    return { ...hostedPayment, order };
  } catch (err) {
    throw err;
  }
}

module.exports = {
  toCents,
  centsToAmount,
  calculateSubtotalCents,
  calculateDiscountCents,
  prorateDiscounts,
  checkoutFromCart,
  startCartHostedCheckout,
  checkoutSingle,
  startSingleHostedCheckout,
};
