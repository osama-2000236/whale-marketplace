const FALLBACK_CATEGORY = {
  id: 'fallback-category',
  slug: 'general',
  name: 'General',
  nameAr: 'عام',
  icon: '🛍️',
};

function createFallbackSeller() {
  return {
    id: 'fallback-seller',
    username: 'whale',
    avatarUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    sellerProfile: {
      displayName: 'Whale Team',
      avgRating: 5,
      reviewCount: 12,
      whatsapp: null,
    },
  };
}

function createFallbackListing() {
  return {
    id: 'fallback-listing-id',
    slug: '__fallback-market-item',
    title: 'Marketplace item',
    titleAr: 'منتج تجريبي',
    description: 'Sample listing used when the marketplace has no seeded listings yet.',
    descriptionAr: 'منتج تجريبي يظهر عندما لا توجد بيانات متجر كافية بعد.',
    price: 99,
    currency: 'USD',
    negotiable: false,
    condition: 'GOOD',
    images: [
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="100%" height="100%" fill="%231472a3"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="40">Whale</text></svg>',
    ],
    categoryId: FALLBACK_CATEGORY.id,
    category: FALLBACK_CATEGORY,
    city: 'Ramallah',
    sellerId: 'fallback-seller',
    status: 'ACTIVE',
    views: 0,
    seller: createFallbackSeller(),
    reviews: [],
    specs: {
      status: 'fallback',
      note: 'Seed your marketplace to replace this sample listing.',
    },
  };
}

module.exports = {
  FALLBACK_CATEGORY,
  createFallbackListing,
};
