// =====================
// Game Phases & Steps
// =====================

export type GamePhase =
  | 'pregame'
  | 'beginning'
  | 'precombat_main'
  | 'combat'
  | 'postcombat_main'
  | 'ending';

export type BeginningStep = 'untap' | 'upkeep' | 'draw';

export type CombatStep =
  | 'beginning_of_combat'
  | 'declare_attackers'
  | 'declare_blockers'
  | 'first_strike_damage'
  | 'combat_damage'
  | 'end_of_combat';

export type EndingStep = 'end' | 'cleanup';

export type PregameStep = 'mulligan' | 'bottom_cards';

export type GameStep = PregameStep | BeginningStep | CombatStep | EndingStep | 'main';

// =====================
// Mana & Resources
// =====================

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

export interface ManaPool {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number; // Colorless
}

export interface ManaPayment {
  W?: number;
  U?: number;
  B?: number;
  R?: number;
  G?: number;
  C?: number;
}

// =====================
// Player State
// =====================

export type PlayerId = 'player' | 'opponent';

export interface PlayerState {
  id: PlayerId;
  life: number;
  poisonCounters: number;
  manaPool: ManaPool;
  handOrder: string[]; // instanceIds
  libraryOrder: string[]; // instanceIds (top of deck first)
  graveyardOrder: string[]; // instanceIds
  exileOrder: string[]; // instanceIds
  commandZone: string[]; // instanceIds
  landPlaysRemaining: number;
  hasPassedPriority: boolean;
  // Mulligan tracking for London mulligan
  mulliganCount: number;
  hasKeptHand: boolean;
  cardsToBottomCount: number; // Cards that need to be put on bottom after keeping
}

// =====================
// Extended Card State
// =====================

export type ExtendedGameZone =
  | 'library'
  | 'hand'
  | 'battlefield'
  | 'graveyard'
  | 'exile'
  | 'command'
  | 'stack';

export interface ExtendedGameCard {
  instanceId: string;
  scryfallId: string;
  name: string;
  owner: PlayerId;
  controller: PlayerId;
  zone: ExtendedGameZone;
  isTapped: boolean;
  isFaceDown: boolean;
  isFlipped: boolean;
  counters: Record<string, number>; // e.g., { '+1/+1': 2, 'loyalty': 3 }
  attachedTo: string | null; // instanceId of permanent this is attached to
  attachments: string[]; // instanceIds of cards attached to this
  summoningSickness: boolean;
  damage: number;
  // Card data (cached for quick access)
  imageUrl: string | null;
  manaCost: string | null;
  cmc: number;
  typeLine: string | null;
  oracleText: string | null;
  power: string | null;
  toughness: string | null;
  colors: string[];
  colorIdentity: string[];
  isCommander: boolean;
  keywords: string[]; // parsed keywords like 'flying', 'haste', etc.
}

// =====================
// The Stack
// =====================

export type StackItemType = 'spell' | 'ability';
export type AbilityType = 'activated' | 'triggered' | 'mana';

export interface StackTarget {
  type: 'card' | 'player';
  id: string; // instanceId or 'player'/'opponent'
}

export interface StackItem {
  id: string;
  type: StackItemType;
  sourceCardId: string; // instanceId of card
  controller: PlayerId;
  targets: StackTarget[];
  // For spells
  cardName?: string;
  manaCost?: string;
  // For abilities
  abilityText?: string;
  abilityType?: AbilityType;
}

// =====================
// Combat State
// =====================

export interface AttackerInfo {
  cardId: string; // instanceId
  attackingPlayerId: PlayerId;
  defendingTarget: PlayerId | string; // player or planeswalker instanceId
}

export interface BlockerInfo {
  cardId: string; // instanceId
  blockingAttackerId: string; // instanceId of attacker
}

export interface CombatDamageInfo {
  sourceId: string;
  targetId: string;
  targetType: 'card' | 'player';
  amount: number;
  isFirstStrike: boolean;
}

export interface CombatState {
  isActive: boolean;
  attackers: AttackerInfo[];
  blockers: BlockerInfo[];
  damageAssignmentOrder: Record<string, string[]>; // attackerId -> [blockerId order]
}

// =====================
// Game Log
// =====================

export type GameLogType =
  | 'action'
  | 'phase'
  | 'damage'
  | 'life'
  | 'draw'
  | 'play'
  | 'ability'
  | 'combat'
  | 'system'
  | 'ai';

export interface GameLogEntry {
  id: string;
  timestamp: string;
  type: GameLogType;
  player: PlayerId | 'system';
  message: string;
}

// =====================
// Full Game State
// =====================

export interface FullPlaytestGameState {
  sessionId: string;
  deckId: string; // Primary deck (player 1)
  opponentDeckId: string; // Opponent deck (player 2)
  deckName: string;
  opponentDeckName: string;
  format: string;

  // Turn tracking
  turnNumber: number;
  activePlayer: PlayerId;
  priorityPlayer: PlayerId | null; // null during untap/cleanup

  // Phase/Step tracking
  phase: GamePhase;
  step: GameStep;

  // Player states
  player: PlayerState;
  opponent: PlayerState;

  // All cards
  cards: Record<string, ExtendedGameCard>;

  // Battlefield ordering (for display)
  battlefieldOrder: {
    player: string[];
    opponent: string[];
  };

  // The Stack
  stack: StackItem[];

  // Combat
  combat: CombatState;

  // Game log
  log: GameLogEntry[];

  // Game state
  isGameOver: boolean;
  winner: PlayerId | null;
  gameOverReason: string | null;

  // Configuration
  config: GameConfig;

  updatedAt: string;
}

