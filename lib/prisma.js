const { PrismaClient } = require('@prisma/client');

const isProd = process.env.NODE_ENV === 'production';
const globalForPrisma = global;
const SLOW_THRESHOLD = isProd ? 1000 : 500;

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: isProd
      ? [{ emit: 'event', level: 'error' }]
      : [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

basePrisma.$on('error', (e) => console.error('[Prisma Error]', e.message));

if (!isProd) {
  basePrisma.$on('query', (e) => {
    if (e.duration > SLOW_THRESHOLD) {
      console.warn(`[Prisma Slow] ${e.query.slice(0, 120)}... took ${e.duration}ms`);
    }
  });
  basePrisma.$on('warn', (e) => console.warn('[Prisma Warn]', e.message));
}

if (!isProd) globalForPrisma.prisma = basePrisma;

module.exports = basePrisma;
module.exports.prisma = basePrisma;
