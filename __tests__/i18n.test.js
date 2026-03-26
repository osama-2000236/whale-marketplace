const { t } = require('../lib/i18n');

describe('i18n translator', () => {
  test('returns Arabic by default', () => {
    expect(t('nav.browse')).toBe('تصفح');
  });

  test('returns English when locale is en', () => {
    expect(t('nav.browse', 'en')).toBe('Browse');
  });

  test('falls back to English when locale key is missing', () => {
    expect(t('nav.browse', 'fr')).toBe('Browse');
  });

  test('returns key when translation entry is missing', () => {
    expect(t('missing.key', 'en')).toBe('missing.key');
  });

  test('interpolates variables in text', () => {
    expect(t('home.hero.title', 'en', { name: 'Whale' })).toBe('Buy and Sell with Confidence');
  });
});
