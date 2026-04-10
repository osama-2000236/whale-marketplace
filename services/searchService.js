const prisma = require('../lib/prisma');

const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * Full-text search for listings using PostgreSQL tsvector.
 * Supports both English and Arabic text via simple/arabic dictionary.
 */
async function searchListings(query, { locale = 'ar', categoryId, city, condition, minPrice, maxPrice, sort = 'relevance', page = 1, limit = 24 } = {}) {
  if (!hasDatabase) return { listings: [], total: 0, query };
  if (!query || !query.trim()) return { listings: [], total: 0, query: '' };

  const cleanQuery = query.trim();

  // Build search terms: split on whitespace, join with & for AND matching
  const tsQuery = cleanQuery
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')) // keep only letters/numbers (Unicode-safe)
    .filter((w) => w.length > 0)
    .join(' & ');

  if (!tsQuery) return { listings: [], total: 0, query: cleanQuery };

  // Use simple config for Arabic (no stemmer) and english config for English
  const tsConfig = locale === 'ar' ? 'simple' : 'english';

  // Build WHERE conditions
  const conditions = [`l."status" = 'ACTIVE'`];
  const params = [];
  let paramIdx = 1;

  // Full-text search condition
  conditions.push(`(
    to_tsvector('${tsConfig}', COALESCE(l."title", '') || ' ' || COALESCE(l."titleAr", '') || ' ' || COALESCE(l."description", '') || ' ' || COALESCE(l."descriptionAr", ''))
    @@ to_tsquery('${tsConfig}', $${paramIdx})
  )`);
  params.push(tsQuery);
  paramIdx++;

  if (categoryId) {
    conditions.push(`l."categoryId" = $${paramIdx}`);
    params.push(categoryId);
    paramIdx++;
  }
  if (city) {
    conditions.push(`l."city" = $${paramIdx}`);
    params.push(city);
    paramIdx++;
  }
  if (condition) {
    conditions.push(`l."condition" = $${paramIdx}::"ItemCondition"`);
    params.push(condition);
    paramIdx++;
  }
  if (minPrice !== undefined && minPrice !== null) {
    conditions.push(`l."price" >= $${paramIdx}`);
    params.push(Number(minPrice));
    paramIdx++;
  }
  if (maxPrice !== undefined && maxPrice !== null) {
    conditions.push(`l."price" <= $${paramIdx}`);
    params.push(Number(maxPrice));
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  // Sort
  let orderClause;
  switch (sort) {
    case 'price_asc':
      orderClause = 'l."price" ASC';
      break;
    case 'price_desc':
      orderClause = 'l."price" DESC';
      break;
    case 'newest':
      orderClause = 'l."createdAt" DESC';
      break;
    case 'relevance':
    default:
      orderClause = `ts_rank(
        to_tsvector('${tsConfig}', COALESCE(l."title", '') || ' ' || COALESCE(l."titleAr", '') || ' ' || COALESCE(l."description", '') || ' ' || COALESCE(l."descriptionAr", '')),
        to_tsquery('${tsConfig}', $1)
      ) DESC`;
      break;
  }

  const offset = (page - 1) * limit;

  // Run count and data queries in parallel
  const countQuery = `SELECT COUNT(*)::int as total FROM "Listing" l WHERE ${whereClause}`;
  const dataQuery = `
    SELECT l."id", l."title", l."titleAr", l."price", l."currency", l."city",
           l."condition", l."images", l."createdAt", l."categoryId",
           c."name" as "categoryName", c."nameAr" as "categoryNameAr",
           u."username", u."avatarUrl"
    FROM "Listing" l
    LEFT JOIN "Category" c ON l."categoryId" = c."id"
    LEFT JOIN "User" u ON l."sellerId" = u."id"
    WHERE ${whereClause}
    ORDER BY ${orderClause}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countResult, listings] = await Promise.all([
    prisma.$queryRawUnsafe(countQuery, ...params),
    prisma.$queryRawUnsafe(dataQuery, ...params),
  ]);

  const total = countResult[0]?.total || 0;

  // Log search for analytics (fire-and-forget)
  logSearch(null, cleanQuery, total, locale).catch(() => {});

  return {
    listings,
    total,
    query: cleanQuery,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Log a search query for analytics.
 */
async function logSearch(userId, query, resultsCount, locale = 'ar') {
  if (!hasDatabase) return null;
  return prisma.searchLog.create({
    data: {
      userId: userId || null,
      query,
      resultsCount,
      locale,
    },
  });
}

/**
 * Get popular/trending search terms.
 */
async function getTrendingSearches(days = 7, limit = 10) {
  if (!hasDatabase) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const results = await prisma.$queryRaw`
    SELECT "query", COUNT(*)::int as search_count, MAX("resultsCount") as max_results
    FROM "SearchLog"
    WHERE "createdAt" >= ${since}
    GROUP BY "query"
    ORDER BY search_count DESC
    LIMIT ${limit}
  `;

  return results;
}

/**
 * Get search suggestions based on partial query (autocomplete).
 */
async function getSuggestions(partial, limit = 8) {
  if (!hasDatabase || !partial || partial.trim().length < 2) return [];

  const pattern = `%${partial.trim()}%`;

  const results = await prisma.$queryRaw`
    SELECT DISTINCT "title", "titleAr"
    FROM "Listing"
    WHERE "status" = 'ACTIVE'
      AND ("title" ILIKE ${pattern} OR "titleAr" ILIKE ${pattern})
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    en: r.title,
    ar: r.titleAr,
  }));
}

module.exports = {
  searchListings,
  logSearch,
  getTrendingSearches,
  getSuggestions,
};
