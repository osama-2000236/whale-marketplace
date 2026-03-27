/**
 * Fallback content for when the database is unavailable or bootstrap fails.
 * Prevents hard 500s on / and /whale by providing static placeholder data.
 */

const FALLBACK_CATEGORIES = [
  { id: 'fallback-1', name: 'Electronics', nameAr: 'إلكترونيات', slug: 'electronics', icon: null, order: 0, subcategories: [] },
  { id: 'fallback-2', name: 'Fashion', nameAr: 'أزياء', slug: 'fashion', icon: null, order: 1, subcategories: [] },
  { id: 'fallback-3', name: 'Home', nameAr: 'المنزل', slug: 'home', icon: null, order: 2, subcategories: [] },
];

const FALLBACK_LISTINGS = [];

function getFallbackCategories() {
  return FALLBACK_CATEGORIES;
}

function getFallbackListings() {
  return { listings: FALLBACK_LISTINGS, nextCursor: null, total: 0 };
}

module.exports = { getFallbackCategories, getFallbackListings };
