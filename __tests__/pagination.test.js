const { cursorPagination, processCursorResults, PAGE_SIZE } = require('../utils/pagination');

describe('pagination utils', () => {
  test('cursorPagination returns take+1 without cursor', () => {
    expect(cursorPagination()).toEqual({ take: PAGE_SIZE + 1 });
  });

  test('cursorPagination includes cursor and skip when cursor exists', () => {
    expect(cursorPagination('abc123')).toEqual({
      take: PAGE_SIZE + 1,
      cursor: { id: 'abc123' },
      skip: 1,
    });
  });

  test('processCursorResults returns all items and null nextCursor when hasMore is false', () => {
    const items = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `id-${i}` }));
    expect(processCursorResults(items)).toEqual({ items, nextCursor: null });
  });

  test('processCursorResults slices and sets nextCursor when hasMore is true', () => {
    const items = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({ id: `id-${i}` }));
    const result = processCursorResults(items);

    expect(result.items).toHaveLength(PAGE_SIZE);
    expect(result.nextCursor).toBe(`id-${PAGE_SIZE - 1}`);
  });
});
