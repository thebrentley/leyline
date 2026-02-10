import { Injectable, Inject, forwardRef } from '@nestjs/common';
import type {
  FullPlaytestGameState,
  PlayerId,
  StackItem,
  PlaytestEvent,
} from '@leyline/shared';
import { GameEngineService } from './game-engine.service';
import { TokensService } from './tokens.service';
import { SearchService } from './search.service';
import type {
  SpellAction,
  CreateTokenAction,
  SearchLibraryAction,
  MoveCardAction,
  DealDamageAction,
  DrawCardAction,
  DestroyPermanentAction,
  ShuffleLibraryAction,
  RevealCardAction,
  LogMessageAction,
  ExileUntilLeavesAction,
} from './llm-spell-resolution.types';

/**
 * Executes LLM spell action sequences by calling game engine services
 * Handles variable substitution for targets and search results
 */
@Injectable()
export class ActionExecutorService {
  constructor(
    @Inject(forwardRef(() => GameEngineService))
    private gameEngine: GameEngineService,
    private tokensService: TokensService,
    private searchService: SearchService,
  ) {}

  /**
   * Execute a sequence of spell actions
   */
  async executeActions(
    actions: SpellAction[],
    state: FullPlaytestGameState,
    stackItem: StackItem,
    controller: PlayerId,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];
    const context: ExecutionContext = {
      searchResults: [],
      targets: this.extractTargets(stackItem),
      sourceCardId: stackItem.sourceCardId,
    };

    for (const action of actions) {
      try {
        const actionEvents = await this.executeAction(
          action,
          state,
          controller,
          context,
        );
        events.push(...actionEvents);
      } catch (error) {
        console.error(`[ActionExecutor] Error executing action:`, action, error);
        // Continue with remaining actions on error (graceful degradation)
      }
    }

