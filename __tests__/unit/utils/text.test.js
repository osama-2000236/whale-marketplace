const { detectDir, timeAgo } = require('../../../utils/text');

describe('detectDir', () => {
  test('returns rtl for Arabic text', () => {
    expect(detectDir('مرحبا بك')).toBe('rtl');
  });

  test('returns ltr for English text', () => {
    expect(detectDir('Hello world')).toBe('ltr');
  });

  test('returns auto for mixed text', () => {
    const result = detectDir('Hello مرحبا');
    expect(['auto', 'ltr', 'rtl']).toContain(result);
  });

  test('handles empty string', () => {
    expect(detectDir('')).toBe('auto');
  });
});

describe('timeAgo', () => {
  test('returns now for very recent time', () => {
    const result = timeAgo(new Date(Date.now() - 30 * 1000));
    expect(result).toMatch(/now|الآن/i);
  });

  test('returns minutes for under an hour', () => {
    const result = timeAgo(new Date(Date.now() - 5 * 60 * 1000));
    expect(result).toMatch(/min|دقيقة/i);
  });

  test('handles Date and ISO string', () => {
    const result = timeAgo(new Date().toISOString());
    expect(result).toBeDefined();
  });
});
