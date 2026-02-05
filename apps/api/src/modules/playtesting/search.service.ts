import { Injectable } from '@nestjs/common';
import type {
  ExtendedGameCard,
  ExtendedGameZone,
  FullPlaytestGameState,
  PlayerId,
} from '@decktutor/shared';

/**
 * Criteria for searching cards in a zone
 */
export interface SearchCriteria {
  name?: string; // Exact name match
  nameContains?: string; // Partial name match
  supertype?: string; // e.g., "Basic", "Legendary", "Snow"
  type?: string; // e.g., "Land", "Creature", "Artifact"
  subtype?: string; // e.g., "Forest", "Soldier", "Equipment"
  colors?: string[]; // Exact color match (e.g., ["W", "U"])
  colorIdentity?: string[]; // Color identity match
  cmc?: number; // Exact converted mana cost
  cmcLessThan?: number;
  cmcGreaterThan?: number;
  power?: string;
  toughness?: string;
  keywords?: string[]; // Card must have all these keywords
  isToken?: boolean; // Filter by token status
  custom?: (card: ExtendedGameCard) => boolean; // Custom filter function
}

@Injectable()
export class SearchService {
  /**
   * Search a specific zone for cards matching criteria
   * @param state - The current game state
   * @param player - The player whose zone to search
   * @param zone - The zone to search
   * @param criteria - Search criteria
   * @param maxResults - Maximum number of results (0 = unlimited)
   * @returns Array of card instance IDs matching the criteria
   */
  searchZone(
    state: FullPlaytestGameState,
    player: PlayerId,
    zone: ExtendedGameZone,
    criteria: SearchCriteria,
    maxResults: number = 0,
  ): string[] {
    let cardIds: string[];

    // Get the appropriate card list for the zone
    switch (zone) {
      case 'library':
        cardIds = state[player].libraryOrder;
        break;
      case 'hand':
        cardIds = state[player].handOrder;
        break;
      case 'battlefield':
        cardIds = state.battlefieldOrder[player];
        break;
      case 'graveyard':
        cardIds = state[player].graveyardOrder;
        break;
      case 'exile':
        cardIds = state[player].exileOrder;
        break;
      case 'command':
        cardIds = state[player].commandZone;
        break;
      default:
        return [];
    }

    return this.filterCards(state, cardIds, criteria, maxResults);
  }

  /**
   * Search library for cards matching criteria
   * @param state - The current game state
   * @param player - The player whose library to search
   * @param criteria - Search criteria
   * @param maxResults - Maximum number of results (0 = unlimited)
   * @returns Array of card instance IDs matching the criteria
   */
  searchLibrary(
    state: FullPlaytestGameState,
    player: PlayerId,
    criteria: SearchCriteria,
    maxResults: number = 0,
  ): string[] {
    return this.searchZone(state, player, 'library', criteria, maxResults);
  }

  /**
   * Search battlefield for cards matching criteria
   * Can search across all players' battlefields
   * @param state - The current game state
   * @param criteria - Search criteria
   * @param owner - Optional: only search this player's battlefield
   * @param maxResults - Maximum number of results (0 = unlimited)
   * @returns Array of card instance IDs matching the criteria
   */
  searchBattlefield(
    state: FullPlaytestGameState,
    criteria: SearchCriteria,
    owner?: PlayerId,
    maxResults: number = 0,
  ): string[] {
    if (owner) {
      return this.searchZone(state, owner, 'battlefield', criteria, maxResults);
    }

    // Search both battlefields
    const playerCards = state.battlefieldOrder.player;
    const opponentCards = state.battlefieldOrder.opponent;
    const allCards = [...playerCards, ...opponentCards];

    return this.filterCards(state, allCards, criteria, maxResults);
  }

  /**
   * Filter a list of card IDs by criteria
   * @param state - The current game state
   * @param cardIds - Array of card instance IDs to filter
   * @param criteria - Search criteria
   * @param maxResults - Maximum number of results (0 = unlimited)
   * @returns Filtered array of card instance IDs
   */
  private filterCards(
    state: FullPlaytestGameState,
    cardIds: string[],
    criteria: SearchCriteria,
    maxResults: number,
  ): string[] {
    const matches: string[] = [];

    for (const cardId of cardIds) {
      const card = state.cards[cardId];
      if (!card) continue;

      if (!this.matchesCriteria(card, criteria)) continue;

      matches.push(cardId);
      if (maxResults > 0 && matches.length >= maxResults) break;
    }

    return matches;
  }

