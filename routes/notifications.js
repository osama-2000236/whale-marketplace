const express = require('express');

const { requireAuth } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const webRouter = express.Router();
const apiRouter = express.Router();

webRouter.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const notifications = await notificationService.getNotifications(req.user.id, 50);
    return res.render('notifications/index', {
      title: res.locals.t('nav.notifications'),
      notifications
    });
  } catch (error) {
    return next(error);
  }
});

webRouter.post('/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await notificationService.markAllRead(req.user.id);
    return res.redirect('/notifications');
  } catch (error) {
    return res.status(400).render('error', {
      title: res.locals.t('ui.error'),
      message: error.message
    });
  }
});

apiRouter.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await notificationService.getNotifications(req.user.id, Number(req.query.limit) || 20);
    return res.json({ notifications });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/read-all', requireAuth, async (req, res) => {
  try {
    await notificationService.markAllRead(req.user.id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = {
  webRouter,
  apiRouter
};
