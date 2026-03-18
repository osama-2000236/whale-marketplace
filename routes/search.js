const express = require('express');

const { optionalAuth } = require('../middleware/auth');
const { globalSearch } = require('../services/searchService');

const webRouter = express.Router();
const apiRouter = express.Router();

webRouter.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const q = req.query.q || '';
    const type = req.query.type || 'all';

    const results = await globalSearch({
      q,
      type,
      limit: Number(req.query.limit) || 10
    });

    return res.render('search/index', {
      title: 'البحث | Search',
      q,
      type,
      results
    });
  } catch (error) {
    return next(error);
  }
});

apiRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const results = await globalSearch({
      q: req.query.q,
      type: req.query.type,
      limit: Number(req.query.limit) || 10
    });

    return res.json(results);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = {
  webRouter,
  apiRouter
};
