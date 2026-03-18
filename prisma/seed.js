/* eslint-disable no-console */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { getCityOptions } = require('../lib/cities');

const prisma = new PrismaClient();

const officialRooms = [
  {
    name: 'CS2',
    nameAr: 'كاونتر سترايك 2',
    game: 'cs2',
    icon: '🔫',
    coverImage: '/images/rooms/cs2.jpg',
    description: 'Counter-Strike 2 players, clips, strats, and updates.',
    descriptionAr: 'مجتمع كاونتر سترايك 2 للنقاشات، اللقطات، والخطط.'
  },
  {
    name: 'Valorant',
    nameAr: 'فالورانت',
    game: 'valorant',
    icon: '🎯',
    coverImage: '/images/rooms/valorant.jpg',
    description: 'Valorant ranked and casual players community.',
    descriptionAr: 'مجتمع فالورانت للاعبين المصنفين والعاديين.'
  },
  {
    name: 'FIFA',
    nameAr: 'فيفا',
    game: 'fifa',
    icon: '⚽',
    coverImage: '/images/rooms/fifa.jpg',
    description: 'EA FC / FIFA players and tournaments.',
    descriptionAr: 'مجتمع EA FC / FIFA للاعبين والبطولات.'
  },
  {
    name: 'Minecraft',
    nameAr: 'ماينكرافت',
    game: 'minecraft',
    icon: '🧱',
    coverImage: '/images/rooms/minecraft.jpg',
    description: 'Builds, servers, and survival stories.',
    descriptionAr: 'مجتمع البناء والسيرفرات وقصص البقاء.'
  },
  {
    name: 'Fortnite',
    nameAr: 'فورتنايت',
    game: 'fortnite',
    icon: '🪂',
    coverImage: '/images/rooms/fortnite.jpg',
    description: 'Fortnite builds, updates, and squads.',
    descriptionAr: 'مجتمع فورتنايت للبنايات، التحديثات، والفرق.'
  },
  {
    name: 'League of Legends',
    nameAr: 'ليغ أوف ليجندز',
    game: 'lol',
    icon: '🧙',
    coverImage: '/images/rooms/lol.jpg',
    description: 'League of Legends champions and ranked grind.',
    descriptionAr: 'مجتمع ليغ أوف ليجندز للأبطال والتصنيف.'
  },
  {
    name: 'PUBG',
    nameAr: 'ببجي',
    game: 'pubg',
    icon: '🎖️',
    coverImage: '/images/rooms/pubg.jpg',
    description: 'PUBG PC clips, squads, and tips.',
    descriptionAr: 'مجتمع ببجي للقطات، الفرق، والنصائح.'
  },
  {
    name: 'GTA V',
    nameAr: 'جي تي اي 5',
    game: 'gta-v',
    icon: '🚗',
    coverImage: '/images/rooms/gta-v.jpg',
    description: 'GTA V online, roleplay, and crews.',
    descriptionAr: 'مجتمع GTA V أونلاين والرول بلاي والكروات.'
  },
  {
    name: 'Free Fire',
    nameAr: 'فري فاير',
    game: 'free-fire',
    icon: '🔥',
    coverImage: '/images/rooms/free-fire.jpg',
    description: 'Free Fire highlights and tournaments.',
    descriptionAr: 'مجتمع فري فاير للقطات والبطولات.'
  },
  {
    name: 'General Gaming',
    nameAr: 'قيمنق عام',
    game: 'general',
    icon: '🎮',
    coverImage: '/images/rooms/general.jpg',
    description: 'General gaming discussion for Arab gamers.',
    descriptionAr: 'مساحة نقاش قيمنق عامة للاعبين العرب.'
  }
];

