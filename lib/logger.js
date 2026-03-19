/**
 * Structured logging utility for Whale Marketplace.
 *
 * Outputs JSON in production for log aggregation services,
 * and human-readable colored output in development.
 */

const isProd = process.env.NODE_ENV === 'production';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || (isProd ? 'info' : 'debug')] ?? LOG_LEVELS.info;

const COLORS = {
  error: '\x1b[31m',   // red
  warn: '\x1b[33m',    // yellow
  info: '\x1b[36m',    // cyan
  http: '\x1b[35m',    // magenta
  debug: '\x1b[90m',   // gray
  reset: '\x1b[0m'
};

function formatDev(level, message, meta) {
  const timestamp = new Date().toLocaleTimeString();
  const color = COLORS[level] || COLORS.info;
  const metaStr = meta && Object.keys(meta).length
    ? ` ${JSON.stringify(meta)}`
    : '';
  return `${color}[${timestamp}] ${level.toUpperCase()}${COLORS.reset} ${message}${metaStr}`;
}

function formatProd(level, message, meta) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  });
}

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] > currentLevel) return;

  const formatted = isProd
    ? formatProd(level, message, meta)
    : formatDev(level, message, meta);

  if (level === 'error') {
    process.stderr.write(formatted + '\n');
  } else {
    process.stdout.write(formatted + '\n');
  }
}

const logger = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  http: (message, meta) => log('http', message, meta),
  debug: (message, meta) => log('debug', message, meta),

  /**
   * Express middleware for HTTP request logging.
   * Logs method, path, status code, and response time.
   */
  httpMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      const originalEnd = res.end;
      res.end = function (...args) {
        const duration = Date.now() - start;
        log('http', `${req.method} ${req.originalUrl}`, {
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('user-agent')?.slice(0, 100)
        });
        return originalEnd.apply(this, args);
      };
      next();
    };
  },

  /**
   * Create a child logger with bound context (e.g. requestId, userId).
   */
  child(context = {}) {
    return {
      error: (msg, meta) => log('error', msg, { ...context, ...meta }),
      warn: (msg, meta) => log('warn', msg, { ...context, ...meta }),
      info: (msg, meta) => log('info', msg, { ...context, ...meta }),
      http: (msg, meta) => log('http', msg, { ...context, ...meta }),
      debug: (msg, meta) => log('debug', msg, { ...context, ...meta })
    };
  }
};

module.exports = logger;