  /**
   * Check if a card matches search criteria
   * @param card - The card to check
   * @param criteria - Search criteria
   * @returns True if the card matches all criteria
   */
  private matchesCriteria(
    card: ExtendedGameCard,
    criteria: SearchCriteria,
  ): boolean {
    // Exact name match
    if (criteria.name && card.name !== criteria.name) {
      return false;
    }

    // Partial name match
    if (
      criteria.nameContains &&
      !card.name.toLowerCase().includes(criteria.nameContains.toLowerCase())
    ) {
      return false;
    }

    // Supertype match (e.g., "Basic", "Legendary")
    if (criteria.supertype && !card.typeLine?.includes(criteria.supertype)) {
      return false;
    }

    // Type match (e.g., "Land", "Creature")
    if (criteria.type && !card.typeLine?.includes(criteria.type)) {
      return false;
    }

    // Subtype match (e.g., "Forest", "Soldier")
    if (criteria.subtype && !card.typeLine?.includes(criteria.subtype)) {
      return false;
    }

    // Color match (exact)
    if (criteria.colors) {
      if (!this.arraysEqual(card.colors, criteria.colors)) {
        return false;
      }
    }

    // Color identity match
    if (criteria.colorIdentity) {
      if (!this.arraysEqual(card.colorIdentity, criteria.colorIdentity)) {
        return false;
      }
    }

    // CMC match
    if (criteria.cmc !== undefined && card.cmc !== criteria.cmc) {
      return false;
    }

    if (criteria.cmcLessThan !== undefined && card.cmc >= criteria.cmcLessThan) {
      return false;
    }

    if (
      criteria.cmcGreaterThan !== undefined &&
      card.cmc <= criteria.cmcGreaterThan
    ) {
      return false;
    }

    // Power match
    if (criteria.power && card.power !== criteria.power) {
      return false;
    }

    // Toughness match
    if (criteria.toughness && card.toughness !== criteria.toughness) {
      return false;
    }

    // Keywords match (card must have ALL specified keywords)
    if (criteria.keywords && criteria.keywords.length > 0) {
      for (const keyword of criteria.keywords) {
        if (!card.keywords.includes(keyword)) {
          return false;
        }
      }
    }

    // Token status match
    if (criteria.isToken !== undefined && card.isToken !== criteria.isToken) {
      return false;
    }

    // Custom filter function
    if (criteria.custom && !criteria.custom(card)) {
      return false;
    }

    return true;
  }

  /**
   * Helper to compare two arrays for equality (order-independent)
   */
  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, index) => val === sorted2[index]);
  }

  /**
   * Get valid targets for a spell or ability
   * @param state - The current game state
   * @param targetType - Type of target ("creature", "permanent", "player", etc.)
   * @param controller - The player casting the spell/activating ability
   * @returns Array of valid target IDs or player IDs
   */
  getValidTargets(
    state: FullPlaytestGameState,
    targetType: string,
    controller: PlayerId,
  ): string[] {
    const targets: string[] = [];

    if (targetType === 'player') {
      return ['player', 'opponent'];
    }

    // Search both battlefields for valid targets
    const allCards = [
      ...state.battlefieldOrder.player,
      ...state.battlefieldOrder.opponent,
    ];

    for (const cardId of allCards) {
      const card = state.cards[cardId];
      if (!card) continue;

      // Check if card matches target type
      if (targetType === 'creature' && card.typeLine?.includes('Creature')) {
        // Skip hexproof/shroud creatures unless controller owns them
        if (
          (card.keywords.includes('hexproof') ||
            card.keywords.includes('shroud')) &&
          card.controller !== controller
        ) {
          continue;
        }
        targets.push(cardId);
      } else if (targetType === 'permanent') {
        // Any permanent
        if (
          (card.keywords.includes('hexproof') ||
            card.keywords.includes('shroud')) &&
          card.controller !== controller
        ) {
          continue;
        }
        targets.push(cardId);
      } else if (
        targetType === 'artifact' &&
        card.typeLine?.includes('Artifact')
      ) {
        targets.push(cardId);
      } else if (
        targetType === 'enchantment' &&
        card.typeLine?.includes('Enchantment')
      ) {
        targets.push(cardId);
      }
      // Add more target types as needed
    }

    return targets;
  }
}
