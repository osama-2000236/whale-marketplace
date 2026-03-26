const { strip, truncate, sanitizeBody } = require('../utils/sanitize');

describe('sanitize utils', () => {
  test('strip removes HTML and trims whitespace', () => {
    expect(strip('  <b>Hello</b> <i>World</i>  ')).toBe('Hello World');
  });

  test('strip returns empty string for non-string values', () => {
    expect(strip(null)).toBe('');
    expect(strip(123)).toBe('');
  });

  test('truncate shortens when over max length', () => {
    expect(truncate('abcdef', 3)).toBe('abc');
  });

  test('truncate keeps string when within max length', () => {
    expect(truncate('abc', 5)).toBe('abc');
  });

  test('truncate returns empty string for non-string values', () => {
    expect(truncate(undefined, 5)).toBe('');
  });

  test('sanitizeBody applies schema, strips HTML, truncates, and keeps primitive values', () => {
    const schema = { title: 5, active: 10, price: 10, metadata: 10 };
    const body = {
      title: '<p>abcdef</p>',
      active: true,
      price: 42,
      metadata: { ok: true },
      ignored: 'x',
      nilValue: null,
    };

    expect(sanitizeBody(body, schema)).toEqual({
      title: 'abcde',
      active: true,
      price: 42,
      metadata: { ok: true },
    });
  });

  test('sanitizeBody ignores undefined/null schema keys', () => {
    const schema = { a: 10, b: 10 };
    const body = { a: undefined, b: null };
    expect(sanitizeBody(body, schema)).toEqual({});
  });
});
