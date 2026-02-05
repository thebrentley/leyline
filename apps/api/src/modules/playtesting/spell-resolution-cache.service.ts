import { Injectable } from '@nestjs/common';
import type { SpellAction } from './llm-spell-resolution.types';

/**
 * In-memory cache for LLM spell resolutions
 * Caches by card name to avoid redundant LLM calls for the same spell
 */
@Injectable()
export class SpellResolutionCacheService {
  private cache: Map<string, SpellAction[]> = new Map();
  private hits = 0;
  private misses = 0;

  /**
   * Get cached actions for a spell by card name
   */
  get(cardName: string): SpellAction[] | null {
    const normalizedName = this.normalizeCardName(cardName);
    const actions = this.cache.get(normalizedName);

    if (actions) {
      this.hits++;
      return actions;
    }

    this.misses++;
    return null;
  }

  /**
   * Cache actions for a spell by card name
   */
  set(cardName: string, actions: SpellAction[]): void {
    const normalizedName = this.normalizeCardName(cardName);
    this.cache.set(normalizedName, actions);
  }

  /**
   * Check if a spell is cached
   */
  has(cardName: string): boolean {
    const normalizedName = this.normalizeCardName(cardName);
    return this.cache.has(normalizedName);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }

  /**
   * Normalize card name for consistent cache keys
   * (lowercase, trim whitespace)
   */
  private normalizeCardName(cardName: string): string {
    return cardName.toLowerCase().trim();
  }
}
