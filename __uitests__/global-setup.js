const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

module.exports = async () => {
  const prisma = new PrismaClient();

  try {
    const passwordHash = await bcrypt.hash('uitestpass', 10);

    const proUser = await prisma.user.upsert({
      where: { username: 'uitest_pro' },
      update: {
        email: 'uitest_pro@whale.ps',
        passwordHash,
        isBanned: false
      },
      create: {
        username: 'uitest_pro',
        email: 'uitest_pro@whale.ps',
        passwordHash
      }
    });

    const freeUser = await prisma.user.upsert({
      where: { username: 'uitest_free' },
      update: {
        email: 'uitest_free@whale.ps',
        passwordHash,
        isBanned: false
      },
      create: {
        username: 'uitest_free',
        email: 'uitest_free@whale.ps',
        passwordHash
      }
    });

    await prisma.subscription.upsert({
      where: { userId: proUser.id },
      update: {
        plan: 'pro',
        trialEndsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        paidUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
      },
      create: {
        userId: proUser.id,
        plan: 'pro',
        trialEndsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        paidUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
      }
    });

    await prisma.subscription.upsert({
      where: { userId: freeUser.id },
      update: { plan: 'free', trialEndsAt: null, paidUntil: null },
      create: {
        userId: freeUser.id,
        plan: 'free'
      }
    });

    await prisma.sellerProfile.upsert({
      where: { userId: proUser.id },
      update: {
        displayName: 'UI Test Seller',
        city: 'Tulkarem',
        responseTimeHours: 1,
        totalSales: 12,
        totalRevenue: 8200,
        averageRating: 4.8,
        reviewCount: 8,
        isVerified: true,
        verifiedAt: new Date()
      },
      create: {
        userId: proUser.id,
        displayName: 'UI Test Seller',
        city: 'Tulkarem',
        responseTimeHours: 1,
        totalSales: 12,
        totalRevenue: 8200,
        averageRating: 4.8,
        reviewCount: 8,
        isVerified: true,
        verifiedAt: new Date()
      }
    });

    const category = await prisma.marketCategory.upsert({
      where: { slug: 'pc-parts' },
      update: {
        name: 'PC Parts',
        nameAr: 'قطع الحاسوب',
        icon: '🖥️',
        order: 2
      },
      create: {
        name: 'PC Parts',
        nameAr: 'قطع الحاسوب',
        slug: 'pc-parts',
        icon: '🖥️',
        order: 2
      }
    });

    const cities = ['Tulkarem', 'Ramallah', 'Nablus', 'Hebron', 'Jenin'];
    const shippingNames = ['Flash Delivery', 'Palestine Post'];
    for (const name of shippingNames) {
      const existing = await prisma.shippingCompany.findFirst({ where: { name } });
      if (!existing) {
        await prisma.shippingCompany.create({
          data: {
            name,
            nameAr: name === 'Flash Delivery' ? 'فلاش للتوصيل' : 'بريد فلسطين',
            basePrice: name === 'Flash Delivery' ? 20 : 15,
            estimatedDays: name === 'Flash Delivery' ? 1 : 3,
            cities,
            isActive: true
          }
        });
      }
    }

    const existingListings = await prisma.marketListing.findMany({
      where: { sellerId: proUser.id, title: { startsWith: 'UITEST' } },
      select: { id: true }
    });

    if (existingListings.length < 3) {
      await prisma.marketListing.createMany({
        data: [
          {
            title: 'UITEST RTX 3060 Ti',
            description: 'UI test listing for Whale marketplace cards',
            price: 850,
            condition: 'USED',
            images: ['/images/products/placeholder.svg'],
            sellerId: proUser.id,
            categoryId: category.id,
            city: 'Tulkarem',
            status: 'ACTIVE',
            tags: ['gpu', 'gaming'],
            quantity: 2
          },
          {
            title: 'UITEST Logitech Keyboard',
            description: 'UI test keyboard listing',
            price: 320,
            condition: 'LIKE_NEW',
            images: ['/images/products/placeholder.svg'],
            sellerId: proUser.id,
            categoryId: category.id,
            city: 'Ramallah',
            status: 'ACTIVE',
            tags: ['keyboard'],
            quantity: 5
          },
          {
            title: 'UITEST Samsung Phone',
            description: 'UI test phone listing',
            price: 1200,
            condition: 'GOOD',
            images: ['/images/products/placeholder.svg'],
            sellerId: proUser.id,
            categoryId: category.id,
            city: 'Nablus',
            status: 'ACTIVE',
            tags: ['phone'],
            quantity: 1
          }
        ],
        skipDuplicates: false
      });
    }

    const firstListing = await prisma.marketListing.findFirst({
      where: { sellerId: proUser.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (firstListing) {
      const year = new Date().getFullYear();
      const orderNumber = `WH-${year}-12345`;
      const existingOrder = await prisma.order.findUnique({ where: { orderNumber } });
      if (!existingOrder) {
        await prisma.order.create({
          data: {
            orderNumber,
            listingId: firstListing.id,
            buyerId: freeUser.id,
            sellerId: proUser.id,
            quantity: 1,
            amount: firstListing.price,
            paymentMethod: 'cod',
            paymentStatus: 'pending',
            orderStatus: 'PENDING'
          }
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
};

