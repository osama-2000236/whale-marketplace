/**
 * @group unit
 * Shipping service unit tests
 */

const originalEnv = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgres://test';

jest.mock('../lib/prisma', () => ({
  shippingZone: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  shippingRate: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../lib/prisma');
const shippingService = require('../services/shippingService');

afterAll(() => { process.env.DATABASE_URL = originalEnv; });
afterEach(() => jest.clearAllMocks());

describe('shippingService', () => {
  describe('calculateShipping', () => {
    it('returns matching zone rate for city and weight', async () => {
      prisma.shippingZone.findMany.mockResolvedValueOnce([
        {
          id: 'z1',
          name: 'Gaza Strip',
          cities: ['Gaza', 'Khan Yunis', 'Rafah'],
          isActive: true,
          rates: [
            { id: 'r1', carrier: 'aramex', weightMin: 0, weightMax: 5, cost: 15, currency: 'ILS', freeAbove: 200, estDays: '2-3', isActive: true },
            { id: 'r2', carrier: 'aramex', weightMin: 5, weightMax: 20, cost: 25, currency: 'ILS', freeAbove: null, estDays: '2-3', isActive: true },
          ],
        },
      ]);

      const result = await shippingService.calculateShipping('Gaza', 3);
      expect(result.cost).toBe(15);
      expect(result.carrier).toBe('aramex');
      expect(result.freeAbove).toBe(200);
    });

    it('returns zero cost if city not in any zone', async () => {
      prisma.shippingZone.findMany.mockResolvedValueOnce([
        { id: 'z1', name: 'Gaza Strip', cities: ['Gaza'], isActive: true, rates: [] },
      ]);

      const result = await shippingService.calculateShipping('Unknown City', 1);
      expect(result.cost).toBe(0);
    });

    it('falls back to highest weight range if no exact match', async () => {
      prisma.shippingZone.findMany.mockResolvedValueOnce([
        {
          id: 'z1',
          name: 'West Bank',
          cities: ['Ramallah'],
          isActive: true,
          rates: [
            { id: 'r1', carrier: 'local', weightMin: 0, weightMax: 5, cost: 10, currency: 'ILS', freeAbove: null, estDays: null, isActive: true },
          ],
        },
      ]);

      const result = await shippingService.calculateShipping('Ramallah', 50);
      expect(result.cost).toBe(10); // falls back to last rate
    });
  });

  describe('qualifiesForFreeShipping', () => {
    it('returns true when subtotal >= freeAbove', () => {
      expect(shippingService.qualifiesForFreeShipping({ freeAbove: 200 }, 250)).toBe(true);
    });

    it('returns false when subtotal < freeAbove', () => {
      expect(shippingService.qualifiesForFreeShipping({ freeAbove: 200 }, 150)).toBe(false);
    });

    it('returns false when freeAbove is null', () => {
      expect(shippingService.qualifiesForFreeShipping({ freeAbove: null }, 1000)).toBe(false);
    });
  });

  describe('CRUD operations', () => {
    it('createShippingZone calls prisma.create', async () => {
      prisma.shippingZone.create.mockResolvedValueOnce({ id: 'z1', name: 'Test Zone' });
      const result = await shippingService.createShippingZone({ name: 'Test Zone', cities: ['Gaza'] });
      expect(result.name).toBe('Test Zone');
    });

    it('createShippingRate calls prisma.create with zoneId', async () => {
      prisma.shippingRate.create.mockResolvedValueOnce({ id: 'r1', zoneId: 'z1' });
      const result = await shippingService.createShippingRate('z1', { carrier: 'aramex', cost: 15 });
      expect(result.zoneId).toBe('z1');
    });

    it('deleteShippingZone calls prisma.delete', async () => {
      prisma.shippingZone.delete.mockResolvedValueOnce({ id: 'z1' });
      await shippingService.deleteShippingZone('z1');
      expect(prisma.shippingZone.delete).toHaveBeenCalledWith({ where: { id: 'z1' } });
    });
  });
});
