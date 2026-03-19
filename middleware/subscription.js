const prisma = require('../lib/prisma');
const emailService = require('../services/emailService');

/**
 * Checks if user has an active Pro subscription
 * (either trial or paid)
 */
async function getSubStatus(userId) {
  if (!userId) return { isPro: false, sub: null };
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return { isPro: false, sub: null };
  const now = new Date();
  const isPro =
    sub.plan === 'pro' &&
    ((sub.paidUntil && sub.paidUntil > now) ||
      (sub.trialEndsAt && sub.trialEndsAt > now));
  return { isPro, sub };
}

/**
 * requirePro — gates Pro-only routes.
 * Stores returnTo in session so user is redirected back after upgrade.
 */
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

/**
 * injectSubStatus — adds isPro + sub to res.locals for every view.
 * Mount this GLOBALLY in server.js after session middleware.
 */
async function injectSubStatus(req, res, next) {
  try {
    if (req.session.userId) {
      const { isPro, sub } = await getSubStatus(req.session.userId);
      res.locals.isPro = isPro;
      res.locals.subscription = sub;

      // Update lastSeenAt (throttled — only if >5 min since last update)
      const user = req.user;
      if (user && user.id) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (!user.lastSeenAt || new Date(user.lastSeenAt) < fiveMinAgo) {
          prisma.user
            .update({
              where: { id: user.id },
              data: { lastSeenAt: new Date() }
            })
            .catch((e) => {
              // Log but don't block request — lastSeenAt is non-critical
              if (process.env.NODE_ENV !== 'production') {
                console.warn('[lastSeenAt] update failed:', e.message);
              }
            });
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

/**
 * Cron job — run once at server startup.
 * Downgrades expired Pro subscriptions to free at midnight.
 */
function startSubscriptionCron() {
  const cron = require('node-cron');

  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const result = await prisma.subscription.updateMany({
        where: {
          plan: 'pro',
          paidUntil: { lt: now },
          OR: [{ trialEndsAt: null }, { trialEndsAt: { lt: now } }]
        },
        data: { plan: 'free' }
      });
      // eslint-disable-next-line no-console
      console.log(`[CRON] Downgraded ${result.count} expired Pro subscriptions`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[CRON] Pro downgrade job failed:', error.message);
    }
  });

  // 3-day warning notification job
  cron.schedule('0 9 * * *', async () => {
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const expiring = await prisma.subscription.findMany({
        where: {
          plan: 'pro',
          OR: [
            { paidUntil: { gte: now, lte: threeDaysFromNow } },
            { trialEndsAt: { gte: now, lte: threeDaysFromNow } }
          ]
        },
        include: {
          user: { select: { id: true, email: true, username: true } }
        }
      });

      for (const sub of expiring) {
        const expiry = sub.paidUntil || sub.trialEndsAt;
        const daysLeft = Math.max(0, Math.ceil((new Date(expiry) - now) / (1000 * 60 * 60 * 24)));

        // eslint-disable-next-line no-await-in-loop
        await prisma.notification
          .create({
            data: {
              userId: sub.userId,
              type: 'SYSTEM',
              message: `⚡ اشتراكك Pro ينتهي خلال ${daysLeft} أيام — Your Pro subscription expires in ${daysLeft} days`
            }
          })
          .catch(() => {});

        if (sub.user?.email) {
          // eslint-disable-next-line no-await-in-loop
          await emailService.sendTrialEnding(sub.user, daysLeft).catch(() => {});
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[CRON] Expiry warning job failed:', error.message);
    }
  });

  // Auto-complete stale shipped orders after N days without buyer confirmation
  const autoCompleteDays = parseInt(process.env.AUTO_COMPLETE_DAYS || '14', 10);
  cron.schedule('0 10 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - autoCompleteDays * 24 * 60 * 60 * 1000);
      const staleOrders = await prisma.order.findMany({
        where: {
          orderStatus: { in: ['SHIPPED', 'DELIVERED'] },
          updatedAt: { lt: cutoff }
        }
      });

      for (const order of staleOrders) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              orderStatus: 'COMPLETED',
              paymentStatus: 'released',
              confirmedAt: new Date()
            }
          });

          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              event: 'completed',
              note: `Auto-completed after ${autoCompleteDays} days without buyer confirmation`
            }
          });

          await tx.sellerProfile.upsert({
            where: { userId: order.sellerId },
            create: {
              userId: order.sellerId,
              totalSales: 1,
              totalRevenue: order.amount
            },
            update: {
              totalSales: { increment: 1 },
              totalRevenue: { increment: order.amount }
            }
          });
        });
      }

      if (staleOrders.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`[CRON] Auto-completed ${staleOrders.length} stale orders`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[CRON] Whale auto-complete job failed:', error.message);
    }
  });
}

module.exports = { requirePro, injectSubStatus, getSubStatus, startSubscriptionCron };
