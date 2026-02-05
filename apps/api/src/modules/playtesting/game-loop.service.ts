import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { GameEngineService } from "./game-engine.service";
import { AIOpponentService } from "./ai-opponent.service";
import { KeywordAbilitiesService } from "./keyword-abilities.service";
import { EventsGateway } from "../events/events.gateway";
import type {
  FullPlaytestGameState,
  PlaytestEvent,
  PlayerId,
  GameAction,
  GameLogEntry,
  GameConfig,
  TokenUsage,
} from "@decktutor/shared";

interface QueuedAction {
  player: PlayerId;
  action: GameAction;
  timestamp: number;
}

interface RunningGame {
  state: FullPlaytestGameState;
  isRunning: boolean;
  isPaused: boolean;
  isLoading: boolean; // True while game state is being restored
  abortController: AbortController;
  actionQueue: QueuedAction[]; // Queue for actions received during loading
}

@Injectable()
export class GameLoopService {
  // Track running games
  private runningGames: Map<string, RunningGame> = new Map();

  constructor(
    private gameEngine: GameEngineService,
    private aiOpponent: AIOpponentService,
    private keywordService: KeywordAbilitiesService,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Start the game loop for an AI vs AI game
   */
  async startGameLoop(state: FullPlaytestGameState): Promise<void> {
    const deckId = state.deckId;

    // Check if game is already running
    if (this.runningGames.has(deckId)) {
      console.log(`[GameLoop] Game already running for deck ${deckId}`);
      return;
    }

    const abortController = new AbortController();
    const runningGame: RunningGame = {
      state,
      isRunning: true,
      isPaused: false,
      isLoading: false,
      abortController,
      actionQueue: [],
    };

    this.runningGames.set(deckId, runningGame);

    console.log(`[GameLoop] Starting game loop for deck ${deckId}`);

    try {
      await this.runGame(runningGame);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(
          `[GameLoop] Error in game loop for deck ${deckId}:`,
          error,
        );
        this.emitEvent(deckId, {
          type: "game:error",
          error: error.message || "Unknown error in game loop",
        });
      }
    } finally {
      this.runningGames.delete(deckId);
      console.log(`[GameLoop] Game loop ended for deck ${deckId}`);
    }
  }

