function parseLimit(limit, fallback = 10, max = 50) {
  const value = Number(limit || fallback);
  if (Number.isNaN(value) || value < 1) return fallback;
  return Math.min(value, max);
}

function createCursorResponse(items, limit) {
  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  return {
    items: sliced,
    pageInfo: {
      hasMore,
      nextCursor
    }
  };
}

function buildCursorPage(items, take) {
  const safeTake = Number(take) > 0 ? Number(take) : 10;
  const hasMore = items.length > safeTake;
  const data = hasMore ? items.slice(0, safeTake) : items;
  const nextCursor = hasMore && data.length ? data[data.length - 1].id : null;

  return {
    data,
    hasMore,
    nextCursor
  };
}

module.exports = {
  parseLimit,
  createCursorResponse,
  buildCursorPage
};
