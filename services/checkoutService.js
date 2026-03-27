const prisma = require('../lib/prisma');
const cartService = require('./cartService');
const emailService = require('./emailService');

/**
 * Checkout from cart — creates orders for each unique seller
 */
async function checkoutFromCart(userId, { paymentMethod, shippingAddress, buyerNote, couponCode }) {
  const { cart, itemCount } = await cartService.getCartSummary(userId);
  if (itemCount === 0) throw new Error('CART_EMPTY');

  const activeItems = cart.items.filter((item) => item.listing.status === 'ACTIVE');
  if (activeItems.length === 0) throw new Error('CART_EMPTY');

  // Validate stock
  for (const item of activeItems) {
    if (item.quantity > item.listing.stock) {
      throw new Error(`INSUFFICIENT_STOCK:${item.listing.title}`);
    }
    if (item.listing.sellerId === userId) {
      throw new Error('CANNOT_BUY_OWN');
    }
  }

  // Apply coupon if provided
  let discount = 0;
  let coupon = null;
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
    if (!coupon || !coupon.isActive) throw new Error('INVALID_COUPON');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new Error('COUPON_EXPIRED');
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new Error('COUPON_EXHAUSTED');

    const subtotal = activeItems.reduce(
      (sum, item) => sum + Number(item.listing.price) * item.quantity,
      0,
    );

    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      throw new Error('COUPON_MIN_NOT_MET');
    }

    discount =
      coupon.discountType === 'percent'
        ? subtotal * (Number(coupon.discountValue) / 100)
        : Number(coupon.discountValue);
  }

  // Group items by seller
  const sellerGroups = {};
  for (const item of activeItems) {
    const sid = item.listing.sellerId;
    if (!sellerGroups[sid]) sellerGroups[sid] = [];
    sellerGroups[sid].push(item);
  }

  const orders = [];

  await prisma.$transaction(async (tx) => {
    for (const [sellerId, items] of Object.entries(sellerGroups)) {
      const amount = items.reduce(
        (sum, item) => sum + Number(item.listing.price) * item.quantity,
        0,
      );

      // Proportional discount
      const totalSubtotal = activeItems.reduce(
        (sum, item) => sum + Number(item.listing.price) * item.quantity,
        0,
      );
      const orderDiscount = totalSubtotal > 0 ? discount * (amount / totalSubtotal) : 0;
      const finalAmount = Math.max(0, amount - orderDiscount);

      const order = await tx.order.create({
        data: {
          listingId: items[0].listing.id,
          buyerId: userId,
          sellerId,
          quantity: items.reduce((sum, item) => sum + item.quantity, 0),
          amount: finalAmount.toFixed(2),
          paymentMethod,
          shippingAddress,
          buyerNote,
          events: {
            create: { event: 'created', actorId: userId, note: 'Order placed from cart' },
          },
        },
        include: {
          listing: true,
          buyer: { select: { username: true, email: true } },
          seller: { select: { username: true, email: true } },
        },
      });

      // Decrement stock
      for (const item of items) {
        await tx.listing.update({
          where: { id: item.listing.id },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Notify seller
      await tx.notification.create({
        data: {
          userId: sellerId,
          type: 'ORDER',
          title: `New order #${order.orderNumber}`,
          body: `${order.buyer.username} placed an order`,
          link: `/whale/orders/${order.id}`,
        },
      });

      orders.push(order);
    }

    // Update coupon usage
    if (coupon) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    // Clear cart
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  });

  // Send emails (fire and forget)
  for (const order of orders) {
    emailService.sendOrderPlaced(order).catch(() => {});
  }

  return orders;
}

/**
 * Single-item checkout (existing flow, enhanced with stock/coupon)
 */
async function checkoutSingle(userId, listingId, data) {
  const { paymentMethod, shippingAddress, buyerNote, quantity = 1 } = data;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('LISTING_NOT_FOUND');
  if (listing.status !== 'ACTIVE') throw new Error('LISTING_NOT_AVAILABLE');
  if (listing.sellerId === userId) throw new Error('CANNOT_BUY_OWN');
  if (quantity > listing.stock) throw new Error('INSUFFICIENT_STOCK');

  // Check for existing pending order
  const existing = await prisma.order.findFirst({
    where: { listingId, buyerId: userId, status: 'PENDING' },
  });
  if (existing) throw new Error('ORDER_ALREADY_PENDING');

  const amount = Number(listing.price) * quantity;

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        listingId,
        buyerId: userId,
        sellerId: listing.sellerId,
        quantity,
        amount: amount.toFixed(2),
        paymentMethod,
        shippingAddress,
        buyerNote,
        events: {
          create: { event: 'created', actorId: userId },
        },
      },
      include: {
        listing: true,
        buyer: { select: { username: true, email: true } },
        seller: { select: { username: true, email: true } },
      },
    });

    // Decrement stock
    await tx.listing.update({
      where: { id: listingId },
      data: { stock: { decrement: quantity } },
    });

    // Notify seller
    await tx.notification.create({
      data: {
        userId: listing.sellerId,
        type: 'ORDER',
        title: `New order #${newOrder.orderNumber}`,
        body: `${newOrder.buyer.username} placed an order for ${listing.title}`,
        link: `/whale/orders/${newOrder.id}`,
      },
    });

    return newOrder;
  });

  emailService.sendOrderPlaced(order).catch(() => {});
  return order;
}

module.exports = { checkoutFromCart, checkoutSingle };