  /**
   * Continue a game from a saved state
   * Queues any incoming actions until the game is fully loaded
   */
  async continueGameLoop(state: FullPlaytestGameState): Promise<void> {
    const deckId = state.deckId;

    // Check if game is already running
    if (this.runningGames.has(deckId)) {
      console.log(`[GameLoop] Game already running for deck ${deckId}`);
      return;
    }

    const abortController = new AbortController();
    const runningGame: RunningGame = {
      state,
      isRunning: true,
      isPaused: false,
      isLoading: true, // Start in loading state to queue incoming actions
      abortController,
      actionQueue: [],
    };

    this.runningGames.set(deckId, runningGame);

    console.log(`[GameLoop] Continuing game loop for deck ${deckId} from turn ${state.turnNumber}`);

    try {
      // Emit full game state to sync clients
      this.emitEvent(state.deckId, {
        type: "gamestate:full",
        gameState: state,
      });

      // Add log entry for game continuation
      this.addLogEntry(state, {
        type: "system",
        player: "system",
        message: `Game continued from turn ${state.turnNumber}`,
      });

      // Small delay to allow clients to process the full state
      await this.delay(state.config.phaseDelay);

      // Mark loading as complete - now ready to process queued actions
      runningGame.isLoading = false;

      // Process any queued actions that came in during loading
      await this.processQueuedActions(runningGame);

      // Continue with normal game loop
      await this.runGameFromCurrentState(runningGame);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(
          `[GameLoop] Error in continued game loop for deck ${deckId}:`,
          error,
        );
        this.emitEvent(deckId, {
          type: "game:error",
          error: error.message || "Unknown error in game loop",
        });
      }
    } finally {
      this.runningGames.delete(deckId);
      console.log(`[GameLoop] Continued game loop ended for deck ${deckId}`);
    }
  }

  /**
   * Queue an action to be processed once the game is loaded
   * Returns true if the action was queued, false if the game is ready for immediate processing
   */
  queueAction(deckId: string, player: PlayerId, action: GameAction): boolean {
    const game = this.runningGames.get(deckId);
    if (!game) {
      return false;
    }

    if (game.isLoading) {
      game.actionQueue.push({
        player,
        action,
        timestamp: Date.now(),
      });
      console.log(`[GameLoop] Queued action for deck ${deckId}: ${action.type}`);
      return true;
    }

    return false;
  }

  /**
   * Check if a game is currently loading
   */
  isGameLoading(deckId: string): boolean {
    const game = this.runningGames.get(deckId);
    return game?.isLoading ?? false;
  }

  /**
   * Process all queued actions in order
   */
  private async processQueuedActions(game: RunningGame): Promise<void> {
    const state = game.state;
    const config = state.config;

    // Sort by timestamp to ensure order
    game.actionQueue.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`[GameLoop] Processing ${game.actionQueue.length} queued actions for deck ${state.deckId}`);

    while (game.actionQueue.length > 0 && game.isRunning && !state.isGameOver) {
      const queuedAction = game.actionQueue.shift()!;

      // Emit that we're processing a queued action
      this.emitEvent(state.deckId, {
        type: "ai:decided",
        player: queuedAction.player,
        action: queuedAction.action,
        reasoning: "Processing queued action from reconnection",
      });

      // Process the action
      const events = await this.processAction(
        state,
        queuedAction.player,
        queuedAction.action,
      );
      this.emitEvents(state.deckId, events);

      // If any life changes occurred, emit full game state for UI sync
      const hasLifeChanges = events.some(e => e.type === "life:changed");
      if (hasLifeChanges) {
        this.emitEvent(state.deckId, {
          type: "gamestate:full",
          gameState: state,
        });
      }

      await this.delay(config.actionDelay);
    }
  }

  /**
   * Run the game loop from the current state (for continued games)
   */
  private async runGameFromCurrentState(game: RunningGame): Promise<void> {
    const state = game.state;
    const config = state.config;

    // If game is in pregame phase, complete mulligans first
    if (state.phase === "pregame") {
      await this.runPregameMulligans(game);

      if (!game.isRunning || state.isGameOver) {
        return;
      }

      // Transition to turn 1 if mulligans just completed
      if (state.turnNumber === 0) {
        state.turnNumber = 1;
        state.phase = "beginning";
        state.step = "untap";
        state.activePlayer = "player";
        state.priorityPlayer = null;

        this.emitEvent(state.deckId, {
          type: "turn:started",
          turnNumber: 1,
          activePlayer: "player",
        });

        this.emitEvent(state.deckId, {
          type: "phase:changed",
          phase: "beginning",
          step: "untap",
          activePlayer: "player",
        });
      }
    }

    // Continue with normal game loop
    while (game.isRunning && !state.isGameOver) {
      if (game.abortController.signal.aborted) {
        break;
      }

      while (game.isPaused && game.isRunning) {
        await this.delay(100);
      }

      if (state.turnNumber > config.maxTurns) {
        state.isGameOver = true;
        state.winner = null;
        state.gameOverReason = "Maximum turns reached (draw)";
        this.emitEvent(state.deckId, {
          type: "game:over",
          winner: "player",
          reason: state.gameOverReason,
        });
        break;
      }

      const currentPlayer = state.priorityPlayer;

      if (currentPlayer === null) {
        const events = this.gameEngine.advancePhase(state);
        this.emitEvents(state.deckId, events);

        // If any life changes occurred, emit full game state for UI sync
        const hasLifeChanges = events.some(e => e.type === "life:changed");
        if (hasLifeChanges) {
          this.emitEvent(state.deckId, {
            type: "gamestate:full",
            gameState: state,
          });
        }

        await this.delay(config.phaseDelay / 2);
        continue;
      }

      this.emitEvent(state.deckId, {
        type: "ai:thinking",
        player: currentPlayer,
        action: `${currentPlayer === "player" ? "Player" : "Opponent"} is considering options...`,
      });

      const availableActions = this.gameEngine.getAvailableActions(
        state,
        currentPlayer,
      );

      const decision = await this.aiOpponent.decideAction(
        state,
        currentPlayer,
        availableActions,
      );

      // Track token usage from AI decision
      this.accumulateTokenUsage(state, decision.tokenUsage);

      this.emitEvent(state.deckId, {
        type: "ai:decided",
        player: currentPlayer,
        action: decision.action,
        reasoning: decision.reasoning,
      });

      this.addLogEntry(state, {
        type: "ai",
        player: currentPlayer,
        message: `${currentPlayer === "player" ? "Player" : "Opponent"}: ${decision.reasoning}`,
      });

      const events = await this.processAction(
        state,
        currentPlayer,
        decision.action,
      );
      this.emitEvents(state.deckId, events);

      // If any life changes occurred, emit full game state for UI sync
      const hasLifeChanges = events.some(e => e.type === "life:changed");
      if (hasLifeChanges) {
        this.emitEvent(state.deckId, {
          type: "gamestate:full",
          gameState: state,
        });
      }

      await this.delay(config.actionDelay);
    }

    if (state.isGameOver) {
      this.addLogEntry(state, {
        type: "system",
        player: "system",
        message: `Game ended: ${state.winner ? (state.winner === "player" ? state.deckName : state.opponentDeckName) + " wins!" : "Draw"}`,
      });

      this.emitEvent(state.deckId, {
        type: "gamestate:full",
        gameState: state,
      });
    }
  }

  /**
   * Stop a running game
   */
  stopGame(deckId: string): boolean {
    const game = this.runningGames.get(deckId);
    if (!game) {
      return false;
    }

    game.isRunning = false;
    game.abortController.abort();
    return true;
  }

  /**
   * Pause a running game
   */
  pauseGame(deckId: string): boolean {
    const game = this.runningGames.get(deckId);
    if (!game) {
      return false;
    }

    game.isPaused = true;
    return true;
  }

  /**
   * Resume a paused game
   */
  resumeGame(deckId: string): boolean {
    const game = this.runningGames.get(deckId);
    if (!game || !game.isPaused) {
      return false;
    }

    game.isPaused = false;
    return true;
  }

  /**
   * Check if a game is running
   */
  isGameRunning(deckId: string): boolean {
    return this.runningGames.has(deckId);
  }

  /**
   * Get a running game's state
   */
  getGameState(deckId: string): FullPlaytestGameState | null {
    return this.runningGames.get(deckId)?.state || null;
  }

  /**
   * Main game loop - runs until game ends or is stopped
   */
  private async runGame(game: RunningGame): Promise<void> {
    const state = game.state;
    const config = state.config;

    // Emit initial game state
    this.emitEvent(state.deckId, {
      type: "gamestate:full",
      gameState: state,
    });

    // Log game start
    this.addLogEntry(state, {
      type: "system",
      player: "system",
      message: `Game started: ${state.deckName} vs ${state.opponentDeckName}`,
    });

    // Run pregame mulligan phase
    await this.runPregameMulligans(game);

    // Check if game was stopped during mulligans
    if (!game.isRunning || state.isGameOver) {
      return;
    }

    // Transition to turn 1
    state.turnNumber = 1;
    state.phase = "beginning";
    state.step = "untap";
    state.activePlayer = "player";
    state.priorityPlayer = null; // No priority during untap

    this.emitEvent(state.deckId, {
      type: "turn:started",
      turnNumber: 1,
      activePlayer: "player",
    });

    this.emitEvent(state.deckId, {
      type: "phase:changed",
      phase: "beginning",
      step: "untap",
      activePlayer: "player",
    });

    while (game.isRunning && !state.isGameOver) {
      // Check for abort
      if (game.abortController.signal.aborted) {
        break;
      }

      // Wait while paused
      while (game.isPaused && game.isRunning) {
        await this.delay(100);
      }

      // Check max turns
      if (state.turnNumber > config.maxTurns) {
        state.isGameOver = true;
        state.winner = null;
        state.gameOverReason = "Maximum turns reached (draw)";
        this.emitEvent(state.deckId, {
          type: "game:over",
          winner: "player", // Default to player for draw handling
          reason: state.gameOverReason,
        });
        break;
      }

      // Get current player who has priority
      const currentPlayer = state.priorityPlayer;

      if (currentPlayer === null) {
        // No priority (untap/cleanup) - advance automatically
        const events = this.gameEngine.advancePhase(state);
        this.emitEvents(state.deckId, events);

        // If any life changes occurred, emit full game state for UI sync
        const hasLifeChanges = events.some(e => e.type === "life:changed");
        if (hasLifeChanges) {
          this.emitEvent(state.deckId, {
            type: "gamestate:full",
            gameState: state,
          });
        }

        await this.delay(config.phaseDelay / 2);
        continue;
      }

      // Emit thinking event
      this.emitEvent(state.deckId, {
        type: "ai:thinking",
        player: currentPlayer,
        action: `${currentPlayer === "player" ? "Player" : "Opponent"} is considering options...`,
      });

      // Get available actions for current player
      const availableActions = this.gameEngine.getAvailableActions(
        state,
        currentPlayer,
      );

      // AI decides what to do
      const decision = await this.aiOpponent.decideAction(
        state,
        currentPlayer,
        availableActions,
      );

      // Track token usage from AI decision
      this.accumulateTokenUsage(state, decision.tokenUsage);

      // Emit decision with reasoning
      this.emitEvent(state.deckId, {
        type: "ai:decided",
        player: currentPlayer,
        action: decision.action,
        reasoning: decision.reasoning,
      });

      // Add to game log
      this.addLogEntry(state, {
        type: "ai",
        player: currentPlayer,
        message: `${currentPlayer === "player" ? "Player" : "Opponent"}: ${decision.reasoning}`,
      });

      // Process the action
      const events = await this.processAction(
        state,
        currentPlayer,
        decision.action,
      );
      this.emitEvents(state.deckId, events);

      // If any life changes occurred, emit full game state for UI sync
      const hasLifeChanges = events.some(e => e.type === "life:changed");
      if (hasLifeChanges) {
        this.emitEvent(state.deckId, {
          type: "gamestate:full",
          gameState: state,
        });
      }

      // Small delay for UI to render
      await this.delay(config.actionDelay);
    }

    // Game over - emit final state
    if (state.isGameOver) {
      this.addLogEntry(state, {
        type: "system",
        player: "system",
        message: `Game ended: ${state.winner ? (state.winner === "player" ? state.deckName : state.opponentDeckName) + " wins!" : "Draw"}`,
      });

      this.emitEvent(state.deckId, {
        type: "gamestate:full",
        gameState: state,
      });
    }
  }

  /**
   * Run the pregame mulligan phase for both players
   * Uses London mulligan rules: draw 7, then put X on bottom where X = mulligan count
   */
  private async runPregameMulligans(game: RunningGame): Promise<void> {
    const state = game.state;
    const config = state.config;
    const players: PlayerId[] = ["player", "opponent"];

    this.addLogEntry(state, {
      type: "system",
      player: "system",
      message: "Beginning mulligan phase",
    });

    // In Commander, first mulligan is free (no cards to bottom)
    const isCommander = state.format === "commander" || state.format === "edh";

    // Loop until both players have kept
    while (game.isRunning && (!state.player.hasKeptHand || !state.opponent.hasKeptHand)) {
      // Check for abort
      if (game.abortController.signal.aborted) {
        return;
      }

      // Wait while paused
      while (game.isPaused && game.isRunning) {
        await this.delay(100);
      }

      // Process each player who hasn't kept yet
      for (const player of players) {
        if (!game.isRunning) return;

        const playerState = state[player];
        if (playerState.hasKeptHand) continue;

        const playerName = player === "player" ? state.deckName : state.opponentDeckName;

        // Emit evaluating event
        this.emitEvent(state.deckId, {
          type: "mulligan:evaluating",
          player,
          mulliganCount: playerState.mulliganCount,
          handSize: playerState.handOrder.length,
        });

        this.addLogEntry(state, {
          type: "action",
          player,
          message: `${playerName} is evaluating their hand...`,
        });

        // AI decides keep or mulligan
        const decision = await this.aiOpponent.decideMulligan(
          state,
          player,
          playerState.mulliganCount,
        );

        // Track token usage from mulligan decision
        this.accumulateTokenUsage(state, decision.tokenUsage);

        await this.delay(config.actionDelay);

        if (decision.keep) {
          // Player keeps their hand
          playerState.hasKeptHand = true;

          // Calculate cards to bottom (London mulligan)
          // In Commander, first mulligan is free
          const effectiveMulliganCount = isCommander
            ? Math.max(0, playerState.mulliganCount - 1)
            : playerState.mulliganCount;
          playerState.cardsToBottomCount = effectiveMulliganCount;

          this.emitEvent(state.deckId, {
            type: "mulligan:decision",
            player,
            decision: "keep",
            mulliganCount: playerState.mulliganCount,
            reasoning: decision.reasoning,
          });

          this.addLogEntry(state, {
            type: "action",
            player,
            message: `${playerName} keeps ${playerState.handOrder.length}-card hand${playerState.mulliganCount > 0 ? ` after ${playerState.mulliganCount} mulligan${playerState.mulliganCount > 1 ? "s" : ""}` : ""}`,
          });

          // If player needs to bottom cards, do it now
          if (playerState.cardsToBottomCount > 0) {
            await this.handleBottomCards(game, player);
          }
        } else {
          // Player mulligans
          playerState.mulliganCount++;

          this.emitEvent(state.deckId, {
            type: "mulligan:decision",
            player,
            decision: "mulligan",
            mulliganCount: playerState.mulliganCount,
            reasoning: decision.reasoning,
          });

          this.addLogEntry(state, {
            type: "action",
            player,
            message: `${playerName} mulligans (mulligan #${playerState.mulliganCount}): ${decision.reasoning}`,
          });

          // Perform the mulligan - shuffle hand into library, draw 7
          this.handleMulligan(state, player);

          // Emit updated game state first to clear the old hand
          this.emitEvent(state.deckId, {
            type: "gamestate:full",
            gameState: state,
          });

          // Show the newly drawn cards
          const drawnCardNames = playerState.handOrder
            .map((cardId) => state.cards[cardId]?.name)
            .filter(Boolean);

          this.addLogEntry(state, {
            type: "action",
            player,
            message: `${playerName} draws new hand: ${drawnCardNames.join(", ")}`,
          });

          await this.delay(config.actionDelay);
        }
      }
    }

    // Both players have kept - mulligan phase complete
    this.emitEvent(state.deckId, {
      type: "mulligan:complete",
      message: "Both players have kept their hands",
    });

    this.addLogEntry(state, {
      type: "system",
      player: "system",
      message: "Mulligan phase complete - starting the game",
    });

    // Emit updated game state
    this.emitEvent(state.deckId, {
      type: "gamestate:full",
      gameState: state,
    });

    await this.delay(config.phaseDelay);
  }

  /**
   * Handle putting cards on bottom after London mulligan
   */
  private async handleBottomCards(game: RunningGame, player: PlayerId): Promise<void> {
    const state = game.state;
    const config = state.config;
    const playerState = state[player];
    const cardsToBottom = playerState.cardsToBottomCount;
    const playerName = player === "player" ? state.deckName : state.opponentDeckName;

    if (cardsToBottom <= 0) return;

    // AI decides which cards to bottom
    const decision = await this.aiOpponent.decideBottomCards(state, player, cardsToBottom);

    // Track token usage from bottom cards decision
    this.accumulateTokenUsage(state, decision.tokenUsage);

    this.emitEvent(state.deckId, {
      type: "mulligan:bottomCards",
      player,
      cardCount: cardsToBottom,
    });

    // Move cards from hand to bottom of library
    for (const cardId of decision.cardIds) {
      const card = state.cards[cardId];
      if (!card) continue;

      // Remove from hand
      const handIdx = playerState.handOrder.indexOf(cardId);
      if (handIdx > -1) {
        playerState.handOrder.splice(handIdx, 1);
      }

      // Add to bottom of library
      card.zone = "library";
      playerState.libraryOrder.push(cardId);

      this.emitEvent(state.deckId, {
        type: "card:moved",
        cardId,
        cardName: card.name,
        player,
        from: "hand",
        to: "library",
      });
    }

    playerState.cardsToBottomCount = 0;

    this.addLogEntry(state, {
      type: "action",
      player,
      message: `${playerName} puts ${cardsToBottom} card${cardsToBottom > 1 ? "s" : ""} on the bottom of their library`,
    });

    // Emit updated game state to show reduced hand size
    this.emitEvent(state.deckId, {
      type: "gamestate:full",
      gameState: state,
    });

    await this.delay(config.actionDelay);
  }

  /**
   * Process a player action and return resulting events
   */
  private async processAction(
    state: FullPlaytestGameState,
    player: PlayerId,
    action: GameAction,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];

    switch (action.type) {
      case "pass_priority":
        events.push(...await this.gameEngine.passPriority(state, player));
        break;

      case "concede":
        state.isGameOver = true;
        state.winner = player === "player" ? "opponent" : "player";
        state.gameOverReason = `${player === "player" ? "Player" : "Opponent"} conceded`;
        events.push({
          type: "game:over",
          winner: state.winner,
          reason: state.gameOverReason,
        });
        break;

      case "play_land":
        events.push(...this.gameEngine.playLand(state, player, action.cardId));
        break;

      case "cast_spell":
        events.push(
          ...this.gameEngine.castSpell(
            state,
            player,
            action.cardId,
            action.targets,
          ),
        );
        break;

      case "tap_for_mana":
        events.push(
          ...this.gameEngine.tapForMana(state, player, action.cardId),
        );
        break;

      case "declare_attackers":
        events.push(
          ...this.gameEngine.declareAttackers(state, action.attackers),
        );

        // Check for attack triggers
        if (action.attackers.length > 0) {
          const attackerIds = action.attackers.map((a) => a.cardId);
          const triggers = this.keywordService.checkAttackTriggers(
            state,
            attackerIds,
          );
          for (const trigger of triggers) {
            events.push(...this.gameEngine.addToStack(state, trigger));
          }
        }
        break;

      case "declare_blockers":
        events.push(...this.gameEngine.declareBlockers(state, action.blockers));
        break;

      case "mulligan":
        events.push(...this.handleMulligan(state, player));
        break;

      case "keep_hand":
        this.addLogEntry(state, {
          type: "action",
          player,
          message: `${player === "player" ? "Player" : "Opponent"} keeps their hand`,
        });
        break;

      case "draw_card":
        events.push(...this.gameEngine.drawCard(state, player));
        break;

      case "discard":
        events.push(...this.handleDiscard(state, player, action.cardId));
        break;
    }

    // Check state-based actions after every action
    events.push(...this.gameEngine.checkStateBasedActions(state));

    // Check for triggered abilities based on phase
    if (state.step === "upkeep") {
      const triggers = this.keywordService.checkUpkeepTriggers(state);
      for (const trigger of triggers) {
        events.push(...this.gameEngine.addToStack(state, trigger));
      }
    } else if (state.step === "end") {
      const triggers = this.keywordService.checkEndStepTriggers(state);
      for (const trigger of triggers) {
        events.push(...this.gameEngine.addToStack(state, trigger));
      }
    }

    return events;
  }

  /**
   * Handle mulligan
   */
  private handleMulligan(
    state: FullPlaytestGameState,
    player: PlayerId,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const playerState = state[player];

    // Return all cards to library
    for (const cardId of [...playerState.handOrder]) {
      const card = state.cards[cardId];
      if (card) {
        card.zone = "library";
        playerState.libraryOrder.push(cardId);
      }
    }
    playerState.handOrder = [];

    // Shuffle
    this.shuffleArray(playerState.libraryOrder);

    // Draw 7 (mulligan count is tracked elsewhere if implementing London mulligan)
    for (let i = 0; i < 7 && playerState.libraryOrder.length > 0; i++) {
      const cardId = playerState.libraryOrder.shift()!;
      const card = state.cards[cardId];
      card.zone = "hand";
      playerState.handOrder.push(cardId);
      events.push({ type: "card:moved", cardId, cardName: card.name, player, from: "library", to: "hand" });
    }

    this.addLogEntry(state, {
      type: "action",
      player,
      message: `${player === "player" ? "Player" : "Opponent"} mulligans`,
    });

    return events;
  }

  /**
   * Handle discard
   */
  private handleDiscard(
    state: FullPlaytestGameState,
    player: PlayerId,
    cardId: string,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const playerState = state[player];
    const card = state.cards[cardId];

    if (!card) return events;

    // Remove from hand
    const handIdx = playerState.handOrder.indexOf(cardId);
    if (handIdx > -1) {
      playerState.handOrder.splice(handIdx, 1);
    }

    // Move to graveyard
    card.zone = "graveyard";
    playerState.graveyardOrder.push(cardId);

    events.push({ type: "card:moved", cardId, cardName: card.name, player, from: "hand", to: "graveyard" });

    this.addLogEntry(state, {
      type: "action",
      player,
      message: `${player === "player" ? "Player" : "Opponent"} discards ${card.name}`,
    });

    return events;
  }

  /**
   * Emit a playtest event
   */
  private emitEvent(deckId: string, event: PlaytestEvent): void {
    this.eventsGateway.emitPlaytestEvent(deckId, event);
  }

  /**
   * Emit multiple playtest events
   */
  private emitEvents(deckId: string, events: PlaytestEvent[]): void {
    for (const event of events) {
      this.emitEvent(deckId, event);
    }
  }

  /**
   * Add a log entry and emit it
   */
  private addLogEntry(
    state: FullPlaytestGameState,
    entry: Omit<GameLogEntry, "id" | "timestamp">,
  ): void {
    const logEntry: GameLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    state.log.push(logEntry);
    this.emitEvent(state.deckId, { type: "game:log", entry: logEntry });
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
   * Accumulate token usage from an AI call and emit the update
   */
  private accumulateTokenUsage(
    state: FullPlaytestGameState,
    tokenUsage: TokenUsage | undefined,
  ): void {
    if (!tokenUsage) return;

    state.tokenUsage.totalInputTokens += tokenUsage.inputTokens;
    state.tokenUsage.totalOutputTokens += tokenUsage.outputTokens;
    state.tokenUsage.totalCacheReadInputTokens += tokenUsage.cacheReadInputTokens || 0;
    state.tokenUsage.totalCacheCreationInputTokens += tokenUsage.cacheCreationInputTokens || 0;
    state.tokenUsage.callCount += 1;

    // Emit token update event
    this.emitEvent(state.deckId, {
      type: "ai:tokens",
      tokenUsage: state.tokenUsage,
    });
  }
}
