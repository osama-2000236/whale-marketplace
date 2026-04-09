/**
 * Bilingual city names for Palestinian marketplace.
 * Each entry has { en, ar } keys.
 * Use getCityNames(locale) to get a flat array of display names.
 */

const CITIES = [
  { en: 'Gaza', ar: 'غزة' },
  { en: 'Ramallah', ar: 'رام الله' },
  { en: 'Nablus', ar: 'نابلس' },
  { en: 'Hebron', ar: 'الخليل' },
  { en: 'Jenin', ar: 'جنين' },
  { en: 'Jerusalem', ar: 'القدس' },
  { en: 'Bethlehem', ar: 'بيت لحم' },
  { en: 'Tulkarm', ar: 'طولكرم' },
  { en: 'Qalqilya', ar: 'قلقيلية' },
  { en: 'Jericho', ar: 'أريحا' },
  { en: 'Salfit', ar: 'سلفيت' },
  { en: 'Tubas', ar: 'طوباس' },
  { en: 'Khan Yunis', ar: 'خان يونس' },
  { en: 'Rafah', ar: 'رفح' },
  { en: 'Deir al-Balah', ar: 'دير البلح' },
];

/**
 * Get city display names for the given locale.
 * @param {string} locale - 'ar' or 'en'
 * @returns {Array<{value: string, label: string}>} value is always English (for DB storage), label is localized
 */
function getCities(locale = 'ar') {
  return CITIES.map((city) => ({
    value: city.en,
    label: locale === 'ar' ? city.ar : city.en,
  }));
}

/**
 * Get flat array of city names in the given locale.
 * @param {string} locale - 'ar' or 'en'
 * @returns {string[]}
 */
function getCityNames(locale = 'ar') {
  return CITIES.map((city) => (locale === 'ar' ? city.ar : city.en));
}

/**
 * Get the localized name for a city stored in English.
 * @param {string} cityEn - English city name (as stored in DB)
 * @param {string} locale - 'ar' or 'en'
 * @returns {string}
 */
function localizeCityName(cityEn, locale = 'ar') {
  if (locale === 'en') return cityEn;
  const city = CITIES.find((c) => c.en === cityEn);
  return city ? city.ar : cityEn;
}

module.exports = { CITIES, getCities, getCityNames, localizeCityName };
