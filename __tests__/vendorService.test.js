/**
 * @group unit
 * Vendor service unit tests
 */

// Set DATABASE_URL BEFORE requiring the service (hasDatabase is evaluated at load time)
const originalEnv = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgres://test';

// Stub prisma before requiring service
jest.mock('../lib/prisma', () => ({
  vendor: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  order: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
}));

const prisma = require('../lib/prisma');
const vendorService = require('../services/vendorService');

afterAll(() => { process.env.DATABASE_URL = originalEnv; });

afterEach(() => jest.clearAllMocks());

describe('vendorService', () => {
  describe('registerVendor', () => {
    it('throws VENDOR_EXISTS if user already has a vendor', async () => {
      prisma.vendor.findUnique.mockResolvedValueOnce({ id: 'v1' });
      await expect(vendorService.registerVendor('u1', { name: 'Test' }))
        .rejects.toThrow('VENDOR_EXISTS');
    });

    it('throws PRO_REQUIRED if user has no pro subscription', async () => {
      prisma.vendor.findUnique.mockResolvedValueOnce(null); // no existing vendor
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        subscription: { plan: 'free', paidUntil: null },
      });
      await expect(vendorService.registerVendor('u1', { name: 'Test' }))
        .rejects.toThrow('PRO_REQUIRED');
    });

    it('creates vendor with PENDING status for pro user', async () => {
      prisma.vendor.findUnique
        .mockResolvedValueOnce(null) // no existing vendor
        .mockResolvedValueOnce(null); // slug not taken
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        subscription: { plan: 'pro', paidUntil: new Date('2099-01-01') },
      });
      prisma.vendor.create.mockResolvedValueOnce({ id: 'v1', status: 'PENDING' });

      const result = await vendorService.registerVendor('u1', { name: 'My Store' });
      expect(result.status).toBe('PENDING');
      expect(prisma.vendor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING', userId: 'u1' }),
        })
      );
    });
  });

  describe('approveVendor', () => {
    it('updates status to APPROVED', async () => {
      prisma.vendor.update.mockResolvedValueOnce({ id: 'v1', status: 'APPROVED' });
      const result = await vendorService.approveVendor('v1');
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('suspendVendor', () => {
    it('updates status to SUSPENDED', async () => {
      prisma.vendor.update.mockResolvedValueOnce({ id: 'v1', status: 'SUSPENDED' });
      const result = await vendorService.suspendVendor('v1', 'violation');
      expect(result.status).toBe('SUSPENDED');
    });
  });

  describe('rejectVendor', () => {
    it('updates status to REJECTED', async () => {
      prisma.vendor.update.mockResolvedValueOnce({ id: 'v1', status: 'REJECTED' });
      const result = await vendorService.rejectVendor('v1');
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('listVendors', () => {
    it('returns paginated vendor list', async () => {
      prisma.vendor.findMany.mockResolvedValueOnce([{ id: 'v1' }]);
      prisma.vendor.count.mockResolvedValueOnce(1);

      const result = await vendorService.listVendors({ page: 1, limit: 25 });
      expect(result.vendors).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by status', async () => {
      prisma.vendor.findMany.mockResolvedValueOnce([]);
      prisma.vendor.count.mockResolvedValueOnce(0);

      await vendorService.listVendors({ status: 'PENDING' });
      expect(prisma.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING' } })
      );
    });
  });

  describe('updateVendor', () => {
    it('throws UNAUTHORIZED if userId does not match', async () => {
      prisma.vendor.findUnique.mockResolvedValueOnce({ id: 'v1', userId: 'u1' });
      await expect(vendorService.updateVendor('v1', 'u2', { name: 'New' }))
        .rejects.toThrow('UNAUTHORIZED');
    });

    it('updates allowed fields', async () => {
      prisma.vendor.findUnique.mockResolvedValueOnce({ id: 'v1', userId: 'u1' });
      prisma.vendor.update.mockResolvedValueOnce({ id: 'v1', name: 'New Name' });

      const result = await vendorService.updateVendor('v1', 'u1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });
  });

  describe('getVendorDashboard', () => {
    it('returns vendor stats', async () => {
      prisma.vendor.findUnique.mockResolvedValueOnce({ id: 'v1' });
      prisma.order.aggregate.mockResolvedValueOnce({ _sum: { amount: 500 }, _count: 10 });
      prisma.order.findMany.mockResolvedValueOnce([]);

      const result = await vendorService.getVendorDashboard('v1');
      expect(result.totalRevenue).toBe(500);
      expect(result.totalOrders).toBe(10);
    });
  });
});
