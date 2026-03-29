const { randomUUID } = require('node:crypto');
const slugify = require('slugify');

const DAY_MS = 24 * 60 * 60 * 1000;
const SAMPLE_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%25" height="100%25" fill="%230f766e"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="48" font-family="Arial">Whale Marketplace</text></svg>';

function daysFromNow(days) {
  return new Date(Date.now() + days * DAY_MS);
}

function normalizeSlug(value) {
  return slugify(value || '', { lower: true, strict: true });
}

function buildCategory(id, slug, name, nameAr, icon, order) {
  return { id, slug, name, nameAr, icon, order, subcategories: [] };
}

function buildUser({
  id = randomUUID(),
  username,
  email,
  passwordHash = null,
  role = 'MEMBER',
  isVerified = true,
  emailVerified = isVerified,
  avatarUrl = null,
  createdAt = new Date('2026-01-01T00:00:00.000Z'),
}) {
  return {
    id,
    username: username.toLowerCase(),
    slug: normalizeSlug(username),
    email: email.toLowerCase(),
    emailVerified,
    passwordHash,
    role,
    avatarUrl,
    bio: null,
    isVerified,
    isBanned: false,
    createdAt,
    lastSeenAt: new Date(),
    subscription: {
      id: randomUUID(),
      userId: id,
      plan: 'free',
      trialEndsAt: daysFromNow(30),
      paidUntil: null,
    },
    sellerProfile: {
      id: randomUUID(),
      userId: id,
      displayName: username,
      bio: null,
      city: null,
      whatsapp: null,
      totalSales: 0,
      totalRevenue: 0,
      avgRating: 0,
      reviewCount: 0,
      isVerified,
    },
  };
}

