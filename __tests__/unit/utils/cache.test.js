const { MemoryCache } = require('../../../utils/cache');

describe('MemoryCache', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryCache({ ttlMs: 100, maxSize: 5 });
  });

  describe('getOrSet', () => {
    it('calls factory on miss and caches result', async () => {
      const factory = jest.fn().mockResolvedValue('value1');
      const result = await cache.getOrSet('key1', factory);
      expect(result).toBe('value1');
      expect(factory).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await cache.getOrSet('key1', factory);
      expect(result2).toBe('value1');
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('calls factory again after TTL expires', async () => {
      const factory = jest.fn()
        .mockResolvedValueOnce('v1')
        .mockResolvedValueOnce('v2');

      await cache.getOrSet('key', factory);
      expect(factory).toHaveBeenCalledTimes(1);

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 150));

      const result = await cache.getOrSet('key', factory);
      expect(result).toBe('v2');
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe('set/get', () => {
    it('stores and retrieves values', () => {
      cache.set('a', 42);
      expect(cache.get('a')).toBe(42);
    });

    it('returns undefined for expired entries', async () => {
      cache.set('a', 42);
      await new Promise((r) => setTimeout(r, 150));
      expect(cache.get('a')).toBeUndefined();
    });

    it('evicts oldest entry when at capacity', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, i);
      }
      // All 5 should be present
      expect(cache.get('key0')).toBe(0);

      // Adding 6th should evict key0
      cache.set('key5', 5);
      expect(cache.get('key0')).toBeUndefined();
      expect(cache.get('key5')).toBe(5);
    });
  });

  describe('invalidate', () => {
    it('removes a specific key', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.invalidate('a');
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
    });
  });

  describe('invalidatePrefix', () => {
    it('removes all keys with matching prefix', () => {
      cache.set('user:1', 'alice');
      cache.set('user:2', 'bob');
      cache.set('post:1', 'hello');
      cache.invalidatePrefix('user:');
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('post:1')).toBe('hello');
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });
  });
});