const fallbackProducts = [
  {
    name: 'Gaming PC - RTX 4060',
    nameAr: 'جهاز قيمنق RTX 4060',
    category: 'desktops',
    price: 3800,
    oldPrice: 4200,
    description: 'كمبيوتر قيمنق بمواصفات عالية مناسب لجميع الألعاب الحديثة',
    specs: {
      cpu: 'Intel Core i5-13400F',
      gpu: 'NVIDIA RTX 4060 8GB',
      ram: '16GB DDR4',
      storage: '512GB NVMe SSD'
    },
    image: '/images/products/placeholder.svg',
    badge: 'الأكثر مبيعاً',
    inStock: true,
    featured: true,
    sortOrder: 1
  },
  {
    name: 'Lenovo IdeaPad 3',
    nameAr: 'لينوفو ايديا باد 3',
    category: 'laptops',
    price: 1800,
    oldPrice: null,
    description: 'لابتوب مناسب للدراسة والعمل اليومي',
    specs: {
      cpu: 'Intel Core i5-1235U',
      gpu: 'Intel Iris Xe',
      ram: '8GB DDR4',
      storage: '256GB SSD'
    },
    image: '/images/products/placeholder.svg',
    badge: 'عرض',
    inStock: true,
    featured: true,
    sortOrder: 2
  },
  {
    name: 'Logitech G203 Mouse',
    nameAr: 'ماوس لوجيتك G203',
    category: 'gaming',
    price: 120,
    oldPrice: null,
    description: 'ماوس قيمنق بدقة عالية وإضاءة RGB',
    specs: {
      dpi: '8000',
      buttons: '6',
      lighting: 'RGB'
    },
    image: '/images/products/placeholder.svg',
    badge: '',
    inStock: true,
    featured: false,
    sortOrder: 3
  }
];

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function readLegacyProducts() {
  const legacyPath = path.join(__dirname, '..', 'data', 'products.json');
  if (!fs.existsSync(legacyPath)) {
    return fallbackProducts;
  }

  try {
    const raw = fs.readFileSync(legacyPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return fallbackProducts;
    }

    return parsed.map((product, index) => ({
      name: product.name || product.nameAr || `Product ${index + 1}`,
      nameAr: product.nameAr || product.name || `منتج ${index + 1}`,
      category: product.category || 'other',
      price: Number(product.price || 0),
      oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
      description: product.description || '',
      specs: product.specs || {},
      image: product.image || '/images/products/placeholder.svg',
      badge: product.badge || '',
      inStock: Boolean(product.inStock ?? true),
      featured: Boolean(product.featured ?? false),
      sortOrder: Number(product.sortOrder || index + 1)
    }));
  } catch (error) {
    console.error('Failed to parse legacy products.json, using fallback:', error.message);
    return fallbackProducts;
  }
}

