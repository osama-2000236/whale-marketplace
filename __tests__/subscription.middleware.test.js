const { subscriptionMiddleware } = require('../middleware/subscription');

function futureDate() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function pastDate() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

describe('subscriptionMiddleware', () => {
  test('sets pro flags when user has active pro subscription', async () => {
    const req = {
      user: {
        role: 'MEMBER',
        isVerified: true,
        subscription: { plan: 'pro', paidUntil: futureDate(), trialEndsAt: null },
      },
    };
    const res = { locals: {} };
    const next = jest.fn();

    await subscriptionMiddleware(req, res, next);

    expect(res.locals.isPro).toBe(true);
    expect(res.locals.inTrial).toBe(false);
    expect(res.locals.canSell).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('sets trial flags when trial is active', async () => {
    const req = {
      user: {
        role: 'MEMBER',
        isVerified: true,
        subscription: { plan: 'free', paidUntil: null, trialEndsAt: futureDate() },
      },
    };
    const res = { locals: {} };
    const next = jest.fn();

    await subscriptionMiddleware(req, res, next);

    expect(res.locals.isPro).toBe(false);
    expect(res.locals.inTrial).toBe(true);
    expect(res.locals.canSell).toBe(true);
  });

  test('admin can sell even without active paid/trial', async () => {
    const req = {
      user: {
        role: 'ADMIN',
        isVerified: true,
        subscription: { plan: 'free', paidUntil: pastDate(), trialEndsAt: pastDate() },
      },
    };
    const res = { locals: {} };
    const next = jest.fn();

    await subscriptionMiddleware(req, res, next);

    expect(res.locals.canSell).toBe(true);
  });

  test('unverified users cannot sell even with active plan', async () => {
    const req = {
      user: {
        role: 'MEMBER',
        isVerified: false,
        subscription: { plan: 'pro', paidUntil: futureDate(), trialEndsAt: null },
      },
    };
    const res = { locals: {} };
    const next = jest.fn();

    await subscriptionMiddleware(req, res, next);

    expect(res.locals.isPro).toBe(true);
    expect(res.locals.canSell).toBe(false);
  });

  test('defaults to false flags when user/subscription is missing or expired', async () => {
    const reqExpired = {
      user: {
        role: 'MEMBER',
        subscription: { plan: 'pro', paidUntil: pastDate(), trialEndsAt: pastDate() },
      },
    };
    const resExpired = { locals: {} };
    const nextExpired = jest.fn();
    await subscriptionMiddleware(reqExpired, resExpired, nextExpired);
    expect(resExpired.locals.isPro).toBe(false);
    expect(resExpired.locals.inTrial).toBe(false);
    expect(resExpired.locals.canSell).toBe(false);

    const reqNoUser = {};
    const resNoUser = { locals: {} };
    const nextNoUser = jest.fn();
    await subscriptionMiddleware(reqNoUser, resNoUser, nextNoUser);
    expect(resNoUser.locals.isPro).toBe(false);
    expect(resNoUser.locals.inTrial).toBe(false);
    expect(resNoUser.locals.canSell).toBe(false);
  });
});
