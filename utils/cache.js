/**
 * Simple in-memory TTL cache for Whale Marketplace.
 *
 * Not suitable for multi-instance deployments — use Redis if scaling horizontally.
 *
 * Usage:
 *   const { MemoryCache } = require('../utils/cache');
 *   const cache = new MemoryCache({ ttlMs: 60_000 }); // 60-second TTL
 *   const value = await cache.getOrSet('key', async () => expensiveQuery());
 */

class MemoryCache {
  /**
   * @param {object} options
   * @param {number} options.ttlMs - Time-to-live in milliseconds (default 60s)
   * @param {number} options.maxSize - Maximum entries before oldest are evicted (default 500)
   */
  constructor({ ttlMs = 60_000, maxSize = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.store = new Map();
  }

  /**
   * Get a cached value, or compute and cache it if missing/expired.
   * @param {string} key
   * @param {() => Promise<any>} factory - Async function to produce the value on cache miss
   * @returns {Promise<any>}
   */
  async getOrSet(key, factory) {
    const cached = this.store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await factory();
    this.set(key, value);
    return value;
  }

  set(key, value) {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  get(key) {
    const cached = this.store.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return cached.value;
  }

  invalidate(key) {
    this.store.delete(key);
  }

  /** Invalidate all keys matching a prefix */
  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

module.exports = { MemoryCache };
