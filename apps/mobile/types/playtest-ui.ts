import type {
  ExtendedGameCard,
  FullPlaytestGameState,
  GamePhase,
  GameStep,
  PlayerId,
  StackItem,
  CombatState,
  ManaPool,
} from "./playtesting";

// Card sizing constants
export const CARD_SIZES = {
  full: { width: 146, height: 204 },
  battlefield: { width: 96, height: 134 },
  hand: { width: 112, height: 156 },
  pile: { width: 80, height: 112 },
} as const;

export type CardSize = keyof typeof CARD_SIZES;

// UI State for the playtest view
export interface PlaytestUIState {
  expandedHand: PlayerId | null;
  previewCardId: string | null;
  selectedCardId: string | null;
}

export type PlaytestUIAction =
  | { type: "SET_EXPANDED_HAND"; hand: PlayerId | null }
  | { type: "SET_PREVIEW_CARD"; cardId: string | null }
  | { type: "SET_SELECTED_CARD"; cardId: string | null };

export const initialPlaytestUIState: PlaytestUIState = {
  expandedHand: null,
  previewCardId: null,
  selectedCardId: null,
};

export function playtestUIReducer(
  state: PlaytestUIState,
  action: PlaytestUIAction,
): PlaytestUIState {
  switch (action.type) {
    case "SET_EXPANDED_HAND":
      return { ...state, expandedHand: action.hand };
    case "SET_PREVIEW_CARD":
      return { ...state, previewCardId: action.cardId };
    case "SET_SELECTED_CARD":
      return { ...state, selectedCardId: action.cardId };
    default:
      return state;
  }
}

// Derived state for rendering
export interface DerivedPlayerState {
  creatures: ExtendedGameCard[];
  artifactsEnchantments: ExtendedGameCard[];
  lands: ExtendedGameCard[];
  hand: ExtendedGameCard[];
  commander: ExtendedGameCard | null;
  libraryCount: number;
  graveyard: ExtendedGameCard[];
  exile: ExtendedGameCard[];
  life: number;
  manaPool: ManaPool;
  hasPassedPriority: boolean;
}

export interface DerivedGameState {
  player: DerivedPlayerState;
  opponent: DerivedPlayerState;
  stack: StackItem[];
  combat: CombatState;
  phase: GamePhase;
  step: GameStep;
  turnNumber: number;
  activePlayer: PlayerId;
  priorityPlayer: PlayerId | null;
  isGameOver: boolean;
  winner: PlayerId | null;
  playerName: string;
  opponentName: string;
}

// Helper to categorize cards by type
function categorizeCard(
  card: ExtendedGameCard,
): "creature" | "artifactEnchantment" | "land" {
  const typeLine = card.typeLine?.toLowerCase() || "";

  if (typeLine.includes("land")) {
    return "land";
  }
  if (typeLine.includes("creature")) {
    return "creature";
  }
  // Artifacts, enchantments, planeswalkers go in middle row
  return "artifactEnchantment";
}

// Derive view state from full game state
export function deriveGameState(
  gameState: FullPlaytestGameState,
): DerivedGameState {
  const cards = Object.values(gameState.cards);

  const getPlayerCards = (playerId: PlayerId) => {
    const playerState =
      playerId === "player" ? gameState.player : gameState.opponent;

    // Get battlefield cards for this player
    const battlefieldCards = cards.filter(
      (c) => c.zone === "battlefield" && c.controller === playerId,
    );

    const creatures: ExtendedGameCard[] = [];
    const artifactsEnchantments: ExtendedGameCard[] = [];
    const lands: ExtendedGameCard[] = [];

    battlefieldCards.forEach((card) => {
      const category = categorizeCard(card);
      if (category === "creature") {
        creatures.push(card);
      } else if (category === "land") {
        lands.push(card);
      } else {
        artifactsEnchantments.push(card);
      }
    });

    // Get hand cards
    const hand = playerState.handOrder
      .map((id) => gameState.cards[id])
      .filter(Boolean);

    // Get commander
    const commander =
      playerState.commandZone.length > 0
        ? gameState.cards[playerState.commandZone[0]] || null
        : null;

    // Get graveyard cards
    const graveyard = playerState.graveyardOrder
      .map((id) => gameState.cards[id])
      .filter(Boolean);

    // Get exile cards
    const exile = playerState.exileOrder
      .map((id) => gameState.cards[id])
      .filter(Boolean);

    return {
      creatures,
      artifactsEnchantments,
      lands,
      hand,
      commander,
      libraryCount: playerState.libraryOrder.length,
      graveyard,
      exile,
      life: playerState.life,
      manaPool: playerState.manaPool,
      hasPassedPriority: playerState.hasPassedPriority,
    };
  };

  return {
    player: getPlayerCards("player"),
    opponent: getPlayerCards("opponent"),
    stack: gameState.stack,
    combat: gameState.combat,
    phase: gameState.phase,
    step: gameState.step,
    turnNumber: gameState.turnNumber,
    activePlayer: gameState.activePlayer,
    priorityPlayer: gameState.priorityPlayer,
    isGameOver: gameState.isGameOver,
    winner: gameState.winner,
    playerName: gameState.deckName,
    opponentName: gameState.opponentDeckName,
  };
}

// Phase display labels
export const PHASE_LABELS: Record<GamePhase, string> = {
  pregame: "Pregame",
  beginning: "Beginning",
  precombat_main: "Main 1",
  combat: "Combat",
  postcombat_main: "Main 2",
  ending: "End",
};

export const STEP_LABELS: Record<GameStep, string> = {
  mulligan: "Mulligan",
  bottom_cards: "Bottom",
  untap: "Untap",
  upkeep: "Upkeep",
  draw: "Draw",
  main: "Main",
  beginning_of_combat: "Begin",
  declare_attackers: "Attack",
  declare_blockers: "Block",
  first_strike_damage: "1st Strike",
  combat_damage: "Damage",
  end_of_combat: "End",
  end: "End Step",
  cleanup: "Cleanup",
};

// Phase/step ordering for display
export const PHASE_ORDER: GamePhase[] = [
  "beginning",
  "precombat_main",
  "combat",
  "postcombat_main",
  "ending",
];

export const STEPS_BY_PHASE: Record<GamePhase, GameStep[]> = {
  pregame: ["mulligan", "bottom_cards"],
  beginning: ["untap", "upkeep", "draw"],
  precombat_main: ["main"],
  combat: [
    "beginning_of_combat",
    "declare_attackers",
    "declare_blockers",
    "first_strike_damage",
    "combat_damage",
    "end_of_combat",
  ],
  postcombat_main: ["main"],
  ending: ["end", "cleanup"],
};
