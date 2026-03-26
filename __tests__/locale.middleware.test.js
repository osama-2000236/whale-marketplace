const { localeMiddleware } = require('../middleware/locale');

function makeRes() {
  return { locals: {} };
}

describe('localeMiddleware', () => {
  test('uses query lang when supported and stores it in session', () => {
    const req = {
      query: { lang: 'en' },
      session: {},
      headers: {},
    };
    const res = makeRes();
    const next = jest.fn();

    localeMiddleware(req, res, next);

    expect(req.locale).toBe('en');
    expect(req.session.locale).toBe('en');
    expect(res.locals.locale).toBe('en');
    expect(res.locals.dir).toBe('ltr');
    expect(res.locals.theme).toBe('light');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('uses session locale when query lang is missing/unsupported', () => {
    const req = {
      query: { lang: 'de' },
      session: { locale: 'ar', theme: 'dark' },
      headers: {},
    };
    const res = makeRes();
    const next = jest.fn();

    localeMiddleware(req, res, next);

    expect(req.locale).toBe('ar');
    expect(res.locals.locale).toBe('ar');
    expect(res.locals.dir).toBe('rtl');
    expect(res.locals.theme).toBe('dark');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('falls back to accept-language and defaults', () => {
    const reqEn = {
      query: {},
      session: null,
      headers: { 'accept-language': 'en-US,en;q=0.9' },
    };
    const resEn = makeRes();
    const nextEn = jest.fn();
    localeMiddleware(reqEn, resEn, nextEn);
    expect(reqEn.locale).toBe('en');

    const reqDefault = {
      query: {},
      session: null,
      headers: { 'accept-language': 'fr-FR,fr;q=0.9' },
    };
    const resDefault = makeRes();
    const nextDefault = jest.fn();
    localeMiddleware(reqDefault, resDefault, nextDefault);
    expect(reqDefault.locale).toBe('ar');
    expect(resDefault.locals.t('nav.login')).toBe('تسجيل الدخول');
  });
});
