import { useState, useEffect, useCallback } from 'react';
import { cache, CACHE_KEYS } from '../lib/cache';

/**
 * Saved search state structure
 */
export interface SavedSearchState {
  query: string;
  lastUsed: number;
  resultCount?: number;
}

/**
 * Hook to manage persistent search state per context (deck or collection)
 * Automatically loads saved search on mount and saves changes
 */
export function useSearchState(
  context: 'deck' | 'collection',
  contextId?: string
) {
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasSavedSearch, setHasSavedSearch] = useState(false);

  // Get cache key based on context
  const getCacheKey = useCallback(() => {
    if (context === 'deck' && contextId) {
      return CACHE_KEYS.SEARCH_STATE_DECK(contextId);
    }
    return CACHE_KEYS.SEARCH_STATE_COLLECTION;
  }, [context, contextId]);

  // Load saved search state on mount
  useEffect(() => {
    loadSearchState();
  }, [context, contextId]);

  const loadSearchState = async () => {
    try {
      setIsLoading(true);
      const cacheKey = getCacheKey();
      const saved = await cache.get<SavedSearchState>(cacheKey);

      if (saved) {
        setQuery(saved.query);
        setHasSavedSearch(true);
      } else {
        setQuery('');
        setHasSavedSearch(false);
      }
    } catch (error) {
      console.error('Failed to load search state:', error);
      setQuery('');
      setHasSavedSearch(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Save search state (no TTL - persistent until manually cleared)
  const saveSearchState = useCallback(
    async (newQuery: string, resultCount?: number) => {
      try {
        const cacheKey = getCacheKey();
        const state: SavedSearchState = {
          query: newQuery,
          lastUsed: Date.now(),
          resultCount,
        };

        // Set TTL to 30 days (43200 minutes)
        await cache.set(cacheKey, state, 43200);
        setHasSavedSearch(newQuery.length > 0);
      } catch (error) {
        console.error('Failed to save search state:', error);
      }
    },
    [getCacheKey]
  );

  // Update query and save state
  const updateQuery = useCallback(
    (newQuery: string, resultCount?: number) => {
      setQuery(newQuery);
      saveSearchState(newQuery, resultCount);
    },
    [saveSearchState]
  );

  // Clear saved search state
  const clearSearchState = useCallback(async () => {
    try {
      const cacheKey = getCacheKey();
      await cache.remove(cacheKey);
      setQuery('');
      setHasSavedSearch(false);
    } catch (error) {
      console.error('Failed to clear search state:', error);
    }
  }, [getCacheKey]);

  // Resume last search (loads from cache)
  const resumeLastSearch = useCallback(async () => {
    await loadSearchState();
  }, [loadSearchState]);

  return {
    query,
    setQuery: updateQuery,
    isLoading,
    hasSavedSearch,
    clearSearchState,
    resumeLastSearch,
  };
}
