const { PrismaClient } = require('@prisma/client');

const isProd = process.env.NODE_ENV === 'production';
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: isProd
    ? [{ emit: 'event', level: 'error' }]
    : [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' }
      ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Log errors always
prisma.$on('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('[Prisma Error]', e.message);
});

// Log warnings in all environments
prisma.$on('warn', (e) => {
  // eslint-disable-next-line no-console
  console.warn('[Prisma Warn]', e.message);
});

// Slow query logging middleware (>500ms in dev, >1000ms in prod)
const SLOW_THRESHOLD = isProd ? 1000 : 500;
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = Date.now() - start;
  if (duration > SLOW_THRESHOLD) {
    // eslint-disable-next-line no-console
    console.warn(`[Prisma Slow] ${params.model}.${params.action} took ${duration}ms`);
  }
  return result;
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
module.exports.prisma = prisma;
