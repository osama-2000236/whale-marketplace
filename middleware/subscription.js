const prisma = require('../lib/prisma');

async function getSubStatus(userId) {
  if (!userId) return { isPro: false, sub: null };
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return { isPro: false, sub: null };
  const now = new Date();
  const isPro =
    sub.plan === 'pro' &&
    ((sub.paidUntil && sub.paidUntil > now) || (sub.trialEndsAt && sub.trialEndsAt > now));
  return { isPro, sub };
}

async function requirePro(req, res, next) {
  try {
    if (!req.session.userId) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/auth/register?reason=pro');
    }
    const { isPro } = await getSubStatus(req.session.userId);
    if (!isPro) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/upgrade?reason=feature');
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

async function injectSubStatus(req, res, next) {
  try {
    if (req.session.userId) {
      const { isPro, sub } = await getSubStatus(req.session.userId);
      res.locals.isPro = isPro;
      res.locals.subscription = sub;

      // Throttle lastSeenAt updates (every 5 minutes)
      const user = req.user;
      if (user && user.id) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (!user.lastSeenAt || new Date(user.lastSeenAt) < fiveMinAgo) {
          prisma.user
            .update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
            .catch(() => {});
        }
      }
    } else {
      res.locals.isPro = false;
      res.locals.subscription = null;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function startSubscriptionCron() {
  const cron = require('node-cron');

  // Daily midnight: downgrade expired Pro subscriptions
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const result = await prisma.subscription.updateMany({
        where: {
          plan: 'pro',
          paidUntil: { lt: now },
          OR: [{ trialEndsAt: null }, { trialEndsAt: { lt: now } }],
        },
        data: { plan: 'free' },
      });
      if (result.count > 0) console.log(`[CRON] Downgraded ${result.count} expired Pro subscriptions`);
    } catch (e) {
      console.error('[CRON] Downgrade error:', e.message);
    }
  });

  // Daily 9am: warn users about expiring subscriptions
  cron.schedule('0 9 * * *', async () => {
    try {
      const now = new Date();
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const expiring = await prisma.subscription.findMany({
        where: {
          plan: 'pro',
          OR: [
            { paidUntil: { gte: now, lte: threeDays } },
            { trialEndsAt: { gte: now, lte: threeDays } },
          ],
        },
        include: { user: { select: { id: true, email: true, username: true } } },
      });
      for (const sub of expiring) {
        await prisma.notification.create({
          data: {
            userId: sub.userId,
            type: 'SYSTEM',
            message: 'اشتراكك Pro سينتهي قريباً. جدد الآن لتستمر بالبيع بدون حدود.',
          },
        }).catch(() => {});
      }
      if (expiring.length > 0) console.log(`[CRON] Warned ${expiring.length} expiring subscriptions`);
    } catch (e) {
      console.error('[CRON] Expiry warning error:', e.message);
    }
  });

  // Daily 10am: auto-complete stale shipped orders
  cron.schedule('0 10 * * *', async () => {
    try {
      const autoCompleteDays = parseInt(process.env.AUTO_COMPLETE_DAYS || '14', 10);
      const cutoff = new Date(Date.now() - autoCompleteDays * 24 * 60 * 60 * 1000);
      const staleOrders = await prisma.order.findMany({
        where: {
          orderStatus: { in: ['SHIPPED', 'DELIVERED'] },
          updatedAt: { lt: cutoff },
        },
      });
      for (const order of staleOrders) {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              orderStatus: 'COMPLETED',
              paymentStatus: 'released',
              confirmedAt: new Date(),
            },
          });
          await tx.orderEvent.create({
            data: { orderId: order.id, event: 'auto_completed', note: `Auto-completed after ${autoCompleteDays} days` },
          });
          await tx.sellerProfile.upsert({
            where: { userId: order.sellerId },
            create: { userId: order.sellerId, totalSales: 1, totalRevenue: order.amount },
            update: { totalSales: { increment: 1 }, totalRevenue: { increment: order.amount } },
          });
        }).catch((e) => console.error(`[CRON] Auto-complete order ${order.id} failed:`, e.message));
      }
      if (staleOrders.length > 0) console.log(`[CRON] Auto-completed ${staleOrders.length} stale orders`);
    } catch (e) {
      console.error('[CRON] Auto-complete error:', e.message);
    }
  });
}

module.exports = { requirePro, injectSubStatus, getSubStatus, startSubscriptionCron };
