async function subscriptionMiddleware(req, res, next) {
  if (req.user && req.user.subscription) {
    const sub = req.user.subscription;
    const now = new Date();
    res.locals.isPro = sub.plan === 'pro' && sub.paidUntil && sub.paidUntil > now;
    res.locals.inTrial = !!(sub.trialEndsAt && sub.trialEndsAt > now);
    res.locals.canSell = res.locals.isPro || res.locals.inTrial || req.user.role === 'ADMIN';
  } else {
    res.locals.isPro = false;
    res.locals.inTrial = false;
    res.locals.canSell = false;
  }
  next();
}

module.exports = { subscriptionMiddleware };
