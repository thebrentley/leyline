import type { ExtendedGameZone, PlayerId } from '@decktutor/shared';

/**
 * Action types that the LLM can specify to resolve spell effects
 * These map to existing game engine services
 */

export interface CreateTokenAction {
  type: 'createToken';
  tokenId?: string; // Predefined token ID like "food" or "soldier-1-1-white"
  custom?: {
    // For custom/variable tokens
    name: string;
    typeLine: string;
    oracleText?: string;
    power?: string;
    toughness?: string;
    colors?: string[];
    keywords?: string[];
  };
  controller: 'self' | 'opponent';
  quantity: number;
}

export interface SearchLibraryAction {
  type: 'searchLibrary';
  player: 'self' | 'opponent';
  criteria: {
    name?: string;
    nameContains?: string;
    supertype?: string; // "Basic", "Legendary"
    type?: string; // "Land", "Creature"
    subtype?: string; // "Forest", "Soldier"
    cmc?: number;
    cmcLessThan?: number;
    cmcGreaterThan?: number;
    colors?: string[];
  };
  maxResults: number;
  destination: 'hand' | 'battlefield' | 'graveyard' | 'exile';
  reveal?: boolean;
}

export interface MoveCardAction {
  type: 'moveCard';
  cardIdentifier: string; // Can be $SEARCH_RESULT_N, $TARGET_N, or specific card ID
  from: ExtendedGameZone;
  to: ExtendedGameZone;
  controller: 'self' | 'opponent';
}

export interface DealDamageAction {
  type: 'dealDamage';
  target: 'player' | 'opponent' | 'creature';
  targetId?: string; // Required for creature targets, can be $TARGET_N
  amount: number;
}

export interface DrawCardAction {
  type: 'drawCard';
  player: 'self' | 'opponent';
  count: number;
}

export interface DestroyPermanentAction {
  type: 'destroyPermanent';
  targetId: string; // Can be $TARGET_N or specific card ID
  reason: string;
}

export interface ShuffleLibraryAction {
  type: 'shuffleLibrary';
  player: 'self' | 'opponent';
}

export interface RevealCardAction {
  type: 'revealCard';
  cardId: string; // Can be $SEARCH_RESULT_N or specific card ID
  player: 'self' | 'opponent';
}

export interface LogMessageAction {
  type: 'logMessage';
  message: string;
}

/**
 * Union type of all possible spell actions
 */
export type SpellAction =
  | CreateTokenAction
  | SearchLibraryAction
  | MoveCardAction
  | DealDamageAction
  | DrawCardAction
  | DestroyPermanentAction
  | ShuffleLibraryAction
  | RevealCardAction
  | LogMessageAction;

/**
 * Response format expected from the LLM
 */
export interface LLMSpellResponse {
  actions: SpellAction[];
  reasoning?: string; // For debugging and logging
}

/**
 * Token usage tracking for cost monitoring
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}
