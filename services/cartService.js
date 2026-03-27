const prisma = require('../lib/prisma');

/**
 * Get or create a cart for a user
 */
async function getOrCreateCart(userId) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          listing: {
            include: { category: true, seller: { select: { username: true, avatarUrl: true } } },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: {
        items: {
          include: {
            listing: {
              include: { category: true, seller: { select: { username: true, avatarUrl: true } } },
            },
          },
        },
      },
    });
  }

  return cart;
}

/**
 * Add an item to the cart
 */
async function addItem(userId, listingId, quantity = 1) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('LISTING_NOT_FOUND');
  if (listing.status !== 'ACTIVE') throw new Error('LISTING_NOT_AVAILABLE');
  if (listing.sellerId === userId) throw new Error('CANNOT_BUY_OWN');
  if (quantity < 1) throw new Error('INVALID_QUANTITY');
  if (quantity > listing.stock) throw new Error('INSUFFICIENT_STOCK');

  const cart = await getOrCreateCart(userId);

  const existing = cart.items.find((item) => item.listingId === listingId);
  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > listing.stock) throw new Error('INSUFFICIENT_STOCK');
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, listingId, quantity },
    });
  }

  return getOrCreateCart(userId);
}

/**
 * Update cart item quantity
 */
async function updateItemQuantity(userId, itemId, quantity) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new Error('CART_NOT_FOUND');

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    include: { listing: true },
  });
  if (!item) throw new Error('ITEM_NOT_FOUND');

  if (quantity < 1) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    if (quantity > item.listing.stock) throw new Error('INSUFFICIENT_STOCK');
    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  }

  return getOrCreateCart(userId);
}

/**
 * Remove an item from the cart
 */
async function removeItem(userId, itemId) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new Error('CART_NOT_FOUND');

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
  });
  if (!item) throw new Error('ITEM_NOT_FOUND');

  await prisma.cartItem.delete({ where: { id: itemId } });
  return getOrCreateCart(userId);
}

/**
 * Clear all items from the cart
 */
async function clearCart(userId) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return { items: [] };

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getOrCreateCart(userId);
}

/**
 * Get cart summary (total, item count)
 */
async function getCartSummary(userId) {
  const cart = await getOrCreateCart(userId);
  const items = cart.items.filter((item) => item.listing.status === 'ACTIVE');

  let total = 0;
  for (const item of items) {
    total += Number(item.listing.price) * item.quantity;
  }

  return {
    cart,
    itemCount: items.length,
    total: total.toFixed(2),
    currency: items[0]?.listing?.currency || 'USD',
  };
}

module.exports = {
  getOrCreateCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  getCartSummary,
};
