jest.mock('../lib/prisma', () => ({
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  listing: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  refundRequest: {
    count: jest.fn(),
  },
}));

jest.mock('../services/whaleService', () => ({
  deleteListing: jest.fn(),
  transitionOrder: jest.fn(),
}));

jest.mock('../services/adminAuditService', () => ({
  log: jest.fn(),
  getLogs: jest.fn(),
  getCoupons: jest.fn(),
  createCoupon: jest.fn(),
  toggleCoupon: jest.fn(),
  getRefundRequests: jest.fn(),
  processRefund: jest.fn(),
}));

jest.mock('../services/authSecurityService', () => ({
  setupAdmin2FA: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const prisma = require('../lib/prisma');
const auditService = require('../services/adminAuditService');
const adminRouter = require('../routes/admin');

function createApp({ user = null, session = {} } = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    req.user = user;
    req.session = session;
    res.locals.t = (key) => key;
    res.render = (view, locals) => res.status(res.statusCode || 200).json({ view, locals });
    next();
  });
  app.use('/admin', adminRouter);
  return app;
}

describe('admin routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.count.mockResolvedValue(10);
    prisma.listing.count.mockResolvedValue(4);
    prisma.order.count.mockResolvedValue(3);
    prisma.order.aggregate.mockResolvedValue({ _sum: { amount: 99 } });
    prisma.refundRequest.count.mockResolvedValue(1);
  });

  test('GET /admin redirects admins with 2FA enabled to /auth/2fa until verified', async () => {
    const response = await request(
      createApp({
        user: { id: 'a1', role: 'ADMIN', adminScope: 'SUPER_ADMIN', twoFactorSecret: 'secret' },
        session: {},
      })
    ).get('/admin');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/2fa');
  });

  test('POST /admin/users/:id/ban allows SUPPORT_AGENT scope', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', username: 'member', isBanned: false });
    prisma.user.update.mockResolvedValue({ id: 'u2', isBanned: true });
    auditService.log.mockResolvedValue({});

    const response = await request(
      createApp({
        user: { id: 'a1', role: 'ADMIN', adminScope: 'SUPPORT_AGENT' },
        session: {},
      })
    )
      .post('/admin/users/u2/ban')
      .send({});

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/admin/users');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { isBanned: true },
    });
    expect(auditService.log).toHaveBeenCalled();
  });

  test('POST /admin/users/:id/ban blocks WAREHOUSE scope', async () => {
    const response = await request(
      createApp({
        user: { id: 'a1', role: 'ADMIN', adminScope: 'WAREHOUSE' },
        session: {},
      })
    )
      .post('/admin/users/u2/ban')
      .send({});

    expect(response.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
