jest.mock('../lib/prisma', () => ({
  subscription: {
    findUnique: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
  listing: {
    findUnique: jest.fn(),
  },
}));

const prisma = require('../lib/prisma');
const {
  optionalAuth,
  requireAuth,
  requireAdmin,
  requireAdminScope,
  requireAdmin2FA,
  requireVerified,
  requirePro,
  requireOrderParty,
  requireSeller,
  requireBuyer,
  requireOwner,
  hasAdminPermission,
} = require('../middleware/auth');

function makeRes() {
  return {
    locals: {},
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    redirect: jest.fn(),
    render: jest.fn(),
  };
}

describe('auth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('optionalAuth sets locals.user and calls next', () => {
    const req = { user: { id: 'u1' } };
    const res = makeRes();
    const next = jest.fn();
    optionalAuth(req, res, next);
    expect(res.locals.user).toEqual({ id: 'u1' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requireAuth redirects unauthenticated users and sets flash', () => {
    const req = { user: null, session: {}, originalUrl: '/secure/page' };
    const res = makeRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(req.session.flash).toEqual({ type: 'warning', message: 'Please log in to continue' });
    expect(res.redirect).toHaveBeenCalledWith('/auth/login?next=%2Fsecure%2Fpage');
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAuth passes authenticated users', () => {
    const req = { user: { id: 'u1' }, session: {}, originalUrl: '/x' };
    const res = makeRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.locals.user).toEqual({ id: 'u1' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requireAdmin blocks non-admin', () => {
    const req = { user: { role: 'MEMBER' } };
    const res = makeRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({ status: 403 }));
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAdmin allows admin without 2FA requirement', () => {
    const req = { user: { role: 'ADMIN' }, session: {} };
    const res = makeRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requireAdmin redirects admins with 2FA enabled until they verify', () => {
    const req = {
      user: { role: 'ADMIN', twoFactorSecret: 'secret' },
      session: {},
    };
    const res = makeRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('/auth/2fa');
    expect(next).not.toHaveBeenCalled();
  });

  test('hasAdminPermission grants super admin and matching scoped permissions', () => {
    expect(hasAdminPermission({ role: 'ADMIN', adminScope: 'SUPER_ADMIN' }, 'payments.write')).toBe(
      true
    );
    expect(hasAdminPermission({ role: 'ADMIN', adminScope: 'SUPPORT_AGENT' }, 'payments.read')).toBe(
      true
    );
    expect(hasAdminPermission({ role: 'ADMIN', adminScope: 'WAREHOUSE' }, 'payments.write')).toBe(
      false
    );
  });

  test('requireAdminScope blocks non-admin', () => {
    const middleware = requireAdminScope('SUPER_ADMIN', 'SUPPORT_AGENT');
    const req = { user: { role: 'MEMBER' } };
    const res = makeRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAdminScope allows super admin and explicit supported scopes', () => {
    const superAdmin = requireAdminScope('SUPER_ADMIN', 'SUPPORT_AGENT');
    const supportAgent = requireAdminScope('SUPER_ADMIN', 'SUPPORT_AGENT');

    const res1 = makeRes();
    const next1 = jest.fn();
    superAdmin({ user: { role: 'ADMIN', adminScope: 'SUPER_ADMIN' } }, res1, next1);
    expect(next1).toHaveBeenCalledTimes(1);

    const res2 = makeRes();
    const next2 = jest.fn();
    supportAgent({ user: { role: 'ADMIN', adminScope: 'SUPPORT_AGENT' } }, res2, next2);
    expect(next2).toHaveBeenCalledTimes(1);
  });

  test('requireAdminScope blocks non-matching scopes', () => {
    const middleware = requireAdminScope('SUPER_ADMIN', 'SUPPORT_AGENT');
    const req = { user: { role: 'ADMIN', adminScope: 'WAREHOUSE' } };
    const res = makeRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAdminScope redirects admins with 2FA enabled until they verify', () => {
    const middleware = requireAdminScope('SUPER_ADMIN');
    const req = {
      user: { role: 'ADMIN', adminScope: 'SUPER_ADMIN', twoFactorSecret: 'secret' },
      session: {},
    };
    const res = makeRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('/auth/2fa');
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAdmin2FA redirects admins without fresh verification', () => {
    const req = { user: { role: 'ADMIN', twoFactorSecret: 'secret' }, session: {} };
    const res = makeRes();
    const next = jest.fn();
    requireAdmin2FA(req, res, next);
    expect(req.session.flash).toEqual({
      type: 'warning',
      message: 'Admin verification required.',
    });
    expect(res.redirect).toHaveBeenCalledWith('/auth/2fa');
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAdmin2FA allows verified admins using the session contract', () => {
    const req = {
      user: { role: 'ADMIN', twoFactorSecret: 'secret' },
      session: { admin2FAVerified: true },
    };
    const res = makeRes();
    const next = jest.fn();
    requireAdmin2FA(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requireVerified redirects unauthenticated and unverified users', () => {
    const unauthReq = { user: null, session: {}, originalUrl: '/whale/sell' };
    const unauthRes = makeRes();
    const unauthNext = jest.fn();
    requireVerified(unauthReq, unauthRes, unauthNext);
    expect(unauthRes.redirect).toHaveBeenCalledWith('/auth/login?next=%2Fwhale%2Fsell');

    const unverifiedReq = { user: { id: 'u1', isVerified: false }, session: {}, originalUrl: '/x' };
    const unverifiedRes = makeRes();
    const unverifiedNext = jest.fn();
    requireVerified(unverifiedReq, unverifiedRes, unverifiedNext);
    expect(unverifiedReq.session.flash).toEqual({
      type: 'warning',
      message: 'Please verify your email before using this action.',
    });
    expect(unverifiedRes.redirect).toHaveBeenCalledWith('/profile');
    expect(unverifiedNext).not.toHaveBeenCalled();
  });

  test('requireVerified allows verified users', () => {
    const req = { user: { id: 'u1', isVerified: true }, session: {}, originalUrl: '/x' };
    const res = makeRes();
    const next = jest.fn();
    requireVerified(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requirePro redirects when no user', async () => {
    const req = { user: null, originalUrl: '/sell', session: {} };
    const res = makeRes();
    const next = jest.fn();
    await requirePro(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/auth/login?next=%2Fsell');
  });

  test('requirePro allows admin', async () => {
    const req = { user: { id: 'a1', role: 'ADMIN' }, originalUrl: '/sell', session: {} };
    const res = makeRes();
    const next = jest.fn();
    await requirePro(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requirePro allows active pro from req.user.subscription', async () => {
    const req = {
      user: {
        id: 'u1',
        role: 'MEMBER',
        subscription: { plan: 'pro', paidUntil: new Date(Date.now() + 100000), trialEndsAt: null },
      },
      originalUrl: '/sell',
      session: {},
    };
    const res = makeRes();
    const next = jest.fn();
    await requirePro(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requirePro redirects to upgrade when subscription missing', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    const req = { user: { id: 'u1', role: 'MEMBER' }, originalUrl: '/sell', session: {} };
    const res = makeRes();
    const next = jest.fn();
    await requirePro(req, res, next);
    expect(req.session.flash).toEqual({ type: 'warning', message: 'flash.pro_required' });
    expect(res.redirect).toHaveBeenCalledWith('/upgrade');
  });

  test('requirePro redirects to upgrade when subscription expired', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      plan: 'pro',
      paidUntil: new Date(Date.now() - 100000),
      trialEndsAt: new Date(Date.now() - 100000),
    });
    const req = { user: { id: 'u1', role: 'MEMBER' }, originalUrl: '/sell', session: {} };
    const res = makeRes();
    const next = jest.fn();
    await requirePro(req, res, next);
    expect(res.redirect).toHaveBeenCalledWith('/upgrade');
  });

  test('requirePro allows valid trial', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      plan: 'free',
      paidUntil: null,
      trialEndsAt: new Date(Date.now() + 100000),
    });
    const req = { user: { id: 'u1', role: 'MEMBER' }, originalUrl: '/sell', session: {} };
    const res = makeRes();
    const next = jest.fn();
    await requirePro(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requirePro passes error to next on failure', async () => {
    const err = new Error('db fail');
    prisma.subscription.findUnique.mockRejectedValue(err);
    const req = { user: { id: 'u1', role: 'MEMBER' }, originalUrl: '/sell', session: {} };
    const res = makeRes();
    const next = jest.fn();
    await requirePro(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('requireOrderParty handles not found, forbidden, and allowed', async () => {
    const res1 = makeRes();
    const next1 = jest.fn();
    prisma.order.findUnique.mockResolvedValueOnce(null);
    await requireOrderParty(
      { params: { id: 'o1' }, user: { id: 'u1', role: 'MEMBER' } },
      res1,
      next1
    );
    expect(res1.statusCode).toBe(404);
    expect(res1.render).toHaveBeenCalledWith('404', { title: '404' });

    const res2 = makeRes();
    const next2 = jest.fn();
    prisma.order.findUnique.mockResolvedValueOnce({ id: 'o2', buyerId: 'b1', sellerId: 's1' });
    await requireOrderParty(
      { params: { id: 'o2' }, user: { id: 'x1', role: 'MEMBER' } },
      res2,
      next2
    );
    expect(res2.statusCode).toBe(403);
    expect(res2.render).toHaveBeenCalledWith('error', expect.objectContaining({ status: 403 }));

    const req3 = { params: { id: 'o3' }, user: { id: 'b1', role: 'MEMBER' } };
    const res3 = makeRes();
    const next3 = jest.fn();
    prisma.order.findUnique.mockResolvedValueOnce({ id: 'o3', buyerId: 'b1', sellerId: 's1' });
    await requireOrderParty(req3, res3, next3);
    expect(req3.order).toEqual({ id: 'o3', buyerId: 'b1', sellerId: 's1' });
    expect(next3).toHaveBeenCalledTimes(1);
  });

  test('requireOrderParty passes db error to next', async () => {
    const err = new Error('order db fail');
    prisma.order.findUnique.mockRejectedValueOnce(err);
    const req = { params: { id: 'o1' }, user: { id: 'u1', role: 'MEMBER' } };
    const res = makeRes();
    const next = jest.fn();
    await requireOrderParty(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('requireSeller handles missing, forbidden, and allowed', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(null);
    const res1 = makeRes();
    const next1 = jest.fn();
    await requireSeller({ params: { id: 'o1' }, user: { id: 'u1', role: 'MEMBER' } }, res1, next1);
    expect(res1.statusCode).toBe(404);

    prisma.order.findUnique.mockResolvedValueOnce({ id: 'o2', sellerId: 's1', buyerId: 'b1' });
    const res2 = makeRes();
    const next2 = jest.fn();
    await requireSeller({ params: { id: 'o2' }, user: { id: 'u1', role: 'MEMBER' } }, res2, next2);
    expect(res2.statusCode).toBe(403);

    const req3 = {
      order: { id: 'o3', sellerId: 's1', buyerId: 'b1' },
      params: { id: 'o3' },
      user: { id: 's1', role: 'MEMBER' },
    };
    const res3 = makeRes();
    const next3 = jest.fn();
    await requireSeller(req3, res3, next3);
    expect(req3.order.id).toBe('o3');
    expect(next3).toHaveBeenCalledTimes(1);
  });

  test('requireBuyer handles missing, forbidden, and allowed', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(null);
    const res1 = makeRes();
    const next1 = jest.fn();
    await requireBuyer({ params: { id: 'o1' }, user: { id: 'u1', role: 'MEMBER' } }, res1, next1);
    expect(res1.statusCode).toBe(404);

    prisma.order.findUnique.mockResolvedValueOnce({ id: 'o2', sellerId: 's1', buyerId: 'b1' });
    const res2 = makeRes();
    const next2 = jest.fn();
    await requireBuyer({ params: { id: 'o2' }, user: { id: 'u1', role: 'MEMBER' } }, res2, next2);
    expect(res2.statusCode).toBe(403);

    const req3 = {
      order: { id: 'o3', sellerId: 's1', buyerId: 'b1' },
      params: { id: 'o3' },
      user: { id: 'b1', role: 'MEMBER' },
    };
    const res3 = makeRes();
    const next3 = jest.fn();
    await requireBuyer(req3, res3, next3);
    expect(req3.order.id).toBe('o3');
    expect(next3).toHaveBeenCalledTimes(1);
  });

  test('requireOwner handles missing, forbidden, allowed, and error', async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(null);
    const res1 = makeRes();
    const next1 = jest.fn();
    await requireOwner({ params: { id: 'l1' }, user: { id: 'u1', role: 'MEMBER' } }, res1, next1);
    expect(res1.statusCode).toBe(404);

    prisma.listing.findUnique.mockResolvedValueOnce({ id: 'l2', sellerId: 's1' });
    const res2 = makeRes();
    const next2 = jest.fn();
    await requireOwner({ params: { id: 'l2' }, user: { id: 'u1', role: 'MEMBER' } }, res2, next2);
    expect(res2.statusCode).toBe(403);

    prisma.listing.findUnique.mockResolvedValueOnce({ id: 'l3', sellerId: 'u1' });
    const req3 = { params: { id: 'l3' }, user: { id: 'u1', role: 'MEMBER' } };
    const res3 = makeRes();
    const next3 = jest.fn();
    await requireOwner(req3, res3, next3);
    expect(req3.listing).toEqual({ id: 'l3', sellerId: 'u1' });
    expect(next3).toHaveBeenCalledTimes(1);

    const err = new Error('listing db fail');
    prisma.listing.findUnique.mockRejectedValueOnce(err);
    const res4 = makeRes();
    const next4 = jest.fn();
    await requireOwner({ params: { id: 'l4' }, user: { id: 'u1', role: 'MEMBER' } }, res4, next4);
    expect(next4).toHaveBeenCalledWith(err);
  });
});