// =====================
// Game Configuration
// =====================

export interface GameConfig {
  actionDelay: number; // Delay between AI actions (ms)
  phaseDelay: number; // Delay between phases (ms)
  maxTurns: number; // Maximum turns before draw
  pauseOnCombat: boolean;
  pauseOnSpellCast: boolean;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  actionDelay: 500,
  phaseDelay: 1000,
  maxTurns: 100,
  pauseOnCombat: false,
  pauseOnSpellCast: false,
};

// =====================
// Game Actions
// =====================

export type GameAction =
  // Priority actions
  | { type: 'pass_priority' }
  | { type: 'concede' }

  // Card actions
  | { type: 'play_land'; cardId: string }
  | { type: 'cast_spell'; cardId: string; targets?: StackTarget[]; payingMana?: ManaPayment }
  | { type: 'activate_ability'; cardId: string; abilityIndex: number; targets?: StackTarget[] }
  | { type: 'tap_for_mana'; cardId: string }

  // Combat actions
  | { type: 'declare_attackers'; attackers: AttackerInfo[] }
  | { type: 'declare_blockers'; blockers: BlockerInfo[] }
  | { type: 'assign_damage_order'; attackerId: string; blockerOrder: string[] }

  // Special actions
  | { type: 'mulligan' }
  | { type: 'keep_hand' }
  | { type: 'bottom_card'; cardId: string } // Put a card on the bottom of library (London mulligan)
  | { type: 'draw_card' } // Manual draw for testing
  | { type: 'discard'; cardId: string } // For max hand size

  // Stack interaction
  | { type: 'counter_spell'; stackItemId: string; sourceCardId: string }
  | { type: 'respond'; cardId: string; targets?: StackTarget[] };

export type GameActionType = GameAction['type'];

// =====================
// WebSocket Events
// =====================

export type PlaytestEvent =
  // Session events
  | { type: 'session:started'; sessionId: string }
  | { type: 'session:ended'; sessionId: string }

  // Turn/Phase events
  | { type: 'turn:started'; turnNumber: number; activePlayer: PlayerId }
  | { type: 'phase:changed'; phase: GamePhase; step: GameStep; activePlayer: PlayerId }
  | { type: 'priority:changed'; player: PlayerId | null }

  // Card movement events
  | { type: 'card:moved'; cardId: string; cardName: string; player: PlayerId; from: ExtendedGameZone; to: ExtendedGameZone; position?: number }
  | { type: 'card:tapped'; cardId: string; cardName: string; player: PlayerId; isTapped: boolean }
  | { type: 'card:flipped'; cardId: string; isFaceDown: boolean }
  | { type: 'card:counters'; cardId: string; counters: Record<string, number> }
  | { type: 'card:damage'; cardId: string; damage: number; source?: string }
  | { type: 'card:attached'; cardId: string; attachedTo: string | null }
  | { type: 'card:destroyed'; cardId: string; reason: string }

  // Player state events
  | { type: 'life:changed'; player: PlayerId; life: number; change: number; source?: string }
  | { type: 'poison:changed'; player: PlayerId; count: number }
  | { type: 'mana:changed'; player: PlayerId; manaPool: ManaPool }
  | { type: 'hand:revealed'; player: PlayerId; cardIds: string[] }

  // Stack events
  | { type: 'stack:added'; item: StackItem }
  | { type: 'stack:resolved'; itemId: string }
  | { type: 'stack:countered'; itemId: string; reason: string }

  // Combat events
  | { type: 'combat:started' }
  | { type: 'combat:attackers'; attackers: AttackerInfo[] }
  | { type: 'combat:blockers'; blockers: BlockerInfo[] }
  | { type: 'combat:damage'; damages: CombatDamageInfo[] }
  | { type: 'combat:ended' }

  // AI events
  | { type: 'ai:thinking'; player: PlayerId; action: string }
  | { type: 'ai:decided'; player: PlayerId; action: GameAction; reasoning?: string }

  // Mulligan events
  | { type: 'mulligan:evaluating'; player: PlayerId; mulliganCount: number; handSize: number }
  | { type: 'mulligan:decision'; player: PlayerId; decision: 'keep' | 'mulligan'; mulliganCount: number; reasoning?: string }
  | { type: 'mulligan:bottomCards'; player: PlayerId; cardCount: number }
  | { type: 'mulligan:complete'; message: string }

  // Game events
  | { type: 'game:log'; entry: GameLogEntry }
  | { type: 'game:over'; winner: PlayerId; reason: string }
  | { type: 'game:error'; error: string }

  // Full state sync (for reconnection)
  | { type: 'gamestate:full'; gameState: FullPlaytestGameState };

export type PlaytestEventType = PlaytestEvent['type'];

// =====================
// WebSocket Message Wrapper
// =====================

export interface PlaytestEventMessage {
  event: PlaytestEvent;
  deckId: string;
  timestamp: string;
}

// =====================
// REST API Types
// =====================

export interface StartGameRequest {
  player1DeckId: string;
  player2DeckId: string;
  config?: Partial<GameConfig>;
}

export interface StartGameResponse {
  success: boolean;
  sessionId: string;
  gameState: FullPlaytestGameState;
}

export interface GameActionRequest {
  deckId: string;
  action: GameAction;
}

export interface GameActionResponse {
  success: boolean;
  events: PlaytestEvent[];
}

// =====================
// AI Decision Types
// =====================

export interface AIDecision {
  action: GameAction;
  reasoning: string;
  confidence?: number;
}

export interface AIThinkingState {
  player: PlayerId;
  availableActions: GameAction[];
  gameStateSummary: string;
}
