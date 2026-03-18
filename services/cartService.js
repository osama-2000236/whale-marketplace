'use strict';

const prisma = require('../lib/prisma');

function ensureCart(req) {
  if (!req.session.cart || !Array.isArray(req.session.cart)) {
    req.session.cart = [];
  }
  return req.session.cart;
}

function getCart(req) {
  return ensureCart(req);
}

async function addToCart(req, listingId, quantity = 1) {
  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      price: true,
      images: true,
      city: true,
      status: true,
      sellerId: true,
      quantity: true
    }
  });

  if (!listing || listing.status !== 'ACTIVE') throw new Error('listing_unavailable');
  if (req.session.userId && listing.sellerId === req.session.userId) throw new Error('own_listing');

  const qty = Math.max(1, Number(quantity) || 1);
  const stock = Math.max(1, Number(listing.quantity) || 1);
  const cart = ensureCart(req);
  const existing = cart.find((i) => i.listingId === listing.id);

  if (existing) {
    existing.quantity = Math.min(stock, existing.quantity + qty);
    existing.addedAt = Date.now();
  } else {
    cart.push({
      listingId: listing.id,
      quantity: Math.min(stock, qty),
      addedAt: Date.now()
    });
  }

  req.session.cart = cart;
  return cart.length;
}

async function removeFromCart(req, listingId) {
  const cart = ensureCart(req);
  req.session.cart = cart.filter((i) => i.listingId !== listingId);
}

async function getCartWithDetails(req) {
  const cart = ensureCart(req);
  if (cart.length === 0) return { items: [], total: 0, count: 0 };

  const listings = await prisma.marketListing.findMany({
    where: { id: { in: cart.map((i) => i.listingId) } },
    include: {
      seller: { select: { username: true, avatar: true } },
      category: true
    }
  });

  const items = cart
    .map((item) => {
      const listing = listings.find((l) => l.id === item.listingId);
      if (!listing || listing.status !== 'ACTIVE') return null;
      const qty = Math.max(1, Number(item.quantity) || 1);
      return {
        listingId: listing.id,
        quantity: qty,
        listing,
        subtotal: listing.price * qty
      };
    })
    .filter(Boolean);

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  return {
    items,
    total,
    count: items.length
  };
}

async function clearCart(req) {
  req.session.cart = [];
}

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  getCartWithDetails,
  clearCart
};
