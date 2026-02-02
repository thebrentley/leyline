import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Deck } from '../../entities/deck.entity';
import { EventsGateway } from '../events/events.gateway';
import { GameLoopService } from './game-loop.service';
import { KeywordAbilitiesService } from './keyword-abilities.service';
import type {
  FullPlaytestGameState,
  ExtendedGameCard,
  PlayerState,
  ManaPool,
  GameConfig,
  DEFAULT_GAME_CONFIG,
  PlayerId,
  CombatState,
} from '@decktutor/shared';

@Injectable()
export class PlaytestingService {
  // In-memory storage for active game states
  private gameStates: Map<string, FullPlaytestGameState> = new Map();

  constructor(
    @InjectRepository(Deck)
    private deckRepository: Repository<Deck>,
    private eventsGateway: EventsGateway,
    private gameLoopService: GameLoopService,
    private keywordService: KeywordAbilitiesService,
  ) {}

  async getStatus(userId: string) {
    return {
      enabled: true,
      userId,
    };
  }

  /**
   * Start a new AI vs AI playtest game
   */
  async startGame(
    player1DeckId: string,
    player2DeckId: string,
    userId: string,
    config?: Partial<GameConfig>,
  ): Promise<FullPlaytestGameState> {
    // Check if there's already an active session for player1's deck
    const existingSession = this.eventsGateway.getActivePlaytestSession(player1DeckId);
    if (existingSession) {
      throw new ConflictException('A playtest session is already active for this deck');
    }

    // Fetch both decks with cards
    const [deck1, deck2] = await Promise.all([
      this.deckRepository.findOne({
        where: { id: player1DeckId, userId },
        relations: ['cards', 'cards.card'],
      }),
      this.deckRepository.findOne({
        where: { id: player2DeckId, userId },
        relations: ['cards', 'cards.card'],
      }),
    ]);

    if (!deck1) {
      throw new NotFoundException('Player 1 deck not found');
    }
    if (!deck2) {
      throw new NotFoundException('Player 2 deck not found');
    }

    // Start the session via EventsGateway
    const sessionId = this.eventsGateway.startPlaytestSession(player1DeckId);
    if (!sessionId) {
      throw new ConflictException('Failed to start playtest session');
    }

    // Build game state with both decks
    const gameConfig: GameConfig = {
      actionDelay: config?.actionDelay ?? 500,
      phaseDelay: config?.phaseDelay ?? 1000,
      maxTurns: config?.maxTurns ?? 100,
      pauseOnCombat: config?.pauseOnCombat ?? false,
      pauseOnSpellCast: config?.pauseOnSpellCast ?? false,
    };

    const gameState = this.initializeFullGameState(sessionId, deck1, deck2, gameConfig);

    // Store game state
    this.gameStates.set(player1DeckId, gameState);

    // Emit initial game state
    this.eventsGateway.emitPlaytestEvent(player1DeckId, {
      type: 'session:started',
      sessionId,
    });

    // Start the game loop (runs in background)
    this.gameLoopService.startGameLoop(gameState).catch((error) => {
      console.error('[PlaytestingService] Game loop error:', error);
    });

    return gameState;
  }

  /**
   * Get the current game state for a deck
   */
  getGameState(deckId: string): FullPlaytestGameState | null {
    return this.gameStates.get(deckId) || this.gameLoopService.getGameState(deckId);
  }

  /**
   * End a playtest game
   */
  endGame(deckId: string): boolean {
    // Stop the game loop
    this.gameLoopService.stopGame(deckId);

    // End the session
    const ended = this.eventsGateway.endPlaytestSession(deckId);
    if (ended) {
      this.gameStates.delete(deckId);
    }
    return ended;
  }

  /**
   * Pause a running game
   */
  pauseGame(deckId: string): boolean {
    return this.gameLoopService.pauseGame(deckId);
  }

  /**
   * Resume a paused game
   */
  resumeGame(deckId: string): boolean {
    return this.gameLoopService.resumeGame(deckId);
  }

  /**
   * Check if a game is currently running
   */
  isGameRunning(deckId: string): boolean {
    return this.gameLoopService.isGameRunning(deckId);
  }

