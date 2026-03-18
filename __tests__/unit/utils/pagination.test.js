const { buildCursorPage } = require('../../../utils/pagination');

describe('cursor pagination', () => {
  test('returns hasMore=false when results <= take', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const { data, hasMore } = buildCursorPage(items, 5);
    expect(hasMore).toBe(false);
    expect(data.length).toBe(2);
  });

  test('returns hasMore=true when results > take', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const { data, hasMore, nextCursor } = buildCursorPage(items, 2);
    expect(hasMore).toBe(true);
    expect(data.length).toBe(2);
    expect(nextCursor).toBe('2');
  });

  test('handles empty results', () => {
    const { data, hasMore } = buildCursorPage([], 10);
    expect(data).toEqual([]);
    expect(hasMore).toBe(false);
  });
});
