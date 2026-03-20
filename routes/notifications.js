const express = require('express');
const { requireAuth } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const webRouter = express.Router();
const apiRouter = express.Router();

// Web
webRouter.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const notifications = await notificationService.getNotifications(req.user.id, 50);
    res.render('notifications/index', { title: res.locals.t('notifications.title'), notifications });
  } catch (e) { next(e); }
});

webRouter.post('/notifications/read-all', requireAuth, async (req, res) => {
  await notificationService.markAllRead(req.user.id);
  res.redirect('/notifications');
});

// API
apiRouter.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const notifications = await notificationService.getNotifications(req.user.id, limit);
  res.json({ notifications });
});

apiRouter.post('/read-all', requireAuth, async (req, res) => {
  await notificationService.markAllRead(req.user.id);
  res.json({ ok: true });
});

module.exports = { webRouter, apiRouter };
