'use strict';

const pino = require('pino');

const base = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'http'),
  customLevels: { http: 25 }, // between debug(20) and info(30)
  useOnlyCustomLevels: false,
  ...(process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } } }
    : {}),
});

/**
 * httpMiddleware — Express middleware that logs each request on response finish.
 */
function httpMiddleware() {
  return function (req, res, next) {
    const start = Date.now();
    if (typeof res.on === 'function') {
      res.on('finish', () => {
        base.http({
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          ms: Date.now() - start,
          ip: req.ip,
          ua: req.get('user-agent'),
        });
      });
    }
    next();
  };
}

module.exports = {
  error: base.error.bind(base),
  warn: base.warn.bind(base),
  info: base.info.bind(base),
  http: base.http.bind(base),
  debug: base.debug.bind(base),
  child: (bindings) => {
    const c = base.child(bindings);
    return {
      error: c.error.bind(c),
      warn: c.warn.bind(c),
      info: c.info.bind(c),
      http: c.http.bind(c),
      debug: c.debug.bind(c),
    };
  },
  httpMiddleware,
};
