/**
 * Legacy Store API Routes
 * تبقى هذه المسارات لدعم واجهات المتجر الحالية
 */

const express = require('express');
const router = express.Router();

const categories = require('../data/categories.json');
const config = require('../data/config.json');
const productService = require('../services/productService');
const { MemoryCache } = require('../utils/cache');

// Cache categories and products for 2 minutes
const apiCache = new MemoryCache({ ttlMs: 2 * 60_000, maxSize: 50 });

/**
 * GET /api/health
 * Health check endpoint used by Railway to determine if the app is running.
 * Returns 200 if healthy, 503 if database is disconnected.
 */
router.get('/health', async (_req, res) => {
  const pkg = require('../package.json');
  let dbStatus = 'connected';
  try {
    const prisma = require('../lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
  } catch (_dbError) {
    dbStatus = 'disconnected';
  }
  const statusCode = dbStatus === 'connected' ? 200 : 503;
  res.set('Cache-Control', 'no-cache');
  res.status(statusCode).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: dbStatus,
    version: pkg.version
  });
});

router.get('/config', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5 min cache
  res.json({
    siteName: config.siteName,
    tagline: config.tagline,
    contact: config.contact,
    location: config.location,
    social: config.social,
    features: config.features,
    currency: config.currency,
    businessHours: config.businessHours
  });
});

/**
 * GET /api/categories
 * Returns legacy store categories with product counts.
 */
router.get('/categories', async (_req, res) => {
  try {
    const categoriesWithCount = await apiCache.getOrSet('categories', () =>
      Promise.all(
        categories.map(async (category) => {
          const productCount = await productService.countProducts({
            category: category.id,
            inStock: true
          });
          return { ...category, productCount };
        })
      )
    );
    res.set('Cache-Control', 'public, max-age=120'); // 2 min cache
    res.json(categoriesWithCount);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const result = await productService.listProducts({
      category: req.query.category,
      search: req.query.search,
      page: Number(req.query.page) || 1,
      limit: Math.min(Number(req.query.limit) || 20, 50) // Cap at 50 to prevent abuse
    });

    if (req.query.featured === 'true') {
      const featured = result.items.filter((item) => item.featured);
      return res.json({ ...result, items: featured });
    }

    res.set('Cache-Control', 'public, max-age=60'); // 1 min cache
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load products' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.set('Cache-Control', 'public, max-age=60');
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load product' });
  }
});

module.exports = router;
