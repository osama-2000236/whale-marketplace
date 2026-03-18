require('dotenv').config({ path: '.env.test' });
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}

process.env.NODE_ENV = 'test';

beforeAll(() => {
  if (!String(process.env.DATABASE_URL || '').includes('_test')) {
    throw new Error('TEST SAFETY: DATABASE_URL must point to a _test database');
  }
});

afterAll(async () => {
  const prisma = require('./lib/prisma');
  await prisma.$disconnect();
});
