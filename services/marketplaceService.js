const prisma = require('../lib/prisma');
const { parseLimit, createCursorResponse } = require('../utils/pagination');

function buildListingFilters(query = {}) {
  const where = {
    status: query.status || 'ACTIVE'
  };

  if (query.category) {
    where.category = query.category;
  }

  if (query.condition) {
    where.condition = query.condition;
  }

  if (query.location) {
    where.location = query.location;
  }

  if (query.minPrice || query.maxPrice) {
    where.price = {};
    if (query.minPrice) where.price.gte = Number(query.minPrice);
    if (query.maxPrice) where.price.lte = Number(query.maxPrice);
  }

  if (query.search) {
    const q = String(query.search).trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { titleAr: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { descriptionAr: { contains: q, mode: 'insensitive' } }
    ];
  }

  return where;
}

async function listListings(query = {}) {
  const take = parseLimit(query.limit, 12, 36);
  const where = buildListingFilters(query);

  const listings = await prisma.marketplaceListing.findMany({
    where,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    include: {
      seller: {
        select: {
          id: true,
          username: true,
          avatar: true,
          createdAt: true
        }
      }
    }
  });

  return createCursorResponse(listings, take);
}

async function getListingById(id, incrementView = false) {
  if (incrementView) {
    await prisma.marketplaceListing.update({
      where: { id },
      data: { views: { increment: 1 } }
    });
  }

  const listing = await prisma.marketplaceListing.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          id: true,
          username: true,
          avatar: true,
          createdAt: true,
          _count: {
            select: {
              listings: true
            }
          }
        }
      }
    }
  });

  if (!listing) return null;

  const [related, sellerOtherListings] = await Promise.all([
    prisma.marketplaceListing.findMany({
      where: {
        category: listing.category,
        status: 'ACTIVE',
        id: { not: listing.id }
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    }),
    prisma.marketplaceListing.findMany({
      where: {
        sellerId: listing.sellerId,
        status: 'ACTIVE',
        id: { not: listing.id }
      },
      orderBy: { createdAt: 'desc' },
      take: 4
    })
  ]);

  return {
    ...listing,
    related,
    sellerOtherListings
  };
}

async function createListing(payload) {
  if (!payload.sellerId) throw new Error('Authentication required');

  if (!payload.title || !payload.description || !payload.price) {
    throw new Error('title, description, and price are required');
  }

  return prisma.marketplaceListing.create({
    data: {
      title: payload.title,
      titleAr: payload.titleAr || null,
      description: payload.description,
      descriptionAr: payload.descriptionAr || null,
      price: Number(payload.price),
      condition: payload.condition,
      category: payload.category,
      images: Array.isArray(payload.images) ? payload.images.slice(0, 6) : [],
      sellerId: payload.sellerId,
      status: payload.status || 'ACTIVE',
      location: payload.location,
      whatsappNumber: payload.whatsappNumber
    }
  });
}

async function updateListing({ listingId, actor, data }) {
  const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('Listing not found');

  const isOwner = actor && actor.id === listing.sellerId;
  const isModerator = actor && ['ADMIN', 'MODERATOR'].includes(actor.role);
  if (!isOwner && !isModerator) throw new Error('Not allowed');

  const payload = {
    title: data.title,
    titleAr: data.titleAr,
    description: data.description,
    descriptionAr: data.descriptionAr,
    price: data.price ? Number(data.price) : undefined,
    condition: data.condition,
    category: data.category,
    location: data.location,
    whatsappNumber: data.whatsappNumber,
    status: data.status,
    images: Array.isArray(data.images) && data.images.length ? data.images.slice(0, 6) : undefined
  };

  return prisma.marketplaceListing.update({
    where: { id: listingId },
    data: payload
  });
}

async function markListingSold({ listingId, actor }) {
  return updateListing({
    listingId,
    actor,
    data: { status: 'SOLD' }
  });
}

async function deleteListing({ listingId, actor }) {
  const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error('Listing not found');

  const isOwner = actor && actor.id === listing.sellerId;
  const isModerator = actor && ['ADMIN', 'MODERATOR'].includes(actor.role);
  if (!isOwner && !isModerator) throw new Error('Not allowed');

  return prisma.marketplaceListing.delete({ where: { id: listingId } });
}

async function myListings(userId) {
  return prisma.marketplaceListing.findMany({
    where: {
      sellerId: userId
    },
    orderBy: [{ createdAt: 'desc' }]
  });
}

async function incrementView(listingId) {
  return prisma.marketplaceListing.update({
    where: { id: listingId },
    data: { views: { increment: 1 } }
  });
}

module.exports = {
  listListings,
  getListingById,
  createListing,
  updateListing,
  markListingSold,
  deleteListing,
  myListings,
  incrementView
};
