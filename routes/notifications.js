const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const prisma = require('../lib/prisma');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.render('notifications/index', {
      title: 'Notifications',
      notifications,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
