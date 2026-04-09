const prisma = require('../lib/prisma');
const fallbackStore = require('../lib/fallbackStore');

const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * Get or create a cart for a user
 */
async function getOrCreateCart(userId) {
  if (!hasDatabase) {
    const cart = fallbackStore.getOrCreateCart(userId);
    return {
      ...cart,
      items: fallbackStore.listCartItems(userId),
    };
  }

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
  const listing = hasDatabase
    ? await prisma.listing.findUnique({ where: { id: listingId } })
    : fallbackStore.findListingBySlugOrId(listingId);
  if (!listing) throw new Error('LISTING_NOT_FOUND');
  if (listing.status !== 'ACTIVE') throw new Error('LISTING_NOT_AVAILABLE');
  if (listing.sellerId === userId) throw new Error('CANNOT_BUY_OWN');
  if (quantity < 1) throw new Error('INVALID_QUANTITY');
  if (quantity > listing.stock) throw new Error('INSUFFICIENT_STOCK');

  const cart = await getOrCreateCart(userId);

  // Block mixed-currency carts — all items must share the same currency
  if (cart.items.length > 0) {
    const cartCurrency = cart.items[0].listing?.currency || 'USD';
    const itemCurrency = listing.currency || 'USD';
    if (itemCurrency !== cartCurrency) {
      throw new Error('MIXED_CURRENCY');
    }
  }

  const existing = cart.items.find((item) => item.listingId === listingId);
  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > listing.stock) throw new Error('INSUFFICIENT_STOCK');
    if (hasDatabase) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    } else {
      fallbackStore.upsertCartItem(userId, listingId, newQty);
    }
  } else {
    if (hasDatabase) {
      await prisma.cartItem.create({
        data: { cartId: cart.id, listingId, quantity },
      });
    } else {
      fallbackStore.upsertCartItem(userId, listingId, quantity);
    }
  }

  return getOrCreateCart(userId);
}

/**
 * Update cart item quantity
 */
async function updateItemQuantity(userId, itemId, quantity) {
  const cart = hasDatabase
    ? await prisma.cart.findUnique({ where: { userId } })
    : fallbackStore.getOrCreateCart(userId);
  if (!cart) throw new Error('CART_NOT_FOUND');

  const item = hasDatabase
    ? await prisma.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id },
        include: { listing: true },
      })
    : fallbackStore.listCartItems(userId).find((entry) => entry.id === itemId);
  if (!item) throw new Error('ITEM_NOT_FOUND');

  if (quantity < 1) {
    if (hasDatabase) {
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      fallbackStore.removeCartItem(userId, itemId);
    }
  } else {
    if (quantity > item.listing.stock) throw new Error('INSUFFICIENT_STOCK');
    if (hasDatabase) {
      await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });
    } else {
      fallbackStore.upsertCartItem(userId, item.listingId, quantity);
    }
  }

  return getOrCreateCart(userId);
}

/**
 * Remove an item from the cart
 */
async function removeItem(userId, itemId) {
  const cart = hasDatabase
    ? await prisma.cart.findUnique({ where: { userId } })
    : fallbackStore.getOrCreateCart(userId);
  if (!cart) throw new Error('CART_NOT_FOUND');

  const item = hasDatabase
    ? await prisma.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id },
      })
    : fallbackStore.listCartItems(userId).find((entry) => entry.id === itemId);
  if (!item) throw new Error('ITEM_NOT_FOUND');

  if (hasDatabase) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    fallbackStore.removeCartItem(userId, itemId);
  }
  return getOrCreateCart(userId);
}

/**
 * Clear all items from the cart
 */
async function clearCart(userId) {
  const cart = hasDatabase
    ? await prisma.cart.findUnique({ where: { userId } })
    : fallbackStore.getOrCreateCart(userId);
  if (!cart) return { items: [] };

  if (hasDatabase) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  } else {
    fallbackStore.clearCartItems(userId);
  }
  return getOrCreateCart(userId);
}

/**
 * Get cart summary (total, item count)
 */
async function getCartSummary(userId) {
  const cart = await getOrCreateCart(userId);
  const items = cart.items.filter((item) => item.listing.status === 'ACTIVE');

  // Validate all items share the same currency
  const currencies = [...new Set(items.map((item) => item.listing?.currency || 'USD'))];
  if (currencies.length > 1) {
    throw new Error('MIXED_CURRENCY');
  }

  let total = 0;
  for (const item of items) {
    total += Number(item.listing.price) * item.quantity;
  }

  return {
    cart,
    itemCount: items.length,
    total: total.toFixed(2),
    currency: currencies[0] || 'USD',
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
