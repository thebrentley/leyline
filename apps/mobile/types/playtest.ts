export type ZoneType = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command';

export interface GameCard {
  id: string;
  name: string;
  imageUrl: string | null;
  imageSmall: string | null;
  scryfallId: string;
  manaCost: string | null;
  typeLine: string | null;
  isCommander: boolean;
  isTapped: boolean;
  counters: number;
  attachedTo: string | null;
}

export interface PlayerState {
  life: number;
  poison: number;
  commanderDamage: Record<string, number>;
  zones: {
    library: GameCard[];
    hand: GameCard[];
    battlefield: GameCard[];
    graveyard: GameCard[];
    exile: GameCard[];
    command: GameCard[];
  };
}

export interface GameState {
  player: PlayerState;
  turn: number;
  phase: 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';
  isStarted: boolean;
}

export const INITIAL_LIFE = 40; // Commander format

export function createInitialGameState(): GameState {
  return {
    player: {
      life: INITIAL_LIFE,
      poison: 0,
      commanderDamage: {},
      zones: {
        library: [],
        hand: [],
        battlefield: [],
        graveyard: [],
        exile: [],
        command: [],
      },
    },
    turn: 0,
    phase: 'untap',
    isStarted: false,
  };
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
