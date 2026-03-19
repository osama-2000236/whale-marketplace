const express = require('express');
const searchService = require('../services/searchService');

const webRouter = express.Router();
const apiRouter = express.Router();

webRouter.get('/search', async (req, res, next) => {
  try {
    const { q, type, limit } = req.query;
    const results = await searchService.globalSearch({ q, type, limit: parseInt(limit || '20', 10) });
    res.render('search/index', { title: res.locals.t('search.title'), results, q, type });
  } catch (e) { next(e); }
});

apiRouter.get('/', async (req, res) => {
  try {
    const { q, type, limit } = req.query;
    const results = await searchService.globalSearch({ q, type, limit: parseInt(limit || '20', 10) });
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = { webRouter, apiRouter };
