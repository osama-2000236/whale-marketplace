const PAGE_SIZE = 24;

function cursorPagination(cursor) {
  const pagination = { take: PAGE_SIZE + 1 };
  if (cursor) {
    pagination.cursor = { id: cursor };
    pagination.skip = 1;
  }
  return pagination;
}

function processCursorResults(items) {
  const hasMore = items.length > PAGE_SIZE;
  const sliced = hasMore ? items.slice(0, PAGE_SIZE) : items;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;
  return { items: sliced, nextCursor };
}

module.exports = { cursorPagination, processCursorResults, PAGE_SIZE };
