/**
 * Search criteria for local card search with Scryfall-inspired syntax
 */

export type ComparisonOperator = '=' | '!=' | '<' | '>' | '<=' | '>=';
export type ColorOperator = '=' | ':' | '<' | '>' | '<=' | '>=';

/**
 * Structured search criteria parsed from Scryfall syntax
 */
export interface SearchCriteria {
  // Text searches (partial match, case-insensitive)
  name?: string;
  oracleText?: string[]; // Multiple o: terms are AND'd together

  // Array filters (color matching)
  // NOTE: colorIdentity is used by default for c: keyword (user decision)
  colorIdentity?: {
    values: string[]; // ['W', 'U', 'R', 'B', 'G']
    operator: ColorOperator;
    isMulticolor?: boolean; // true when c:m is used (2+ colors)
    isColorless?: boolean; // true when c:c is used (0 colors)
  };

  // Numeric comparisons
  cmc?: { value: number; operator: ComparisonOperator };
  power?: { value: number | string; operator: ComparisonOperator };
  toughness?: { value: number | string; operator: ComparisonOperator };
  loyalty?: { value: number; operator: ComparisonOperator };
  priceUsd?: { value: number; operator: ComparisonOperator };

  // Exact/partial text matches
  typeLine?: string[]; // Multiple t: terms are AND'd together
  rarity?: string[]; // ['rare', 'mythic', 'common', 'uncommon']
  setCode?: string[]; // ['neo', 'mkm', 'otj']
  collectorNumber?: string;

  // Layout/special types
  layout?: string[]; // ['transform', 'modal_dfc', 'normal', 'split']
  excludeLayouts?: string[]; // ['token', 'emblem', 'art_series'] - playable cards only

  // Metadata
  rawQuery?: string; // Original Scryfall syntax query for reference
}

/**
 * Search result structure matching existing Scryfall API response format
 */
export interface SearchResult {
  cards: any[]; // Array of Card entities
  hasMore: boolean;
  totalCards: number;
  page?: number;
}

/**
 * Helper type for color abbreviations mapping
 */
export const COLOR_ABBREVIATIONS: Record<string, string> = {
  w: 'W',
  u: 'U',
  b: 'B',
  r: 'R',
  g: 'G',
  c: 'C', // colorless
  m: 'M', // multicolor (special case)
};

/**
 * Rarity values
 */
export const RARITY_VALUES = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'] as const;

/**
 * Non-playable card layouts to exclude by default
 */
export const NON_PLAYABLE_LAYOUTS = ['token', 'emblem', 'art_series', 'double_faced_token'];

/**
 * DFC (Double-Faced Card) layouts
 */
export const DFC_LAYOUTS = ['transform', 'modal_dfc', 'reversible_card', 'double_faced_token'];
