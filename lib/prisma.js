const { PrismaClient } = require('@prisma/client');

const isProd = process.env.NODE_ENV === 'production';
const globalForPrisma = global;

const SLOW_THRESHOLD = isProd ? 1000 : 500;

const basePrisma = globalForPrisma.prisma || new PrismaClient({
  log: isProd
    ? [{ emit: 'event', level: 'error' }]
    : [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' }
      ],
  ...(process.env.DATABASE_URL
    ? { datasources: { db: { url: process.env.DATABASE_URL } } }
    : {})
});

// Log errors always
basePrisma.$on('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('[Prisma Error]', e.message);
});

// Slow query logging via query events (dev only — query events not emitted in prod config)
if (!isProd) {
  basePrisma.$on('query', (e) => {
    if (e.duration > SLOW_THRESHOLD) {
      // eslint-disable-next-line no-console
      console.warn(`[Prisma Slow] ${e.query.slice(0, 120)}... took ${e.duration}ms`);
    }
  });

  basePrisma.$on('warn', (e) => {
    // eslint-disable-next-line no-console
    console.warn('[Prisma Warn]', e.message);
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

module.exports = basePrisma;
module.exports.prisma = basePrisma;