function buildListing({
  id = randomUUID(),
  slug,
  title,
  titleAr,
  description,
  descriptionAr,
  price,
  condition,
  category,
  city,
  seller,
  views = 0,
  negotiable = false,
  tags = [],
  images = [SAMPLE_IMAGE],
  createdAt = new Date(),
}) {
  return {
    id,
    slug,
    title,
    titleAr,
    description,
    descriptionAr,
    price,
    currency: 'USD',
    negotiable,
    condition,
    images,
    categoryId: category.id,
    subcategoryId: null,
    category,
    subcategory: null,
    city,
    sellerId: seller.id,
    seller,
    status: 'ACTIVE',
    views,
    tags,
    specs: null,
    reviews: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function createInitialStore() {
  const categories = [
    buildCategory('cat-electronics', 'electronics', 'Electronics', 'إلكترونيات', '💻', 1),
    buildCategory('cat-vehicles', 'vehicles', 'Vehicles', 'مركبات', '🚗', 2),
    buildCategory('cat-real-estate', 'real-estate', 'Real Estate', 'عقارات', '🏠', 3),
    buildCategory('cat-fashion', 'fashion', 'Fashion', 'أزياء', '👕', 4),
    buildCategory('cat-home-garden', 'home-garden', 'Home & Garden', 'المنزل والحديقة', '🪴', 5),
    buildCategory('cat-sports', 'sports', 'Sports', 'رياضة', '🚴', 6),
  ];

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const seller = buildUser({
    id: 'fallback-seller',
    username: 'whale',
    email: 'seller@whale-test.local',
    isVerified: true,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  });
  seller.subscription.plan = 'pro';
  seller.subscription.paidUntil = daysFromNow(365);
  seller.sellerProfile.displayName = 'Whale Team';
  seller.sellerProfile.city = 'Gaza';
  seller.sellerProfile.avgRating = 4.9;
  seller.sellerProfile.reviewCount = 12;

  const listings = [
    buildListing({
      id: 'listing-playstation',
      slug: 'playstation-5-bundle-vio2x',
      title: 'PlayStation 5 Bundle',
      titleAr: 'بلايستيشن 5 مع ملحقات',
      description: 'PlayStation 5 with two controllers and charging dock.',
      descriptionAr: 'جهاز بلايستيشن 5 مع يدين وقاعدة شحن.',
      price: 650,
      condition: 'GOOD',
      category: categoryBySlug.get('electronics'),
      city: 'Gaza',
      seller,
      views: 128,
      negotiable: true,
      tags: ['console', 'gaming'],
      createdAt: new Date('2026-03-25T10:00:00.000Z'),
    }),
    buildListing({
      id: 'listing-apartment',
      slug: 'apartment-for-sale-in-ramallah-g900n',
      title: 'Apartment for Sale in Ramallah',
      titleAr: 'شقة للبيع في رام الله',
      description: 'Sunny apartment in central Ramallah with parking.',
      descriptionAr: 'شقة مشمسة في وسط رام الله مع موقف سيارة.',
      price: 120000,
      condition: 'GOOD',
      category: categoryBySlug.get('real-estate'),
      city: 'Ramallah',
      seller,
      views: 86,
      tags: ['apartment', 'property'],
      createdAt: new Date('2026-03-24T09:00:00.000Z'),
    }),
    buildListing({
      id: 'listing-bike',
      slug: 'mountain-bike-trek-2cb6o',
      title: 'Mountain Bike Trek',
      titleAr: 'دراجة جبلية تريك',
      description: 'Trail-ready mountain bike with upgraded suspension.',
      descriptionAr: 'دراجة جبلية جاهزة للمسارات مع نظام تعليق مطور.',
      price: 780,
      condition: 'LIKE_NEW',
      category: categoryBySlug.get('sports'),
      city: 'Hebron',
      seller,
      views: 42,
      tags: ['bike', 'outdoors'],
      createdAt: new Date('2026-03-23T08:00:00.000Z'),
    }),
  ];

  const usersById = new Map([[seller.id, seller]]);
  const listingsById = new Map(listings.map((listing) => [listing.id, listing]));

  return {
    categories,
    categoryById,
    categoryBySlug,
    usersById,
    listingsById,
    savedByUserId: new Map(),
  };
}

function getStore() {
  if (!global.__whaleFallbackStore) {
    global.__whaleFallbackStore = createInitialStore();
  }
  return global.__whaleFallbackStore;
}

function getCategories() {
  return getStore().categories;
}

function findCategoryById(categoryId) {
  return getStore().categoryById.get(categoryId) || null;
}

function findCategoryBySlug(slug) {
  return getStore().categoryBySlug.get(slug) || null;
}

function listListings() {
  return Array.from(getStore().listingsById.values());
}

function findListingBySlugOrId(value) {
  const listing = listListings().find((item) => item.slug === value || item.id === value);
  return listing || null;
}

function saveListing(listing) {
  getStore().listingsById.set(listing.id, listing);
  return listing;
}

function findUserById(userId) {
  return getStore().usersById.get(userId) || null;
}

function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return Array.from(getStore().usersById.values()).find((user) => user.email === normalized) || null;
}

function findUserByUsername(username) {
  const normalized = String(username || '').trim().toLowerCase();
  return (
    Array.from(getStore().usersById.values()).find((user) => user.username === normalized) || null
  );
}

function findUserByIdentifier(identifier) {
  return findUserByEmail(identifier) || findUserByUsername(identifier);
}

function createUser({ username, email, passwordHash, isVerified = true, emailVerified = isVerified }) {
  const user = buildUser({
    username,
    email,
    passwordHash,
    emailVerified,
    isVerified,
    createdAt: new Date(),
  });
  getStore().usersById.set(user.id, user);
  return user;
}

function updateUser(userId, data) {
  const user = findUserById(userId);
  if (!user) return null;
  Object.assign(user, data);
  if (data.subscription) user.subscription = data.subscription;
  if (data.sellerProfile) user.sellerProfile = data.sellerProfile;
  return user;
}

function getSavedListings(userId) {
  const saved = getStore().savedByUserId.get(userId) || new Set();
  return Array.from(saved)
    .map((listingId) => findListingBySlugOrId(listingId))
    .filter(Boolean);
}

function toggleSavedListing(userId, listingId) {
  const saved = getStore().savedByUserId.get(userId) || new Set();
  const isSaved = saved.has(listingId);
  if (isSaved) {
    saved.delete(listingId);
  } else {
    saved.add(listingId);
  }
  getStore().savedByUserId.set(userId, saved);
  return { saved: !isSaved };
}

function isListingSaved(userId, listingId) {
  const saved = getStore().savedByUserId.get(userId);
  return saved ? saved.has(listingId) : false;
}

function createListingForSeller(sellerId, data) {
  const seller = findUserById(sellerId);
  const category = findCategoryById(data.categoryId);
  if (!seller || !category) return null;

  let slug = normalizeSlug(data.title);
  if (!slug) slug = `listing-${Date.now()}`;
  while (findListingBySlugOrId(slug)) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const listing = buildListing({
    id: randomUUID(),
    slug,
    title: data.title,
    titleAr: data.titleAr || null,
    description: data.description,
    descriptionAr: data.descriptionAr || null,
    price: parseFloat(data.price),
    condition: data.condition || 'USED',
    category,
    city: data.city || '',
    seller,
    views: 0,
    negotiable: data.negotiable === true || data.negotiable === 'true' || data.negotiable === 'on',
    tags: Array.isArray(data.tags)
      ? data.tags
      : String(data.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
    images: Array.isArray(data.images) ? data.images : [data.images].filter(Boolean),
    createdAt: new Date(),
  });

  saveListing(listing);
  return listing;
}

function markListingRemoved(listingId) {
  const listing = findListingBySlugOrId(listingId);
  if (!listing) return null;
  listing.status = 'REMOVED';
  listing.updatedAt = new Date();
  return listing;
}

module.exports = {
  getCategories,
  findCategoryById,
  findCategoryBySlug,
  listListings,
  findListingBySlugOrId,
  saveListing,
  findUserById,
  findUserByEmail,
  findUserByUsername,
  findUserByIdentifier,
  createUser,
  updateUser,
  getSavedListings,
  toggleSavedListing,
  isListingSaved,
  createListingForSeller,
  markListingRemoved,
};
