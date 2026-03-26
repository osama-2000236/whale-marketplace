const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
}

async function main() {
  let ok = true;

  const [categoryCount, listingCount, userCount] = await Promise.all([
    prisma.category.count(),
    prisma.listing.count(),
    prisma.user.count(),
  ]);

  if (categoryCount < 6) {
    console.error(`[validate-seed] Expected >= 6 categories, got ${categoryCount}`);
    ok = false;
  }

  if (listingCount < 10) {
    console.error(`[validate-seed] Expected >= 10 listings, got ${listingCount}`);
    ok = false;
  }

  if (userCount < 2) {
    console.error(`[validate-seed] Expected >= 2 users, got ${userCount}`);
    ok = false;
  }

  const [adminUser, demoSeller] = await Promise.all([
    prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, username: true } }),
    prisma.user.findUnique({ where: { username: 'demo_seller' }, select: { id: true } }),
  ]);

  if (!adminUser) {
    console.error('[validate-seed] Missing ADMIN user');
    ok = false;
  }

  if (!demoSeller) {
    console.error('[validate-seed] Missing demo seller user (username: demo_seller)');
    ok = false;
  }

  const [categories, listings] = await Promise.all([
    prisma.category.findMany({ select: { id: true } }),
    prisma.listing.findMany({
      select: { id: true, title: true, price: true, images: true, categoryId: true },
    }),
  ]);

  const categoryIds = new Set(categories.map((c) => c.id));
  for (const listing of listings) {
    if (!listing.title || !listing.title.trim()) {
      console.error(`[validate-seed] Listing ${listing.id} is missing title`);
      ok = false;
    }

    const price = toNumber(listing.price);
    if (!Number.isFinite(price) || price <= 0) {
      console.error(`[validate-seed] Listing ${listing.id} has invalid price: ${listing.price}`);
      ok = false;
    }

    if (!Array.isArray(listing.images) || listing.images.length < 1) {
      console.error(`[validate-seed] Listing ${listing.id} has no images`);
      ok = false;
    }

    if (!listing.categoryId || !categoryIds.has(listing.categoryId)) {
      console.error(`[validate-seed] Listing ${listing.id} has invalid categoryId`);
      ok = false;
    }
  }

  if (!ok) {
    process.exitCode = 1;
    console.error('[validate-seed] Seed validation failed');
    return;
  }

  console.log('[validate-seed] Seed validation passed');
  process.exitCode = 0;
}

main()
  .catch((err) => {
    process.exitCode = 1;
    console.error('[validate-seed] Unexpected error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
