import AsyncStorage from "@react-native-async-storage/async-storage";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // TTL in milliseconds
}

const CACHE_PREFIX = "@leyline_cache:";

/**
 * Simple caching layer using AsyncStorage
 */
export const cache = {
  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      const now = Date.now();

      // Check if expired
      if (now - entry.timestamp > entry.ttl) {
        // Expired, remove from cache
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  },

  /**
   * Set a cached value with TTL in minutes
   */
  async set<T>(key: string, data: T, ttlMinutes: number): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMinutes * 60 * 1000,
      };
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch (error) {
      console.warn("Cache set failed:", error);
    }
  },

  /**
   * Remove a cached value
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch {
      // Ignore
    }
  },

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch {
      // Ignore
    }
  },

  /**
   * Invalidate cache entries matching a prefix
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const matchingKeys = keys.filter((k) =>
        k.startsWith(`${CACHE_PREFIX}${prefix}`)
      );
      await AsyncStorage.multiRemove(matchingKeys);
    } catch {
      // Ignore
    }
  },
};

// Cache keys
export const CACHE_KEYS = {
  DECKS_LIST: "decks:list",
  DECK_DETAIL: (id: string) => `decks:detail:${id}`,
  COLLECTION_STATS: "collection:stats",
  ARCHIDEKT_STATUS: "archidekt:status",
  VIEW_MODE: "preferences:viewMode",
  SEARCH_STATE_DECK: (deckId: string) => `search:state:deck:${deckId}`,
  SEARCH_STATE_COLLECTION: "search:state:collection",
};

// TTL values in minutes
export const CACHE_TTL = {
  DECKS_LIST: 5,
  DECK_DETAIL: 10,
  COLLECTION_STATS: 5,
  ARCHIDEKT_STATUS: 1,
};

/**
 * Cached API wrapper - fetches from cache first, then API
 */
export async function cachedFetch<T>(
  key: string,
  ttlMinutes: number,
  fetchFn: () => Promise<{ data?: T; error?: string }>
): Promise<{ data?: T; error?: string; fromCache?: boolean }> {
  // Try cache first
  const cached = await cache.get<T>(key);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  // Fetch from API
  const result = await fetchFn();

  // Cache successful responses
  if (result.data) {
    await cache.set(key, result.data, ttlMinutes);
  }

  return result;
}
