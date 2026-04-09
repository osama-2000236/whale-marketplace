const { t } = require('../lib/i18n');

const SUPPORTED_LOCALES = ['ar', 'en'];
const DEFAULT_LOCALE = 'ar';

/**
 * Parse Accept-Language header and find the best matching supported locale.
 * e.g. "ar-PS,ar;q=0.9,en-US;q=0.8,en;q=0.7" → 'ar'
 * e.g. "en-US,en;q=0.9" → 'en'
 * @param {string} header
 * @returns {string|null}
 */
function parseAcceptLanguage(header) {
  if (!header) return null;

  const entries = header
    .split(',')
    .map((part) => {
      const [lang, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1.0;
      return { lang: lang.trim().toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of entries) {
    // Exact match: 'ar', 'en'
    if (SUPPORTED_LOCALES.includes(lang)) return lang;
    // Prefix match: 'ar-PS' → 'ar', 'en-US' → 'en'
    const prefix = lang.split('-')[0];
    if (SUPPORTED_LOCALES.includes(prefix)) return prefix;
  }

  return null;
}

function localeMiddleware(req, res, next) {
  let locale = DEFAULT_LOCALE;

  // Priority: 1. ?lang= query param  2. session  3. Accept-Language  4. default (ar)
  const queryLocale =
    typeof req.query.lang === 'string' && SUPPORTED_LOCALES.includes(req.query.lang)
      ? req.query.lang
      : null;

  if (queryLocale) {
    locale = queryLocale;
    if (req.session) {
      req.session.locale = locale;
      if (typeof req.session.save === 'function') req.session.save(); // Explicit save (BUG-05)
    }
  } else if (req.session && req.session.locale) {
    locale = req.session.locale;
  } else {
    const negotiated = parseAcceptLanguage(req.headers['accept-language']);
    if (negotiated) locale = negotiated;
  }

  req.locale = locale;
  res.locals.locale = locale;
  res.locals.dir = locale === 'ar' ? 'rtl' : 'ltr';
  res.locals.activeLangQuery = queryLocale;
  res.locals.t = (key, vars) => t(key, locale, vars);
  res.locals.theme = (req.session && req.session.theme) || 'light';

  next();
}

module.exports = { localeMiddleware, SUPPORTED_LOCALES, parseAcceptLanguage };