    return events;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: SpellAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
    context: ExecutionContext,
  ): Promise<PlaytestEvent[]> {
    switch (action.type) {
      case 'createToken':
        return this.executeCreateToken(action, state, controller);
      case 'searchLibrary':
        return await this.executeSearchLibrary(
          action,
          state,
          controller,
          context,
        );
      case 'moveCard':
        return this.executeMoveCard(action, state, controller, context);
      case 'dealDamage':
        return this.executeDealDamage(action, state, controller, context);
      case 'drawCard':
        return this.executeDrawCard(action, state, controller);
      case 'destroyPermanent':
        return this.executeDestroyPermanent(action, state, context);
      case 'shuffleLibrary':
        return this.executeShuffleLibrary(action, state, controller);
      case 'revealCard':
        return this.executeRevealCard(action, state, controller, context);
      case 'logMessage':
        return this.executeLogMessage(action, state, controller);
      case 'exileUntilSourceLeaves':
        return this.executeExileUntilSourceLeaves(action, state, controller, context);
      default:
        console.warn('[ActionExecutor] Unknown action type:', action);
        return [];
    }
  }

  /**
   * Create token(s)
   */
  private async executeCreateToken(
    action: CreateTokenAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];
    const actualController = this.resolvePlayer(action.controller, controller);

    if (action.tokenId) {
      // Use predefined token from database
      const tokenIds = await this.tokensService.createTokens(
        state,
        action.tokenId,
        actualController,
        action.quantity,
      );

      if (tokenIds.length > 0) {
        const tokenName = action.tokenId; // Could look up actual name from database
        events.push({
          type: 'token:created',
          tokenIds,
          tokenName,
          controller: actualController,
        });

        this.gameEngine.addLogEntry(state, events, {
          type: 'action',
          player: actualController,
          message: `${this.playerName(actualController)} creates ${action.quantity} ${tokenName} token${action.quantity > 1 ? 's' : ''}`,
        });
      }
    } else if (action.custom) {
      // Create custom token
      const tokenIds = this.tokensService.createCustomTokens(
        state,
        actualController,
        {
          name: action.custom.name,
          typeLine: action.custom.typeLine,
          oracleText: action.custom.oracleText,
          power: action.custom.power,
          toughness: action.custom.toughness,
          colors: action.custom.colors,
          keywords: action.custom.keywords,
        },
        action.quantity,
      );

      if (tokenIds.length > 0) {
        events.push({
          type: 'token:created',
          tokenIds,
          tokenName: action.custom.name,
          controller: actualController,
        });

        this.gameEngine.addLogEntry(state, events, {
          type: 'action',
          player: actualController,
          message: `${this.playerName(actualController)} creates ${action.quantity} ${action.custom.name} token${action.quantity > 1 ? 's' : ''}`,
        });
      }
    }

    return events;
  }

  /**
   * Search library for cards
   */
  private async executeSearchLibrary(
    action: SearchLibraryAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
    context: ExecutionContext,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];
    const actualPlayer = this.resolvePlayer(action.player, controller);

    // Search library
    const foundCards = this.searchService.searchLibrary(
      state,
      actualPlayer,
      action.criteria,
      action.maxResults,
    );

    // Store search results for later actions
    context.searchResults.push(...foundCards);

    // Reveal cards if specified
    if (action.reveal && foundCards.length > 0) {
      for (const cardId of foundCards) {
        const card = state.cards[cardId];
        if (card) {
          this.gameEngine.addLogEntry(state, events, {
            type: 'action',
            player: actualPlayer,
            message: `${this.playerName(actualPlayer)} reveals ${card.name}`,
          });
        }
      }
    }

    // Move cards to destination
    for (const cardId of foundCards) {
      const moveEvents = this.gameEngine.moveCard(
        state,
        cardId,
        action.destination,
        actualPlayer,
      );
      events.push(...moveEvents);
    }

    if (foundCards.length === 0) {
      this.gameEngine.addLogEntry(state, events, {
        type: 'action',
        player: actualPlayer,
        message: `${this.playerName(actualPlayer)} searches but finds no matching cards`,
      });
    }

    return events;
  }

  /**
   * Move a card between zones
   */
  private executeMoveCard(
    action: MoveCardAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
    context: ExecutionContext,
  ): Promise<PlaytestEvent[]> {
    const cardId = this.resolveCardIdentifier(action.cardIdentifier, context);
    if (!cardId) {
      console.warn('[ActionExecutor] Could not resolve card identifier:', action.cardIdentifier);
      return Promise.resolve([]);
    }

    const actualController = this.resolvePlayer(action.controller, controller);
    return Promise.resolve(
      this.gameEngine.moveCard(state, cardId, action.to, actualController),
    );
  }

  /**
   * Deal damage to player or creature
   */
  private executeDealDamage(
    action: DealDamageAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
    context: ExecutionContext,
  ): Promise<PlaytestEvent[]> {
    if (action.target === 'player') {
      return Promise.resolve(
        this.gameEngine.dealDamageToPlayer(state, controller, action.amount),
      );
    } else if (action.target === 'opponent') {
      const opponent = controller === 'player' ? 'opponent' : 'player';
      return Promise.resolve(
        this.gameEngine.dealDamageToPlayer(state, opponent, action.amount),
      );
    } else if (action.target === 'creature' && action.targetId) {
      const cardId = this.resolveCardIdentifier(action.targetId, context);
      if (!cardId) {
        console.warn('[ActionExecutor] Could not resolve target:', action.targetId);
        return Promise.resolve([]);
      }
      return Promise.resolve(
        this.gameEngine.dealDamageToCreature(state, cardId, action.amount),
      );
    }

    return Promise.resolve([]);
  }

  /**
   * Draw card(s)
   */
  private executeDrawCard(
    action: DrawCardAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];
    const actualPlayer = this.resolvePlayer(action.player, controller);

    for (let i = 0; i < action.count; i++) {
      const drawEvents = this.gameEngine.drawCard(state, actualPlayer);
      events.push(...drawEvents);
    }

    return Promise.resolve(events);
  }

  /**
   * Destroy a permanent
   */
  private executeDestroyPermanent(
    action: DestroyPermanentAction,
    state: FullPlaytestGameState,
    context: ExecutionContext,
  ): Promise<PlaytestEvent[]> {
    const cardId = this.resolveCardIdentifier(action.targetId, context);
    if (!cardId) {
      console.warn('[ActionExecutor] Could not resolve target:', action.targetId);
      return Promise.resolve([]);
    }

    return Promise.resolve(
      this.gameEngine.destroyPermanent(state, cardId, action.reason),
    );
  }

  /**
   * Shuffle library
   */
  private executeShuffleLibrary(
    action: ShuffleLibraryAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];
    const actualPlayer = this.resolvePlayer(action.player, controller);

    // Fisher-Yates shuffle
    const library = state[actualPlayer].libraryOrder;
    for (let i = library.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [library[i], library[j]] = [library[j], library[i]];
    }

    events.push({
      type: 'zone:shuffled',
      zone: 'library',
      player: actualPlayer,
    });

    this.gameEngine.addLogEntry(state, events, {
      type: 'action',
      player: actualPlayer,
      message: `${this.playerName(actualPlayer)} shuffles their library`,
    });

    return Promise.resolve(events);
  }

  /**
   * Reveal a card
   */
  private executeRevealCard(
    action: RevealCardAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
    context: ExecutionContext,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];
    const cardId = this.resolveCardIdentifier(action.cardId, context);

    if (!cardId) {
      console.warn('[ActionExecutor] Could not resolve card:', action.cardId);
      return Promise.resolve([]);
    }

    const card = state.cards[cardId];
    if (card) {
      const actualPlayer = this.resolvePlayer(action.player, controller);
      this.gameEngine.addLogEntry(state, events, {
        type: 'action',
        player: actualPlayer,
        message: `${this.playerName(actualPlayer)} reveals ${card.name}`,
      });
    }

    return Promise.resolve(events);
  }

  /**
   * Log a message
   */
  private executeLogMessage(
    action: LogMessageAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];
    this.gameEngine.addLogEntry(state, events, {
      type: 'action',
      player: controller,
      message: action.message,
    });
    return Promise.resolve(events);
  }

  /**
   * Resolve 'self' or 'opponent' to actual PlayerId.
   * The LLM should always use 'self'/'opponent' as relative references,
   * but may sometimes return literal PlayerId values like 'player'.
   * Unexpected values default to the controller since most spell effects
   * affect the caster (e.g., "search YOUR library").
   */
  private resolvePlayer(
    relative: 'self' | 'opponent' | string,
    controller: PlayerId,
  ): PlayerId {
    if (relative === 'self') {
      return controller;
    } else if (relative === 'opponent') {
      return controller === 'player' ? 'opponent' : 'player';
    }
    // LLM returned an unexpected value (e.g., literal 'player' instead of 'self').
    // Default to controller since most spell effects affect the caster.
    console.warn(`[ActionExecutor] Unexpected player reference '${relative}', defaulting to controller '${controller}'`);
    return controller;
  }

  /**
   * Exile a permanent until the source card leaves the battlefield
   */
  private executeExileUntilSourceLeaves(
    action: ExileUntilLeavesAction,
    state: FullPlaytestGameState,
    controller: PlayerId,
    context: ExecutionContext,
  ): Promise<PlaytestEvent[]> {
    const cardId = this.resolveCardIdentifier(action.targetId, context);
    if (!cardId) {
      console.warn('[ActionExecutor] Could not resolve target for exileUntilSourceLeaves:', action.targetId);
      return Promise.resolve([]);
    }

    const targetCard = state.cards[cardId];
    if (!targetCard || targetCard.zone !== 'battlefield') {
      console.warn('[ActionExecutor] Target not on battlefield for exileUntilSourceLeaves:', cardId);
      return Promise.resolve([]);
    }

    const events: PlaytestEvent[] = [];
    const actualController = this.resolvePlayer(action.controller, controller);

    // Move the target to exile
    events.push(...this.gameEngine.moveCard(state, cardId, 'exile', actualController));

    // Register the linked exile so it returns when the source leaves
    if (!state.linkedExiles) state.linkedExiles = [];
    state.linkedExiles.push({
      sourceCardId: context.sourceCardId,
      exiledCardId: cardId,
      returnZone: 'battlefield',
    });

    return Promise.resolve(events);
  }

  /**
   * Resolve card identifier (handles $TARGET_N, $SEARCH_RESULT_N, or direct IDs)
   */
  private resolveCardIdentifier(
    identifier: string,
    context: ExecutionContext,
  ): string | null {
    // Handle $TARGET_N pattern
    const targetMatch = identifier.match(/^\$TARGET_(\d+)$/);
    if (targetMatch) {
      const index = parseInt(targetMatch[1]);
      if (context.targets[index]) {
        return context.targets[index].id;
      }
      return null;
    }

    // Handle $SEARCH_RESULT_N pattern
    const searchMatch = identifier.match(/^\$SEARCH_RESULT_(\d+)$/);
    if (searchMatch) {
      const index = parseInt(searchMatch[1]);
      return context.searchResults[index] || null;
    }

    // Direct card ID
    return identifier;
  }

  /**
   * Extract targets from stack item
   */
  private extractTargets(stackItem: StackItem): Array<{ type: string; id: string }> {
    return stackItem.targets || [];
  }

  /**
   * Get player name for log messages
   */
  private playerName(player: PlayerId): string {
    return player === 'player' ? 'Player' : 'Opponent';
  }
}

/**
 * Context for action execution (tracks state across actions)
 */
interface ExecutionContext {
  searchResults: string[]; // Card IDs from search actions
  targets: Array<{ type: string; id: string }>; // Targets from stack item
  sourceCardId: string; // The card that created this spell/ability
}
