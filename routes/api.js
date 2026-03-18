/**
 * Legacy Store API Routes
 * تبقى هذه المسارات لدعم واجهات المتجر الحالية
 */

const express = require('express');
const router = express.Router();

const categories = require('../data/categories.json');
const config = require('../data/config.json');
const productService = require('../services/productService');

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
  res.status(statusCode).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: dbStatus,
    version: pkg.version
  });
});

router.get('/config', (_req, res) => {
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

router.get('/categories', async (_req, res) => {
  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      const productCount = await productService.countProducts({
        category: category.id,
        inStock: true
      });

      return {
        ...category,
        productCount
      };
    })
  );

  res.json(categoriesWithCount);
});

router.get('/products', async (req, res) => {
  try {
    const result = await productService.listProducts({
      category: req.query.category,
      search: req.query.search,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20
    });

    if (req.query.featured === 'true') {
      const featured = result.items.filter((item) => item.featured);
      return res.json({ ...result, items: featured });
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
