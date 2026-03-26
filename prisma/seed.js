const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const slugify = require('slugify');

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] Starting...');

  // Clean existing data
  await prisma.orderEvent.deleteMany();
  await prisma.review.deleteMany();
  await prisma.savedListing.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash('Admin1234!', 12);
  const demoHash = await bcrypt.hash('Demo1234!', 12);

  // --- Users ---
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      slug: 'admin',
      email: 'admin@whale.ps',
      passwordHash: hash,
      role: 'ADMIN',
      isVerified: true,
      subscription: { create: { plan: 'pro', paidUntil: new Date('2030-01-01') } },
      sellerProfile: { create: { displayName: 'Admin', city: 'Ramallah', isVerified: true } },
    },
  });

  const seller = await prisma.user.create({
    data: {
      username: 'demo_seller',
      slug: 'demo-seller',
      email: 'seller@whale.ps',
      passwordHash: demoHash,
      isVerified: true,
      subscription: { create: { plan: 'pro', paidUntil: new Date('2030-01-01') } },
      sellerProfile: {
        create: {
          displayName: 'Whale Demo Store',
          bio: 'Demo seller account',
          bioAr: 'حساب بائع تجريبي',
          city: 'Gaza',
          whatsapp: '+970599000000',
          isVerified: true,
        },
      },
    },
  });

  const buyer = await prisma.user.create({
    data: {
      username: 'demo_buyer',
      slug: 'demo-buyer',
      email: 'buyer@whale.ps',
      passwordHash: demoHash,
      subscription: {
        create: { plan: 'free', trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      sellerProfile: { create: { displayName: 'Demo Buyer' } },
    },
  });

  console.log('[seed] Users created');

  // --- Categories ---
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Electronics',
        nameAr: 'إلكترونيات',
        slug: 'electronics',
        icon: '💻',
        order: 1,
      },
    }),
    prisma.category.create({
      data: { name: 'Vehicles', nameAr: 'سيارات', slug: 'vehicles', icon: '🚗', order: 2 },
    }),
    prisma.category.create({
      data: { name: 'Real Estate', nameAr: 'عقارات', slug: 'real-estate', icon: '🏠', order: 3 },
    }),
    prisma.category.create({
      data: { name: 'Fashion', nameAr: 'أزياء', slug: 'fashion', icon: '👗', order: 4 },
    }),
    prisma.category.create({
      data: {
        name: 'Home & Garden',
        nameAr: 'منزل وحديقة',
        slug: 'home-garden',
        icon: '🏡',
        order: 5,
      },
    }),
    prisma.category.create({
      data: { name: 'Sports', nameAr: 'رياضة', slug: 'sports', icon: '⚽', order: 6 },
    }),
  ]);

  console.log('[seed] Categories created');

  // --- Subcategories ---
  const subcats = await Promise.all([
    prisma.subcategory.create({
      data: {
        name: 'Phones',
        nameAr: 'هواتف',
        slug: 'phones',
        categoryId: categories[0].id,
        order: 1,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: 'Laptops',
        nameAr: 'أجهزة لابتوب',
        slug: 'laptops',
        categoryId: categories[0].id,
        order: 2,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: 'Cars',
        nameAr: 'سيارات',
        slug: 'cars',
        categoryId: categories[1].id,
        order: 1,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: 'Apartments',
        nameAr: 'شقق',
        slug: 'apartments',
        categoryId: categories[2].id,
        order: 1,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: "Men's Clothing",
        nameAr: 'ملابس رجالية',
        slug: 'mens-clothing',
        categoryId: categories[3].id,
        order: 1,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: "Women's Clothing",
        nameAr: 'ملابس نسائية',
        slug: 'womens-clothing',
        categoryId: categories[3].id,
        order: 2,
      },
    }),
  ]);

  console.log('[seed] Subcategories created');

  // --- Listings ---
  const cities = ['Gaza', 'Ramallah', 'Nablus', 'Hebron', 'Jenin', 'Jerusalem'];
  const conditions = ['NEW', 'LIKE_NEW', 'GOOD', 'USED'];

  const listingData = [
    {
      title: 'iPhone 15 Pro Max',
      titleAr: 'آيفون 15 برو ماكس',
      description: 'Brand new iPhone 15 Pro Max, 256GB, factory sealed.',
      descriptionAr: 'آيفون 15 برو ماكس جديد، 256 جيجا، مغلف من المصنع.',
      price: 1200,
      categoryId: categories[0].id,
      subcategoryId: subcats[0].id,
      city: 'Gaza',
      condition: 'NEW',
      tags: ['iphone', 'apple', 'phone'],
    },
    {
      title: 'MacBook Air M2',
      titleAr: 'ماك بوك اير M2',
      description: 'MacBook Air M2, 8GB RAM, 256GB SSD. Used for 3 months.',
      descriptionAr: 'ماك بوك اير M2، 8 جيجا رام، 256 جيجا. مستخدم 3 أشهر.',
      price: 900,
      categoryId: categories[0].id,
      subcategoryId: subcats[1].id,
      city: 'Ramallah',
      condition: 'LIKE_NEW',
      tags: ['macbook', 'apple', 'laptop'],
    },
    {
      title: 'Samsung Galaxy S24',
      titleAr: 'سامسونج جالاكسي S24',
      description: 'Samsung Galaxy S24, excellent condition, with box and accessories.',
      descriptionAr: 'سامسونج جالاكسي S24، حالة ممتازة، مع العلبة والملحقات.',
      price: 650,
      categoryId: categories[0].id,
      subcategoryId: subcats[0].id,
      city: 'Nablus',
      condition: 'GOOD',
      tags: ['samsung', 'galaxy', 'phone'],
    },
    {
      title: 'Toyota Corolla 2020',
      titleAr: 'تويوتا كورولا 2020',
      description: '2020 Toyota Corolla, 45,000 km, automatic, full options.',
      descriptionAr: 'تويوتا كورولا 2020، 45 ألف كم، أوتوماتيك، فل أوبشن.',
      price: 18000,
      categoryId: categories[1].id,
      subcategoryId: subcats[2].id,
      city: 'Hebron',
      condition: 'GOOD',
      tags: ['toyota', 'car', 'corolla'],
    },
    {
      title: 'Apartment for Sale in Ramallah',
      titleAr: 'شقة للبيع في رام الله',
      description: '3-bedroom apartment, 150 sqm, central location, newly renovated.',
      descriptionAr: 'شقة 3 غرف نوم، 150 متر مربع، موقع مركزي، مجددة حديثاً.',
      price: 95000,
      categoryId: categories[2].id,
      subcategoryId: subcats[3].id,
      city: 'Ramallah',
      condition: 'GOOD',
      tags: ['apartment', 'sale', 'ramallah'],
    },
    {
      title: 'Nike Air Jordan 1',
      titleAr: 'نايكي اير جوردان 1',
      description: 'Nike Air Jordan 1 Retro High OG, size 43, brand new with tags.',
      descriptionAr: 'نايكي اير جوردان 1 ريترو هاي، مقاس 43، جديد مع التاغز.',
      price: 180,
      categoryId: categories[3].id,
      subcategoryId: subcats[4].id,
      city: 'Jerusalem',
      condition: 'NEW',
      tags: ['nike', 'jordan', 'shoes'],
    },
    {
      title: 'PlayStation 5 Bundle',
      titleAr: 'بلايستيشن 5 مع ملحقات',
      description: 'PS5 disc edition with 2 controllers and 5 games.',
      descriptionAr: 'بلايستيشن 5 نسخة القرص مع 2 يد تحكم و5 ألعاب.',
      price: 450,
      categoryId: categories[0].id,
      city: 'Gaza',
      condition: 'LIKE_NEW',
      tags: ['ps5', 'playstation', 'gaming'],
    },
    {
      title: 'IKEA Living Room Set',
      titleAr: 'طقم غرفة معيشة ايكيا',
      description: 'Complete living room set: sofa, coffee table, TV stand. Like new.',
      descriptionAr: 'طقم غرفة معيشة كامل: كنبة، طاولة قهوة، طاولة تلفزيون. شبه جديد.',
      price: 800,
      categoryId: categories[4].id,
      city: 'Jenin',
      condition: 'LIKE_NEW',
      tags: ['ikea', 'furniture', 'living-room'],
    },
    {
      title: 'Mountain Bike Trek',
      titleAr: 'دراجة جبلية Trek',
      description: 'Trek Marlin 7, 29 inch, Shimano gears, front suspension.',
      descriptionAr: 'تريك مارلن 7، 29 إنش، غيارات شيمانو، تعليق أمامي.',
      price: 350,
      categoryId: categories[5].id,
      city: 'Nablus',
      condition: 'USED',
      tags: ['bike', 'trek', 'mountain'],
    },
    {
      title: 'Wedding Dress',
      titleAr: 'فستان زفاف',
      description: 'Beautiful wedding dress, size M, worn once, professionally cleaned.',
      descriptionAr: 'فستان زفاف جميل، مقاس M، مرتدى مرة واحدة، منظف مهنياً.',
      price: 400,
      categoryId: categories[3].id,
      subcategoryId: subcats[5].id,
      city: 'Hebron',
      condition: 'LIKE_NEW',
      tags: ['wedding', 'dress', 'fashion'],
    },
    {
      title: 'Hyundai Tucson 2019',
      titleAr: 'هيونداي توسان 2019',
      description: '2019 Hyundai Tucson, 60,000 km, excellent condition, negotiable.',
      descriptionAr: 'هيونداي توسان 2019، 60 ألف كم، حالة ممتازة، قابل للتفاوض.',
      price: 22000,
      categoryId: categories[1].id,
      subcategoryId: subcats[2].id,
      city: 'Gaza',
      condition: 'GOOD',
      negotiable: true,
      tags: ['hyundai', 'tucson', 'car'],
    },
    {
      title: 'Gym Equipment Set',
      titleAr: 'مجموعة معدات رياضية',
      description: 'Complete home gym: bench press, dumbbells, barbell, weight plates.',
      descriptionAr: 'صالة رياضية منزلية كاملة: بنش برس، دمبلز، بار، أوزان.',
      price: 600,
      categoryId: categories[5].id,
      city: 'Jerusalem',
      condition: 'USED',
      tags: ['gym', 'fitness', 'equipment'],
    },
  ];

  const listings = [];
  for (const data of listingData) {
    const slug =
      slugify(data.title, { lower: true, strict: true }) +
      '-' +
      Math.random().toString(36).slice(2, 7);
    const listing = await prisma.listing.create({
      data: {
        slug,
        title: data.title,
        titleAr: data.titleAr,
        description: data.description,
        descriptionAr: data.descriptionAr,
        price: data.price,
        negotiable: data.negotiable || false,
        condition: data.condition,
        images: ['/uploads/placeholder.jpg'],
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId || null,
        city: data.city,
        sellerId: seller.id,
        status: 'ACTIVE',
        tags: data.tags || [],
        views: Math.floor(Math.random() * 200),
      },
    });
    listings.push(listing);
  }

  console.log('[seed] Listings created');

  // --- Orders ---
  const order1 = await prisma.order.create({
    data: {
      listingId: listings[0].id,
      buyerId: buyer.id,
      sellerId: seller.id,
      amount: listings[0].price,
      paymentMethod: 'manual',
      status: 'COMPLETED',
      paymentStatus: 'completed',
      shippingAddress: { street: 'شارع الجلاء', city: 'Gaza', phone: '+970599111111' },
      trackingNumber: 'TRK-001',
      shippingCompany: 'Palestine Post',
      events: {
        create: [
          { event: 'created', actorId: buyer.id, note: 'Order placed' },
          { event: 'confirmed', actorId: seller.id, note: 'Seller confirmed' },
          { event: 'shipped', actorId: seller.id, note: 'Shipped via Palestine Post' },
          { event: 'completed', actorId: buyer.id, note: 'Delivery confirmed' },
        ],
      },
    },
  });

  const order2 = await prisma.order.create({
    data: {
      listingId: listings[1].id,
      buyerId: buyer.id,
      sellerId: seller.id,
      amount: listings[1].price,
      paymentMethod: 'manual',
      status: 'COMPLETED',
      paymentStatus: 'completed',
      shippingAddress: { street: 'شارع الإرسال', city: 'Ramallah', phone: '+970599222222' },
      trackingNumber: 'TRK-002',
      events: {
        create: [
          { event: 'created', actorId: buyer.id },
          { event: 'confirmed', actorId: seller.id },
          { event: 'shipped', actorId: seller.id },
          { event: 'completed', actorId: buyer.id },
        ],
      },
    },
  });

  // --- Reviews ---
  await prisma.review.create({
    data: {
      orderId: order1.id,
      listingId: listings[0].id,
      reviewerId: buyer.id,
      sellerId: seller.id,
      rating: 5,
      body: 'Excellent seller! Product exactly as described. Fast shipping.',
    },
  });

  await prisma.review.create({
    data: {
      orderId: order2.id,
      listingId: listings[1].id,
      reviewerId: buyer.id,
      sellerId: seller.id,
      rating: 4,
      body: 'Good product, minor scratch but seller was honest about it.',
    },
  });

  // Update seller profile with review stats
  await prisma.sellerProfile.update({
    where: { userId: seller.id },
    data: { totalSales: 2, totalRevenue: 2100, avgRating: 4.5, reviewCount: 2 },
  });

  console.log('[seed] Orders and reviews created');
  console.log('[seed] Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
