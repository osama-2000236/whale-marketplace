require('dotenv').config({ path: '.env.test' });
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}

process.env.NODE_ENV = 'test';

// Check if database is reachable
let dbAvailable = false;

beforeAll(async () => {
  if (!String(process.env.DATABASE_URL || '').includes('_test')) {
    console.warn('TEST SAFETY: DATABASE_URL must point to a _test database. Skipping DB-dependent tests.');
    return;
  }
  try {
    const prisma = require('./lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn('Database not reachable. DB-dependent tests will be skipped.');
  }
});

afterAll(async () => {
  try {
    const prisma = require('./lib/prisma');
    await prisma.$disconnect();
  } catch {
    // ignore disconnect errors when DB is not available
  }
});

global.isDbAvailable = () => dbAvailable;
