const { t } = require('../lib/i18n');
const { getCityOptions, getCityName } = require('../lib/cities');

module.exports = function locale(req, res, next) {
  const defaultLang = process.env.DEFAULT_LANG === 'en' ? 'en' : 'ar';
  const defaultTheme = process.env.DEFAULT_THEME === 'dark' ? 'dark' : 'light';

  const lang = req.session?.lang || defaultLang;
  const theme = req.session?.theme || defaultTheme;

  res.locals.lang = ['ar', 'en'].includes(lang) ? lang : defaultLang;
  res.locals.dir = res.locals.lang === 'ar' ? 'rtl' : 'ltr';
  res.locals.theme = ['light', 'dark'].includes(theme) ? theme : defaultTheme;
  res.locals.t = (key, vars) => t(key, res.locals.lang, vars);
  res.locals.cities = getCityOptions(res.locals.lang);
  res.locals.path = req.path;
  res.locals.bodyClass = `whale-site lang-${res.locals.lang} theme-${res.locals.theme}`;

  const cart = Array.isArray(req.session?.cart) ? req.session.cart : [];
  res.locals.cartCount = cart.length;

  // Helper functions for templates
  res.locals.getCityName = (idOrValue, l) => getCityName(idOrValue, l || res.locals.lang);

  // Compatibility aliases
  res.locals.user = req.user || res.locals.currentUser || null;
  res.locals.unreadCount = res.locals.unreadNotificationsCount || 0;

  next();
};
