const prisma = require('../lib/prisma');

async function searchUsers(q, limit = 10) {
  return prisma.$queryRaw`
    SELECT id, username, avatar, bio,
      ts_headline('simple', coalesce(username, '') || ' ' || coalesce(bio, ''), plainto_tsquery('simple', ${q})) AS snippet
    FROM "User"
    WHERE to_tsvector('simple', coalesce(username, '') || ' ' || coalesce(bio, '')) @@ plainto_tsquery('simple', ${q})
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
}

async function searchPosts(q, limit = 10) {
  return prisma.$queryRaw`
    SELECT p.id, p.content, p."createdAt", p."authorId", p."roomId",
      ts_headline('simple', coalesce(p.content, ''), plainto_tsquery('simple', ${q})) AS snippet
    FROM "Post" p
    WHERE to_tsvector('simple', coalesce(p.content, '')) @@ plainto_tsquery('simple', ${q})
    ORDER BY p."createdAt" DESC
    LIMIT ${limit}
  `;
}

async function searchRooms(q, limit = 10) {
  return prisma.$queryRaw`
    SELECT id, name, "nameAr", slug, game, "memberCount",
      ts_headline('simple', coalesce(name, '') || ' ' || coalesce("nameAr", '') || ' ' || coalesce(description, '') || ' ' || coalesce("descriptionAr", ''), plainto_tsquery('simple', ${q})) AS snippet
    FROM "GameRoom"
    WHERE to_tsvector('simple', coalesce(name, '') || ' ' || coalesce("nameAr", '') || ' ' || coalesce(description, '') || ' ' || coalesce("descriptionAr", '')) @@ plainto_tsquery('simple', ${q})
    ORDER BY "memberCount" DESC
    LIMIT ${limit}
  `;
}

async function searchListings(q, limit = 10) {
  return prisma.$queryRaw`
    SELECT id, title, "titleAr", price, category, location,
      ts_headline('simple', coalesce(title, '') || ' ' || coalesce("titleAr", '') || ' ' || coalesce(description, '') || ' ' || coalesce("descriptionAr", ''), plainto_tsquery('simple', ${q})) AS snippet
    FROM "MarketplaceListing"
    WHERE status = 'active'
      AND to_tsvector('simple', coalesce(title, '') || ' ' || coalesce("titleAr", '') || ' ' || coalesce(description, '') || ' ' || coalesce("descriptionAr", '')) @@ plainto_tsquery('simple', ${q})
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
}

async function searchProducts(q, limit = 10) {
  return prisma.$queryRaw`
    SELECT id, name, "nameAr", category, price,
      ts_headline('simple', coalesce(name, '') || ' ' || coalesce("nameAr", '') || ' ' || coalesce(description, ''), plainto_tsquery('simple', ${q})) AS snippet
    FROM "Product"
    WHERE "inStock" = true
      AND to_tsvector('simple', coalesce(name, '') || ' ' || coalesce("nameAr", '') || ' ' || coalesce(description, '')) @@ plainto_tsquery('simple', ${q})
    ORDER BY "featured" DESC, "createdAt" DESC
    LIMIT ${limit}
  `;
}

async function globalSearch({ q, type = 'all', limit = 10 }) {
  const query = String(q || '').trim();
  if (!query) {
    return {
      query,
      type,
      users: [],
      posts: [],
      rooms: [],
      marketplace: [],
      products: []
    };
  }

  const cappedLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);

  if (type === 'users') {
    return { query, type, users: await searchUsers(query, cappedLimit) };
  }

  if (type === 'posts') {
    return { query, type, posts: await searchPosts(query, cappedLimit) };
  }

  if (type === 'rooms') {
    return { query, type, rooms: await searchRooms(query, cappedLimit) };
  }

  if (type === 'marketplace') {
    return { query, type, marketplace: await searchListings(query, cappedLimit) };
  }

  if (type === 'products') {
    return { query, type, products: await searchProducts(query, cappedLimit) };
  }

  const [users, posts, rooms, marketplace, products] = await Promise.all([
    searchUsers(query, cappedLimit),
    searchPosts(query, cappedLimit),
    searchRooms(query, cappedLimit),
    searchListings(query, cappedLimit),
    searchProducts(query, cappedLimit)
  ]);

  return {
    query,
    type: 'all',
    users,
    posts,
    rooms,
    marketplace,
    products
  };
}

module.exports = {
  globalSearch
};
