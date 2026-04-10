/**
 * @group unit
 * Currency service unit tests
 */

const originalEnv = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgres://test';

jest.mock('../lib/prisma', () => ({
  exchangeRate: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
}));

const prisma = require('../lib/prisma');
const currencyService = require('../services/currencyService');

afterAll(() => { process.env.DATABASE_URL = originalEnv; });
afterEach(() => jest.clearAllMocks());

describe('currencyService', () => {
  describe('getRate', () => {
    it('returns rate 1 for same currency (identity)', async () => {
      const result = await currencyService.getRate('USD', 'USD');
      expect(result.rate).toBe(1);
      expect(result.source).toBe('identity');
    });

    it('returns DB rate when available', async () => {
      prisma.exchangeRate.findUnique.mockResolvedValueOnce({ rate: 3.70 });
      const result = await currencyService.getRate('USD', 'ILS');
      expect(result.rate).toBe(3.70);
      expect(result.source).toBe('db');
    });

    it('falls back to hardcoded rate when DB has no entry', async () => {
      prisma.exchangeRate.findUnique.mockResolvedValueOnce(null);
      const result = await currencyService.getRate('USD', 'ILS');
      expect(result.rate).toBe(3.65);
      expect(result.source).toBe('fallback');
    });

    it('throws for unknown currency pair', async () => {
      prisma.exchangeRate.findUnique.mockResolvedValueOnce(null);
      await expect(currencyService.getRate('BTC', 'XYZ'))
        .rejects.toThrow('RATE_NOT_FOUND');
    });
  });

  describe('convert', () => {
    it('converts amount using DB rate', async () => {
      prisma.exchangeRate.findUnique.mockResolvedValueOnce({ rate: 3.65 });
      const result = await currencyService.convert(100, 'USD', 'ILS');
      expect(result.converted).toBe(365);
      expect(result.fromCur).toBe('USD');
      expect(result.toCur).toBe('ILS');
    });

    it('rounds to 2 decimal places', async () => {
      prisma.exchangeRate.findUnique.mockResolvedValueOnce({ rate: 3.333 });
      const result = await currencyService.convert(10, 'USD', 'ILS');
      expect(result.converted).toBe(33.33);
    });
  });

  describe('formatPrice', () => {
    it('formats USD price in English', () => {
      expect(currencyService.formatPrice(99.99, 'USD', 'en')).toBe('$99.99');
    });

    it('formats ILS price in Arabic (symbol after number)', () => {
      expect(currencyService.formatPrice(50, 'ILS', 'ar')).toBe('50.00 ₪');
    });

    it('uses currency code as fallback symbol', () => {
      expect(currencyService.formatPrice(10, 'GBP', 'en')).toBe('GBP10.00');
    });
  });

  describe('admin operations', () => {
    it('upsertRate calls prisma.upsert', async () => {
      prisma.exchangeRate.upsert.mockResolvedValueOnce({ fromCur: 'USD', toCur: 'ILS', rate: 3.70 });
      const result = await currencyService.upsertRate('USD', 'ILS', 3.70);
      expect(result.rate).toBe(3.70);
    });
  });
});
