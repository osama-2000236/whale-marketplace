const path = require('path');
const fs = require('fs');

// ── Load locale files ──────────────────────────────────────────────────────
const LOCALES_DIR = path.join(__dirname, '..', 'locales');

function loadLocale(locale) {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

const locales = {
  ar: loadLocale('ar'),
  en: loadLocale('en'),
};

// Legacy compat: the old `translations` export was an object of { key: { ar, en } }.
// Reconstruct it from the loaded JSON files so existing tests/imports keep working.
const translations = {};
const allKeys = new Set([...Object.keys(locales.ar), ...Object.keys(locales.en)]);
for (const key of allKeys) {
  translations[key] = {
    ar: locales.ar[key] || locales.en[key] || key,
    en: locales.en[key] || key,
  };
}

// ── Arabic plural rules (CLDR) ─────────────────────────────────────────────
// Arabic has 6 plural forms:
//   zero  → n == 0
//   one   → n == 1
//   two   → n == 2
//   few   → n % 100 in 3..10
//   many  → n % 100 in 11..99
//   other → everything else (including 100, 200, etc.)
function getArabicPluralForm(n) {
  const absN = Math.abs(n);
  if (absN === 0) return 'zero';
  if (absN === 1) return 'one';
  if (absN === 2) return 'two';
  const mod100 = absN % 100;
  if (mod100 >= 3 && mod100 <= 10) return 'few';
  if (mod100 >= 11 && mod100 <= 99) return 'many';
  return 'other';
}

function getEnglishPluralForm(n) {
  const absN = Math.abs(n);
  if (absN === 0) return 'zero';
  if (absN === 1) return 'one';
  return 'other';
}

/**
 * Get the plural form key for a count in the given locale.
 * @param {string} baseKey - e.g. 'items'
 * @param {number} count
 * @param {string} locale - 'ar' or 'en'
 * @returns {string} - The resolved plural form key, e.g. 'items.few'
 */
function getPluralKey(baseKey, count, locale) {
  const form = locale === 'ar' ? getArabicPluralForm(count) : getEnglishPluralForm(count);
  const key = `${baseKey}.${form}`;
  // Fall back to .other if the specific form doesn't exist
  if (locales[locale]?.[key]) return key;
  return `${baseKey}.other`;
}

/**
 * Translate a key to the given locale with optional interpolation.
 *
 * Simple:      t('nav.browse', 'ar')             → 'تصفح'
 * Interpolate: t('flash.welcome', 'ar', { name }) → 'مرحباً {name}'
 * Plural:      t('items', 'ar', { count: 5 })    → '5 عناصر' (auto-picks items.few)
 *
 * @param {string} key - Translation key (e.g. 'nav.browse')
 * @param {string} [locale='ar'] - 'ar' or 'en'
 * @param {object} [vars={}] - Interpolation variables. If `count` is present and key has
 *                              plural forms (.zero/.one/.two/.few/.many/.other), the
 *                              correct plural form is selected automatically.
 * @returns {string}
 */
function t(key, locale = 'ar', vars = {}) {
  let resolvedKey = key;

  // Auto-select plural form when `count` is provided
  if (typeof vars.count === 'number') {
    const pluralKey = getPluralKey(key, vars.count, locale);
    if (locales[locale]?.[pluralKey] || locales.en?.[pluralKey]) {
      resolvedKey = pluralKey;
    }
  }

  const dict = locales[locale] || locales.en;
  let text = dict?.[resolvedKey] || locales.en?.[resolvedKey] || resolvedKey;

  // Interpolate {varName} placeholders
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }

  return text;
}

/**
 * Reload locale files from disk. Useful in development when editing JSON files.
 */
function reloadLocales() {
  locales.ar = loadLocale('ar');
  locales.en = loadLocale('en');
  // Rebuild translations compat object
  const keys = new Set([...Object.keys(locales.ar), ...Object.keys(locales.en)]);
  for (const key of keys) {
    translations[key] = {
      ar: locales.ar[key] || locales.en[key] || key,
      en: locales.en[key] || key,
    };
  }
}

module.exports = {
  t,
  translations,
  locales,
  getPluralKey,
  getArabicPluralForm,
  getEnglishPluralForm,
  reloadLocales,
};
