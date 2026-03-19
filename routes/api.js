const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const productService = require('../services/productService');
const { readJSON } = require('../utils/dataStore');

router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.json({ status: 'ok', db: 'disconnected' });
  }
});

router.get('/config', (req, res) => {
  const config = readJSON('config.json') || {};
  res.json(config);
});

router.get('/categories', async (req, res) => {
  try {
    const cats = readJSON('categories.json') || [];
    const counts = await prisma.product.groupBy({ by: ['category'], _count: true });
    const countMap = {};
    for (const c of counts) countMap[c.category] = c._count;
    const withCounts = cats.map((c) => ({ ...c, count: countMap[c.name] || 0 }));
    res.json(withCounts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/products', async (req, res) => {
  try {
    const products = await productService.listProducts(req.query.category, { featured: req.query.featured === '1' });
    res.json(products);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
