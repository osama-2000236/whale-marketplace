const { t } = require('../lib/i18n');

const SUPPORTED_LOCALES = ['ar', 'en'];
const DEFAULT_LOCALE = 'ar';

function localeMiddleware(req, res, next) {
  let locale = DEFAULT_LOCALE;
  const queryLocale =
    typeof req.query.lang === 'string' && SUPPORTED_LOCALES.includes(req.query.lang)
      ? req.query.lang
      : null;

  if (queryLocale) {
    locale = queryLocale;
    if (req.session) req.session.locale = locale;
  } else if (req.session && req.session.locale) {
    locale = req.session.locale;
  } else {
    const acceptLang = req.headers['accept-language'] || '';
    if (acceptLang.startsWith('en')) locale = 'en';
  }

  req.locale = locale;
  res.locals.locale = locale;
  res.locals.dir = locale === 'ar' ? 'rtl' : 'ltr';
  res.locals.activeLangQuery = queryLocale;
  res.locals.t = (key, vars) => t(key, locale, vars);
  res.locals.theme = (req.session && req.session.theme) || 'light';

  next();
}

module.exports = { localeMiddleware, SUPPORTED_LOCALES };
