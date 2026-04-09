const { t, translations, getArabicPluralForm, getPluralKey } = require('../lib/i18n');
const { parseAcceptLanguage } = require('../middleware/locale');
const { getCities, localizeCityName } = require('../lib/cities');

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

  test('translations compat object has ar and en for known keys', () => {
    expect(translations['nav.browse']).toEqual({ ar: 'تصفح', en: 'Browse' });
  });
});

describe('Arabic plural forms (CLDR)', () => {
  test('zero → 0', () => expect(getArabicPluralForm(0)).toBe('zero'));
  test('one → 1', () => expect(getArabicPluralForm(1)).toBe('one'));
  test('two → 2', () => expect(getArabicPluralForm(2)).toBe('two'));
  test('few → 3-10', () => {
    expect(getArabicPluralForm(3)).toBe('few');
    expect(getArabicPluralForm(10)).toBe('few');
    expect(getArabicPluralForm(105)).toBe('few');
  });
  test('many → 11-99 mod 100', () => {
    expect(getArabicPluralForm(11)).toBe('many');
    expect(getArabicPluralForm(99)).toBe('many');
    expect(getArabicPluralForm(25)).toBe('many');
  });
  test('other → 100, 200, 1000', () => {
    expect(getArabicPluralForm(100)).toBe('other');
    expect(getArabicPluralForm(200)).toBe('other');
    expect(getArabicPluralForm(1000)).toBe('other');
  });
});

describe('plural translation', () => {
  test('Arabic: 0 items → zero form', () => {
    expect(t('items', 'ar', { count: 0 })).toBe('لا عناصر');
  });
  test('Arabic: 1 item → one form', () => {
    expect(t('items', 'ar', { count: 1 })).toBe('عنصر واحد');
  });
  test('Arabic: 2 items → two form', () => {
    expect(t('items', 'ar', { count: 2 })).toBe('عنصران');
  });
  test('Arabic: 5 items → few form with interpolation', () => {
    expect(t('items', 'ar', { count: 5 })).toBe('5 عناصر');
  });
  test('Arabic: 25 items → many form', () => {
    expect(t('items', 'ar', { count: 25 })).toBe('25 عنصراً');
  });
  test('Arabic: 100 items → other form', () => {
    expect(t('items', 'ar', { count: 100 })).toBe('100 عنصر');
  });
  test('English: 0 items → zero form', () => {
    expect(t('items', 'en', { count: 0 })).toBe('No items');
  });
  test('English: 1 item → one form', () => {
    expect(t('items', 'en', { count: 1 })).toBe('1 item');
  });
  test('English: 5 items → other form', () => {
    expect(t('items', 'en', { count: 5 })).toBe('5 items');
  });
  test('orders plural works', () => {
    expect(t('orders', 'ar', { count: 3 })).toBe('3 طلبات');
    expect(t('orders', 'en', { count: 1 })).toBe('1 order');
  });
});

describe('Accept-Language parsing', () => {
  test('parses Arabic Palestinian header', () => {
    expect(parseAcceptLanguage('ar-PS,ar;q=0.9,en-US;q=0.8,en;q=0.7')).toBe('ar');
  });
  test('parses English US header', () => {
    expect(parseAcceptLanguage('en-US,en;q=0.9')).toBe('en');
  });
  test('returns null for unsupported languages', () => {
    expect(parseAcceptLanguage('fr-FR,fr;q=0.9,de;q=0.8')).toBeNull();
  });
  test('returns null for empty header', () => {
    expect(parseAcceptLanguage('')).toBeNull();
    expect(parseAcceptLanguage(null)).toBeNull();
  });
  test('prefers highest quality match', () => {
    expect(parseAcceptLanguage('fr;q=1.0,en;q=0.9,ar;q=0.8')).toBe('en');
  });
});

describe('Bilingual cities', () => {
  test('getCities returns value/label objects', () => {
    const arCities = getCities('ar');
    expect(arCities[0]).toEqual({ value: 'Gaza', label: 'غزة' });
    const enCities = getCities('en');
    expect(enCities[0]).toEqual({ value: 'Gaza', label: 'Gaza' });
  });
  test('localizeCityName translates English to Arabic', () => {
    expect(localizeCityName('Ramallah', 'ar')).toBe('رام الله');
    expect(localizeCityName('Jerusalem', 'ar')).toBe('القدس');
    expect(localizeCityName('Hebron', 'en')).toBe('Hebron');
  });
  test('localizeCityName returns original for unknown city', () => {
    expect(localizeCityName('Tel Aviv', 'ar')).toBe('Tel Aviv');
  });
  test('getCities includes all major Palestinian cities', () => {
    const names = getCities('en').map((c) => c.value);
    expect(names).toContain('Gaza');
    expect(names).toContain('Ramallah');
    expect(names).toContain('Jerusalem');
    expect(names).toContain('Khan Yunis');
    expect(names).toContain('Rafah');
    expect(names).toContain('Bethlehem');
  });
});