async function seed() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pcgaming.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'PcGaming@2024';

  const adminHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      email: adminEmail,
      passwordHash: adminHash,
      role: 'ADMIN',
      isVerified: true,
      isBanned: false,
      avatar: '/images/avatars/admin-default.png',
      bio: 'حساب الإدارة | Admin account'
    },
    create: {
      username: adminUsername,
      email: adminEmail,
      passwordHash: adminHash,
      role: 'ADMIN',
      isVerified: true,
      isBanned: false,
      avatar: '/images/avatars/admin-default.png',
      bio: 'حساب الإدارة | Admin account',
      pcSpecs: {
        cpu: 'Intel Core i7',
        gpu: 'NVIDIA RTX',
        ram: '32GB',
        storage: '1TB NVMe'
      }
    }
  });

  const memberUser = await prisma.user.upsert({
    where: { email: 'member@pcgaming.local' },
    update: {},
    create: {
      username: 'gamer_pal',
      email: 'member@pcgaming.local',
      passwordHash: await bcrypt.hash('Member@123', 10),
      role: 'MEMBER',
      isVerified: true,
      bio: 'لاعب من فلسطين | Gamer from Palestine',
      avatar: '/images/avatars/default-user.png',
      pcSpecs: {
        cpu: 'Ryzen 5 5600',
        gpu: 'RTX 3060',
        ram: '16GB',
        storage: '1TB SSD'
      }
    }
  });

  for (const room of officialRooms) {
    await prisma.gameRoom.upsert({
      where: { slug: slugify(room.name) },
      update: {
        name: room.name,
        nameAr: room.nameAr,
        game: room.game,
        description: room.description,
        descriptionAr: room.descriptionAr,
        icon: room.icon,
        coverImage: room.coverImage,
        isOfficial: true
      },
      create: {
        ...room,
        slug: slugify(room.name),
        isOfficial: true
      }
    });
  }

  const roomCount = await prisma.roomMembership.count({
    where: {
      userId: memberUser.id
    }
  });

  if (roomCount === 0) {
    const generalRoom = await prisma.gameRoom.findUnique({ where: { slug: 'general-gaming' } });
    if (generalRoom) {
      await prisma.$transaction([
        prisma.roomMembership.create({
          data: {
            userId: memberUser.id,
            roomId: generalRoom.id,
            role: 'MEMBER'
          }
        }),
        prisma.gameRoom.update({
          where: { id: generalRoom.id },
          data: { memberCount: { increment: 1 } }
        })
      ]);
    }
  }

  const productCount = await prisma.product.count();
  if (productCount === 0) {
    const legacyProducts = readLegacyProducts();
    for (const product of legacyProducts) {
      await prisma.product.create({ data: product });
    }
  }

  const listingCount = await prisma.marketplaceListing.count();
  if (listingCount === 0) {
    await prisma.marketplaceListing.createMany({
      data: [
        {
          title: 'RTX 3070 Gaming PC',
          titleAr: 'جهاز قيمنق RTX 3070',
          description: 'Used gaming PC in great condition.',
          descriptionAr: 'جهاز قيمنق مستعمل بحالة ممتازة.',
          price: 4200,
          condition: 'GOOD',
          category: 'FULL_PC',
          images: ['/images/products/placeholder.svg'],
          sellerId: memberUser.id,
          status: 'ACTIVE',
          location: 'Tulkarem',
          whatsappNumber: '970597127547',
          views: 14
        },
        {
          title: 'AOC 24" 144Hz Monitor',
          titleAr: 'شاشة AOC 24 بوصة 144Hz',
          description: 'Perfect for esports players.',
          descriptionAr: 'ممتازة للاعبي الألعاب التنافسية.',
          price: 650,
          condition: 'LIKE_NEW',
          category: 'MONITOR',
          images: ['/images/products/placeholder.svg'],
          sellerId: adminUser.id,
          status: 'ACTIVE',
          location: 'Nablus',
          whatsappNumber: '970597127547',
          views: 9
        },
        {
          title: 'HyperX Gaming Headset',
          titleAr: 'سماعة HyperX قيمنق',
          description: 'Clear mic and comfortable ear cups.',
          descriptionAr: 'مايك واضح وراحة ممتازة.',
          price: 220,
          condition: 'GOOD',
          category: 'PERIPHERALS',
          images: ['/images/products/placeholder.svg'],
          sellerId: memberUser.id,
          status: 'ACTIVE',
          location: 'Ramallah',
          whatsappNumber: '970597127547',
          views: 6
        }
      ]
    });
  }

  // Forum categories — idempotent
  const forumCategories = [
    {
      name: 'PC Build Help',
      nameAr: 'مساعدة في تجميع الجهاز',
      slug: 'pc-build-help',
      description: 'Share your specs, get advice before you buy',
      descriptionAr: 'شارك مواصفات جهازك وخذ نصيحة قبل الشراء',
      order: 1,
      icon: '🔧'
    },
    {
      name: 'Problems & Fixes',
      nameAr: 'مشاكل وحلول',
      slug: 'problems-fixes',
      description: 'Hardware issues, crashes, driver problems',
      descriptionAr: 'مشاكل الهاردوير، الكراشات، وتعريفات القطع',
      order: 2,
      icon: '🛠'
    },
    {
      name: 'Best Deals',
      nameAr: 'أفضل الأسعار',
      slug: 'best-deals',
      description: 'Share where to buy parts cheap in Palestine',
      descriptionAr: 'شارك أماكن شراء القطع بأفضل سعر في فلسطين',
      order: 3,
      icon: '💰'
    },
    {
      name: 'Showcase Your Build',
      nameAr: 'اعرض جهازك',
      slug: 'showcase',
      description: 'Finished your PC? Show it off here',
      descriptionAr: 'خلصت التجميعة؟ استعرضها هنا',
      order: 4,
      icon: '🖥'
    },
    {
      name: 'Gaming Setup',
      nameAr: 'إعداد الألعاب',
      slug: 'gaming-setup',
      description: 'Monitors, peripherals, chairs, desks',
      descriptionAr: 'شاشات، ملحقات، كراسي، مكاتب',
      order: 5,
      icon: '🎮'
    },
    {
      name: 'Software & OS',
      nameAr: 'البرامج ونظام التشغيل',
      slug: 'software-os',
      description: 'Windows, drivers, benchmarks, optimization',
      descriptionAr: 'ويندوز، تعريفات، بنشمارك، وتحسين الأداء',
      order: 6,
      icon: '💿'
    }
  ];

  for (const cat of forumCategories) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.forumCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat
    });
  }
  console.log('✅ Forum categories seeded');

  // ── WHALE MARKETPLACE CATEGORIES ──
  const whaleCategories = [
    { name: 'Electronics', nameAr: 'الإلكترونيات', slug: 'electronics', icon: '⚡', order: 1 },
    { name: 'Phones', nameAr: 'الموبايل', slug: 'phones', icon: '📱', order: 2 },
    { name: 'PC & Gaming', nameAr: 'الكمبيوتر والألعاب', slug: 'pc-gaming', icon: '🖥️', order: 3 },
    { name: 'Clothes', nameAr: 'الملابس والأزياء', slug: 'clothes', icon: '👕', order: 4 },
    { name: 'Home & Garden', nameAr: 'المنزل والحديقة', slug: 'home-garden', icon: '🏠', order: 5 },
    { name: 'Vehicles', nameAr: 'السيارات والمركبات', slug: 'vehicles', icon: '🚗', order: 6 },
    { name: 'Sports', nameAr: 'الرياضة', slug: 'sports', icon: '⚽', order: 7 },
    { name: 'Books & Education', nameAr: 'الكتب والتعليم', slug: 'books', icon: '📚', order: 8 },
    { name: 'Furniture', nameAr: 'الأثاث', slug: 'furniture', icon: '🪑', order: 9 },
    { name: 'Kids & Toys', nameAr: 'الأطفال والألعاب', slug: 'kids-toys', icon: '🧸', order: 10 },
    { name: 'Tools', nameAr: 'الأدوات والمعدات', slug: 'tools', icon: '🔧', order: 11 },
    { name: 'Other', nameAr: 'أخرى', slug: 'other', icon: '📦', order: 12 }
  ];

  for (const cat of whaleCategories) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.marketCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        nameAr: cat.nameAr,
        icon: cat.icon,
        order: cat.order
      },
      create: cat
    });
  }

  const pcPartsCategory = await prisma.marketCategory.findUnique({
    where: { slug: 'pc-gaming' }
  });

  if (pcPartsCategory) {
    const pcSubs = [
      { name: 'Graphics Cards', nameAr: 'كروت الشاشة', slug: 'gpu', categoryId: pcPartsCategory.id },
      { name: 'Processors', nameAr: 'المعالجات', slug: 'cpu', categoryId: pcPartsCategory.id },
      { name: 'RAM', nameAr: 'ذاكرة RAM', slug: 'ram', categoryId: pcPartsCategory.id },
      { name: 'Storage', nameAr: 'التخزين', slug: 'storage', categoryId: pcPartsCategory.id },
      { name: 'Monitors', nameAr: 'الشاشات', slug: 'monitors', categoryId: pcPartsCategory.id },
      { name: 'Keyboards', nameAr: 'لوحات المفاتيح', slug: 'keyboards', categoryId: pcPartsCategory.id },
      { name: 'Mice', nameAr: 'الفأرة', slug: 'mice', categoryId: pcPartsCategory.id },
      { name: 'Headsets', nameAr: 'السماعات', slug: 'headsets', categoryId: pcPartsCategory.id },
      { name: 'PSU', nameAr: 'مزود الطاقة', slug: 'psu', categoryId: pcPartsCategory.id },
      { name: 'Cooling', nameAr: 'التبريد', slug: 'cooling', categoryId: pcPartsCategory.id }
    ];

    for (const sub of pcSubs) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.marketSubcategory.upsert({
        where: { slug: sub.slug },
        update: {
          name: sub.name,
          nameAr: sub.nameAr,
          categoryId: sub.categoryId
        },
        create: sub
      });
    }
  }

  const seededCityOptions = getCityOptions('en');
  console.log(`✅ Whale cities loaded (${seededCityOptions.length})`);

  // ── SHIPPING COMPANIES ──
  const shippingCos = [
    {
      name: 'Palestine Post',
      nameAr: 'بريد فلسطين',
      basePrice: 15,
      estimatedDays: 3,
      cities: ['Tulkarem', 'Ramallah', 'Nablus', 'Hebron', 'Jenin', 'Jericho', 'Bethlehem', 'Qalqilya', 'Salfit', 'Tubas'],
      phone: '02-2980100',
      isActive: true
    },
    {
      name: 'Flash Delivery',
      nameAr: 'فلاش للتوصيل',
      basePrice: 20,
      estimatedDays: 1,
      cities: ['Tulkarem', 'Nablus', 'Ramallah', 'Jenin', 'Qalqilya'],
      isActive: true
    },
    {
      name: 'Masar Courier',
      nameAr: 'مسار للشحن',
      basePrice: 18,
      estimatedDays: 2,
      cities: ['Tulkarem', 'Ramallah', 'Nablus', 'Hebron', 'Bethlehem', 'Jenin'],
      isActive: true
    }
  ];

  for (const co of shippingCos) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.shippingCompany.upsert({
      where: { name: co.name },
      update: {
        nameAr: co.nameAr,
        basePrice: co.basePrice,
        estimatedDays: co.estimatedDays,
        cities: co.cities,
        phone: co.phone || null,
        isActive: co.isActive
      },
      create: co
    });
  }
  console.log('✅ Whale marketplace categories and shipping companies seeded');

  console.log('Seed completed successfully.');
  console.log(`Admin username: ${adminUsername}`);
  console.log(`Admin email: ${adminEmail}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
