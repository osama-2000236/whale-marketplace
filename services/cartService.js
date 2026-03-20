const prisma = require('../lib/prisma');

function getCart(req) {
  if (!Array.isArray(req.session.cart)) req.session.cart = [];
  return req.session.cart;
}

async function addToCart(req, listingId, quantity = 1) {
  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'ACTIVE') throw new Error('Listing not available');
  if (req.user && listing.sellerId === req.user.id) throw new Error('Cannot add your own listing');

  const qty = Math.max(1, Math.min(quantity, listing.quantity));
  const cart = getCart(req);

  const existing = cart.find((item) => item.listingId === listingId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, listing.quantity);
    existing.addedAt = new Date().toISOString();
  } else {
    cart.push({ listingId, quantity: qty, addedAt: new Date().toISOString() });
  }

  return cart.length;
}

function removeFromCart(req, listingId) {
  const cart = getCart(req);
  req.session.cart = cart.filter((item) => item.listingId !== listingId);
}

async function getCartWithDetails(req) {
  const cart = getCart(req);
  if (cart.length === 0) return { items: [], total: 0, count: 0 };

  const ids = cart.map((c) => c.listingId);
  const listings = await prisma.marketListing.findMany({
    where: { id: { in: ids } },
    include: {
      seller: { select: { id: true, username: true, avatar: true } },
      category: true,
    },
  });

  const listingMap = {};
  for (const l of listings) listingMap[l.id] = l;

  const items = [];
  let total = 0;

  for (const cartItem of cart) {
    const listing = listingMap[cartItem.listingId];
    if (!listing || listing.status !== 'ACTIVE') continue;
    const subtotal = listing.price * cartItem.quantity;
    total += subtotal;
    items.push({ listingId: cartItem.listingId, quantity: cartItem.quantity, listing, subtotal });
  }

  // Clean up removed/inactive items from session
  req.session.cart = cart.filter((c) => listingMap[c.listingId]?.status === 'ACTIVE');

  return { items, total, count: items.length };
}

function clearCart(req) {
  req.session.cart = [];
}

module.exports = { getCart, addToCart, removeFromCart, getCartWithDetails, clearCart };
