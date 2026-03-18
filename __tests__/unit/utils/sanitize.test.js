const {
  sanitizeText,
  sanitizeInt,
  sanitizeSlug,
  sanitizePhone,
  isValidEmail,
  sanitizeTags
} = require('../../../utils/sanitize');

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    expect(sanitizeText('hello <script>alert(1)</script> world')).toBe('hello alert(1) world');
    expect(sanitizeText('<b>bold</b>')).toBe('bold');
  });

  it('strips control characters but keeps newlines/tabs', () => {
    expect(sanitizeText('hello\nworld')).toBe('hello\nworld');
    expect(sanitizeText('tab\there')).toBe('tab\there');
    expect(sanitizeText('null\x00byte')).toBe('nullbyte');
  });

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('truncates to maxLen', () => {
    expect(sanitizeText('abcdefgh', 5)).toBe('abcde');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(123)).toBe('');
  });

  it('preserves Arabic text', () => {
    expect(sanitizeText('مرحبا بالعالم')).toBe('مرحبا بالعالم');
  });
});

describe('sanitizeInt', () => {
  it('parses valid integers', () => {
    expect(sanitizeInt('42')).toBe(42);
    expect(sanitizeInt('0')).toBe(0);
  });

  it('clamps to min/max', () => {
    expect(sanitizeInt('5', { min: 10 })).toBe(10);
    expect(sanitizeInt('100', { max: 50 })).toBe(50);
  });

  it('returns defaultVal for NaN', () => {
    expect(sanitizeInt('abc')).toBe(0);
    expect(sanitizeInt('abc', { defaultVal: 1 })).toBe(1);
    expect(sanitizeInt(undefined)).toBe(0);
  });
});

describe('sanitizeSlug', () => {
  it('lowercases and strips non-slug chars', () => {
    expect(sanitizeSlug('Hello-World_123')).toBe('hello-world_123');
    expect(sanitizeSlug('مرحبا')).toBe('');
    expect(sanitizeSlug('a/b?c=d')).toBe('abcd');
  });

  it('truncates to maxLen', () => {
    expect(sanitizeSlug('abcdefgh', 5)).toBe('abcde');
  });
});

describe('sanitizePhone', () => {
  it('keeps digits, +, -, spaces, parens', () => {
    expect(sanitizePhone('+972 50-123-4567')).toBe('+972 50-123-4567');
    expect(sanitizePhone('(050) 1234567')).toBe('(050) 1234567');
  });

  it('strips letters and special chars', () => {
    expect(sanitizePhone('call me: 0501234567!')).toBe('0501234567');
  });
});

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@missing.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

describe('sanitizeTags', () => {
  it('splits by comma and trims', () => {
    expect(sanitizeTags('gpu, gaming, monitor')).toEqual(['gpu', 'gaming', 'monitor']);
  });

  it('filters empty tags', () => {
    expect(sanitizeTags('a,,b,')).toEqual(['a', 'b']);
  });

  it('limits tag count', () => {
    expect(sanitizeTags('a,b,c,d', 2)).toEqual(['a', 'b']);
  });

  it('handles non-string input', () => {
    expect(sanitizeTags(null)).toEqual([]);
    expect(sanitizeTags(123)).toEqual([]);
  });
});
