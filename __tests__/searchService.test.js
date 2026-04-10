/**
 * @group unit
 * Search service unit tests
 */

const originalEnv = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgres://test';

jest.mock('../lib/prisma', () => ({
  $queryRawUnsafe: jest.fn(),
  $queryRaw: jest.fn(),
  searchLog: { create: jest.fn() },
}));

const prisma = require('../lib/prisma');
const searchService = require('../services/searchService');

afterAll(() => { process.env.DATABASE_URL = originalEnv; });
afterEach(() => jest.clearAllMocks());

describe('searchService', () => {
  describe('searchListings', () => {
    it('returns empty for blank query', async () => {
      const result = await searchService.searchListings('');
      expect(result.listings).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns empty for whitespace-only query', async () => {
      const result = await searchService.searchListings('   ');
      expect(result.listings).toEqual([]);
    });

    it('executes full-text search for valid query', async () => {
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 2 }])  // count query
        .mockResolvedValueOnce([               // data query
          { id: 'l1', title: 'iPhone 15' },
          { id: 'l2', title: 'iPhone 14' },
        ]);
      prisma.searchLog.create.mockResolvedValueOnce({});

      const result = await searchService.searchListings('iPhone', { locale: 'en' });
      expect(result.listings).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('uses simple config for Arabic locale', async () => {
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);
      prisma.searchLog.create.mockResolvedValueOnce({});

      await searchService.searchListings('هاتف', { locale: 'ar' });
      // Check the count query uses 'simple' config
      const countQuery = prisma.$queryRawUnsafe.mock.calls[0][0];
      expect(countQuery).toContain("'simple'");
    });

    it('uses english config for English locale', async () => {
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);
      prisma.searchLog.create.mockResolvedValueOnce({});

      await searchService.searchListings('phone', { locale: 'en' });
      const countQuery = prisma.$queryRawUnsafe.mock.calls[0][0];
      expect(countQuery).toContain("'english'");
    });

    it('applies category filter', async () => {
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);
      prisma.searchLog.create.mockResolvedValueOnce({});

      await searchService.searchListings('test', { categoryId: 'cat1' });
      const countQuery = prisma.$queryRawUnsafe.mock.calls[0][0];
      expect(countQuery).toContain('"categoryId"');
    });

    it('applies price range filters', async () => {
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);
      prisma.searchLog.create.mockResolvedValueOnce({});

      await searchService.searchListings('test', { minPrice: 10, maxPrice: 100 });
      const countQuery = prisma.$queryRawUnsafe.mock.calls[0][0];
      expect(countQuery).toContain('"price" >=');
      expect(countQuery).toContain('"price" <=');
    });
  });

  describe('logSearch', () => {
    it('creates search log entry', async () => {
      prisma.searchLog.create.mockResolvedValueOnce({ id: 's1' });
      const result = await searchService.logSearch('u1', 'phone', 5, 'en');
      expect(prisma.searchLog.create).toHaveBeenCalledWith({
        data: { userId: 'u1', query: 'phone', resultsCount: 5, locale: 'en' },
      });
    });
  });

  describe('getTrendingSearches', () => {
    it('returns trending queries', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { query: 'iphone', search_count: 50 },
        { query: 'samsung', search_count: 30 },
      ]);

      const result = await searchService.getTrendingSearches(7, 10);
      expect(result).toHaveLength(2);
      expect(result[0].query).toBe('iphone');
    });
  });
});