  /**
   * Initialize a full game state from two decks
   */
  private initializeFullGameState(
    sessionId: string,
    deck1: Deck,
    deck2: Deck,
    config: GameConfig,
  ): FullPlaytestGameState {
    const cards: Record<string, ExtendedGameCard> = {};
    let instanceCounter = 0;

    // Initialize player 1 (player)
    const player1State = this.initializePlayerState('player');
    const player1BattlefieldOrder: string[] = [];

    for (const deckCard of deck1.cards) {
      if (deckCard.categories.includes('sideboard')) continue;

      for (let i = 0; i < deckCard.quantity; i++) {
        const instanceId = `${sessionId}-p1-${instanceCounter++}`;
        const isCommander = deckCard.isCommander;
        const keywords = this.keywordService.parseKeywords(
          deckCard.card?.oracleText || null,
          deckCard.card?.typeLine || null,
        );

        const gameCard: ExtendedGameCard = {
          instanceId,
          scryfallId: deckCard.scryfallId,
          name: deckCard.card?.name || 'Unknown Card',
          owner: 'player',
          controller: 'player',
          zone: isCommander ? 'command' : 'library',
          isTapped: false,
          isFaceDown: false,
          isFlipped: false,
          counters: {},
          attachedTo: null,
          attachments: [],
          summoningSickness: false,
          damage: 0,
          imageUrl: deckCard.card?.imageNormal || null,
          manaCost: deckCard.card?.manaCost || null,
          cmc: deckCard.card?.cmc || 0,
          typeLine: deckCard.card?.typeLine || null,
          oracleText: deckCard.card?.oracleText || null,
          power: deckCard.card?.power || null,
          toughness: deckCard.card?.toughness || null,
          colors: deckCard.card?.colors || [],
          colorIdentity: deckCard.card?.colorIdentity || [],
          isCommander,
          keywords,
        };

        cards[instanceId] = gameCard;

        if (isCommander) {
          player1State.commandZone.push(instanceId);
        } else {
          player1State.libraryOrder.push(instanceId);
        }
      }
    }

    // Initialize player 2 (opponent)
    const player2State = this.initializePlayerState('opponent');
    const player2BattlefieldOrder: string[] = [];

    for (const deckCard of deck2.cards) {
      if (deckCard.categories.includes('sideboard')) continue;

      for (let i = 0; i < deckCard.quantity; i++) {
        const instanceId = `${sessionId}-p2-${instanceCounter++}`;
        const isCommander = deckCard.isCommander;
        const keywords = this.keywordService.parseKeywords(
          deckCard.card?.oracleText || null,
          deckCard.card?.typeLine || null,
        );

        const gameCard: ExtendedGameCard = {
          instanceId,
          scryfallId: deckCard.scryfallId,
          name: deckCard.card?.name || 'Unknown Card',
          owner: 'opponent',
          controller: 'opponent',
          zone: isCommander ? 'command' : 'library',
          isTapped: false,
          isFaceDown: false,
          isFlipped: false,
          counters: {},
          attachedTo: null,
          attachments: [],
          summoningSickness: false,
          damage: 0,
          imageUrl: deckCard.card?.imageNormal || null,
          manaCost: deckCard.card?.manaCost || null,
          cmc: deckCard.card?.cmc || 0,
          typeLine: deckCard.card?.typeLine || null,
          oracleText: deckCard.card?.oracleText || null,
          power: deckCard.card?.power || null,
          toughness: deckCard.card?.toughness || null,
          colors: deckCard.card?.colors || [],
          colorIdentity: deckCard.card?.colorIdentity || [],
          isCommander,
          keywords,
        };

        cards[instanceId] = gameCard;

        if (isCommander) {
          player2State.commandZone.push(instanceId);
        } else {
          player2State.libraryOrder.push(instanceId);
        }
      }
    }

    // Shuffle both libraries
    this.shuffleArray(player1State.libraryOrder);
    this.shuffleArray(player2State.libraryOrder);

    // Draw opening hands (7 cards each)
    for (let i = 0; i < 7 && player1State.libraryOrder.length > 0; i++) {
      const cardId = player1State.libraryOrder.shift()!;
      cards[cardId].zone = 'hand';
      player1State.handOrder.push(cardId);
    }

    for (let i = 0; i < 7 && player2State.libraryOrder.length > 0; i++) {
      const cardId = player2State.libraryOrder.shift()!;
      cards[cardId].zone = 'hand';
      player2State.handOrder.push(cardId);
    }

    // Determine starting life based on format
    const life = this.getStartingLife(deck1.format);
    player1State.life = life;
    player2State.life = life;

    // Initialize combat state
    const combat: CombatState = {
      isActive: false,
      attackers: [],
      blockers: [],
      damageAssignmentOrder: {},
    };

    return {
      sessionId,
      deckId: deck1.id,
      opponentDeckId: deck2.id,
      deckName: deck1.name,
      opponentDeckName: deck2.name,
      format: deck1.format || 'commander',

      turnNumber: 0, // Turn 0 = pregame (mulligans)
      activePlayer: 'player',
      priorityPlayer: 'player',

      phase: 'pregame',
      step: 'mulligan',

      player: player1State,
      opponent: player2State,

      cards,

      battlefieldOrder: {
        player: player1BattlefieldOrder,
        opponent: player2BattlefieldOrder,
      },

      stack: [],
      combat,
      log: [],

      isGameOver: false,
      winner: null,
      gameOverReason: null,

      config,

      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Initialize a player state
   */
  private initializePlayerState(id: PlayerId): PlayerState {
    return {
      id,
      life: 40,
      poisonCounters: 0,
      manaPool: this.createEmptyManaPool(),
      handOrder: [],
      libraryOrder: [],
      graveyardOrder: [],
      exileOrder: [],
      commandZone: [],
      landPlaysRemaining: 1,
      hasPassedPriority: false,
      // Mulligan tracking for London mulligan
      mulliganCount: 0,
      hasKeptHand: false,
      cardsToBottomCount: 0,
    };
  }

  /**
   * Create an empty mana pool
   */
  private createEmptyManaPool(): ManaPool {
    return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  }

  /**
   * Fisher-Yates shuffle
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Get starting life total based on format
   */
  private getStartingLife(format: string | null): number {
    switch (format?.toLowerCase()) {
      case 'commander':
      case 'edh':
      case 'duel commander':
        return 40;
      case 'brawl':
        return 25;
      default:
        return 20;
    }
  }
}
