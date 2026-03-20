function parseLimit(limit, fallback = 10, max = 50) {
  const n = parseInt(limit, 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(n, max);
}

function createCursorResponse(items, limit) {
  const hasMore = items.length > limit;
  const trimmed = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1].id : null;
  return { items: trimmed, hasMore, nextCursor };
}

function buildCursorPage(items, take) {
  const hasMore = items.length > take;
  const trimmed = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1].id : null;
  return { data: trimmed, hasMore, nextCursor };
}

module.exports = { parseLimit, createCursorResponse, buildCursorPage };
