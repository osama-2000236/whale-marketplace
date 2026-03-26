const { t } = require('../lib/i18n');

const SUPPORTED_LOCALES = ['ar', 'en'];
const DEFAULT_LOCALE = 'ar';

function localeMiddleware(req, res, next) {
  let locale = DEFAULT_LOCALE;

  if (req.query.lang && SUPPORTED_LOCALES.includes(req.query.lang)) {
    locale = req.query.lang;
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
  res.locals.t = (key, vars) => t(key, locale, vars);
  res.locals.theme = (req.session && req.session.theme) || 'light';

  next();
}

module.exports = { localeMiddleware, SUPPORTED_LOCALES };
