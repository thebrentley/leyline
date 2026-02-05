// Playtesting types - copied from packages/shared/types/playtesting.ts
// Keep in sync with the shared package

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
// Token Usage Tracking
// =====================

export interface CumulativeTokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadInputTokens: number;
  totalCacheCreationInputTokens: number;
  callCount: number;
}

// =====================
// Full Game State
// =====================

export interface GameConfig {
  actionDelay: number; // Delay between AI actions (ms)
  phaseDelay: number; // Delay between phases (ms)
  maxTurns: number; // Maximum turns before draw
  pauseOnCombat: boolean;
  pauseOnSpellCast: boolean;
}

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

  // Token tracking for AI calls
  tokenUsage?: CumulativeTokenUsage;

  // Configuration
  config: GameConfig;

  updatedAt: string;
}
