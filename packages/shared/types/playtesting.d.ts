export type GamePhase = 'pregame' | 'beginning' | 'precombat_main' | 'combat' | 'postcombat_main' | 'ending';
export type BeginningStep = 'untap' | 'upkeep' | 'draw';
export type CombatStep = 'beginning_of_combat' | 'declare_attackers' | 'declare_blockers' | 'first_strike_damage' | 'combat_damage' | 'end_of_combat';
export type EndingStep = 'end' | 'cleanup';
export type PregameStep = 'mulligan' | 'bottom_cards';
export type GameStep = PregameStep | BeginningStep | CombatStep | EndingStep | 'main';
export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export interface ManaPool {
    W: number;
    U: number;
    B: number;
    R: number;
    G: number;
    C: number;
}
export interface ManaPayment {
    W?: number;
    U?: number;
    B?: number;
    R?: number;
    G?: number;
    C?: number;
}
export type PlayerId = 'player' | 'opponent';
export interface PlayerState {
    id: PlayerId;
    life: number;
    poisonCounters: number;
    manaPool: ManaPool;
    handOrder: string[];
    libraryOrder: string[];
    graveyardOrder: string[];
    exileOrder: string[];
    commandZone: string[];
    landPlaysRemaining: number;
    hasPassedPriority: boolean;
    mulliganCount: number;
    hasKeptHand: boolean;
    cardsToBottomCount: number;
}
export type ExtendedGameZone = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command' | 'stack';
export interface ExtendedGameCard {
    instanceId: string;
    scryfallId: string | null;
    tokenId?: string;
    isToken: boolean;
    name: string;
    owner: PlayerId;
    controller: PlayerId;
    zone: ExtendedGameZone;
    isTapped: boolean;
    isFaceDown: boolean;
    isFlipped: boolean;
    counters: Record<string, number>;
    attachedTo: string | null;
    attachments: string[];
    summoningSickness: boolean;
    damage: number;
    chosenColor?: string;
    copyOf?: string;
    originalImageUrl?: string;
    originalName?: string;
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
    commanderTax: number;
    keywords: string[];
    layout?: string | null;
    cardFaces?: {
        name: string;
        manaCost?: string;
        typeLine: string;
        oracleText?: string;
        power?: string;
        toughness?: string;
        imageUri?: string;
    }[] | null;
    activeFaceIndex?: number;
}
export type StackItemType = 'spell' | 'ability';
export type AbilityType = 'activated' | 'triggered' | 'mana';
export interface StackTarget {
    type: 'card' | 'player';
    id: string;
}
export interface StackItem {
    id: string;
    type: StackItemType;
    sourceCardId: string;
    controller: PlayerId;
    targets: StackTarget[];
    cardName?: string;
    manaCost?: string;
    abilityText?: string;
    abilityType?: AbilityType;
}
export interface AttackerInfo {
    cardId: string;
    attackingPlayerId: PlayerId;
    defendingTarget: PlayerId | string;
}
export interface BlockerInfo {
    cardId: string;
    blockingAttackerId: string;
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
    damageAssignmentOrder: Record<string, string[]>;
}
export type GameLogType = 'action' | 'phase' | 'damage' | 'life' | 'draw' | 'play' | 'ability' | 'combat' | 'system' | 'ai';
export interface GameLogEntry {
    id: string;
    timestamp: string;
    type: GameLogType;
    player: PlayerId | 'system';
    message: string;
}
export type WatchTriggerType = 'spell_cast' | 'combat_damage' | 'card_tapped' | 'card_enters' | 'card_dies' | 'life_changed';
export interface WatchCondition {
    player?: PlayerId | null;
    opponent?: boolean;
    spellType?: 'creature' | 'noncreature' | 'instant' | 'sorcery' | 'artifact' | 'enchantment';
    damageSource?: 'creature' | 'any';
    damageSourceSubtype?: string;
    damageTarget?: 'player' | 'planeswalker' | 'creature';
    cardType?: string;
    minValue?: number;
    maxValue?: number;
}
export interface WatchEffect {
    action: 'create_token' | 'sacrifice' | 'deal_damage' | 'draw_card' | 'add_mana' | 'add_counter';
    tokenType?: string;
    tokenCount?: number;
    sacrificeType?: string;
    damageAmount?: number;
    damageTarget?: 'player' | 'creature' | 'any';
    drawCount?: number;
    manaColors?: ManaColor[];
    manaAmount?: number;
    counterType?: string;
    counterAmount?: number;
    additionalCost?: {
        tapCards?: number;
        tapCardType?: string;
    };
}
export interface GameWatch {
    id: string;
    sourceCardId: string;
    controller: PlayerId;
    triggerType: WatchTriggerType;
    condition: WatchCondition;
    effect: WatchEffect;
    isActive: boolean;
}
export interface LinkedExile {
    sourceCardId: string;
    exiledCardId: string;
    returnZone: 'battlefield' | 'hand' | 'graveyard';
}
export interface FullPlaytestGameState {
    sessionId: string;
    userId: string;
    deckId: string;
    opponentDeckId: string;
    deckName: string;
    opponentDeckName: string;
    format: string;
    turnNumber: number;
    activePlayer: PlayerId;
    priorityPlayer: PlayerId | null;
    phase: GamePhase;
    step: GameStep;
    player: PlayerState;
    opponent: PlayerState;
    cards: Record<string, ExtendedGameCard>;
    battlefieldOrder: {
        player: string[];
        opponent: string[];
    };
    stack: StackItem[];
    combat: CombatState;
    watches: GameWatch[];
    linkedExiles?: LinkedExile[];
    log: GameLogEntry[];
    isGameOver: boolean;
    winner: PlayerId | null;
    gameOverReason: string | null;
    tokenUsage: CumulativeTokenUsage;
    config: GameConfig;
    updatedAt: string;
}
export interface GameConfig {
    actionDelay: number;
    phaseDelay: number;
    maxTurns: number;
    pauseOnCombat: boolean;
    pauseOnSpellCast: boolean;
}
export declare const DEFAULT_GAME_CONFIG: GameConfig;
export type GameAction = {
    type: 'pass_priority';
} | {
    type: 'concede';
} | {
    type: 'play_land';
    cardId: string;
    faceIndex?: number;
} | {
    type: 'cast_spell';
    cardId: string;
    targets?: StackTarget[];
    payingMana?: ManaPayment;
} | {
    type: 'activate_ability';
    cardId: string;
    abilityIndex: number;
    targets?: StackTarget[];
} | {
    type: 'tap_for_mana';
    cardId: string;
} | {
    type: 'declare_attackers';
    attackers: AttackerInfo[];
} | {
    type: 'declare_blockers';
    blockers: BlockerInfo[];
} | {
    type: 'assign_damage_order';
    attackerId: string;
    blockerOrder: string[];
} | {
    type: 'mulligan';
} | {
    type: 'keep_hand';
} | {
    type: 'bottom_card';
    cardId: string;
} | {
    type: 'draw_card';
} | {
    type: 'discard';
    cardId: string;
} | {
    type: 'counter_spell';
    stackItemId: string;
    sourceCardId: string;
} | {
    type: 'respond';
    cardId: string;
    targets?: StackTarget[];
};
export type GameActionType = GameAction['type'];
export type PlaytestEvent = {
    type: 'session:started';
    sessionId: string;
} | {
    type: 'session:ended';
    sessionId: string;
} | {
    type: 'turn:started';
    turnNumber: number;
    activePlayer: PlayerId;
} | {
    type: 'phase:changed';
    phase: GamePhase;
    step: GameStep;
    activePlayer: PlayerId;
} | {
    type: 'priority:changed';
    player: PlayerId | null;
} | {
    type: 'card:moved';
    cardId: string;
    cardName: string;
    player: PlayerId;
    from: ExtendedGameZone;
    to: ExtendedGameZone;
    position?: number;
} | {
    type: 'card:tapped';
    cardId: string;
    cardName: string;
    player: PlayerId;
    isTapped: boolean;
} | {
    type: 'card:flipped';
    cardId: string;
    isFaceDown: boolean;
} | {
    type: 'card:counters';
    cardId: string;
    counters: Record<string, number>;
} | {
    type: 'card:damage';
    cardId: string;
    damage: number;
    source?: string;
} | {
    type: 'card:attached';
    cardId: string;
    attachedTo: string | null;
} | {
    type: 'card:destroyed';
    cardId: string;
    reason: string;
} | {
    type: 'zone:shuffled';
    zone: ExtendedGameZone;
    player: PlayerId;
} | {
    type: 'token:created';
    tokenIds: string[];
    tokenName: string;
    controller: PlayerId;
} | {
    type: 'life:changed';
    player: PlayerId;
    life: number;
    change: number;
    source?: string;
} | {
    type: 'poison:changed';
    player: PlayerId;
    count: number;
} | {
    type: 'mana:changed';
    player: PlayerId;
    manaPool: ManaPool;
} | {
    type: 'hand:revealed';
    player: PlayerId;
    cardIds: string[];
} | {
    type: 'stack:added';
    item: StackItem;
} | {
    type: 'stack:resolved';
    itemId: string;
} | {
    type: 'stack:countered';
    itemId: string;
    reason: string;
} | {
    type: 'combat:started';
} | {
    type: 'combat:attackers';
    attackers: AttackerInfo[];
} | {
    type: 'combat:blockers';
    blockers: BlockerInfo[];
} | {
    type: 'combat:damage';
    damages: CombatDamageInfo[];
} | {
    type: 'combat:ended';
} | {
    type: 'ai:thinking';
    player: PlayerId;
    action: string;
} | {
    type: 'ai:decided';
    player: PlayerId;
    action: GameAction;
    reasoning?: string;
} | {
    type: 'ai:tokens';
    tokenUsage: CumulativeTokenUsage;
} | {
    type: 'mulligan:evaluating';
    player: PlayerId;
    mulliganCount: number;
    handSize: number;
} | {
    type: 'mulligan:decision';
    player: PlayerId;
    decision: 'keep' | 'mulligan';
    mulliganCount: number;
    reasoning?: string;
} | {
    type: 'mulligan:bottomCards';
    player: PlayerId;
    cardCount: number;
} | {
    type: 'mulligan:complete';
    message: string;
} | {
    type: 'game:log';
    entry: GameLogEntry;
} | {
    type: 'game:over';
    winner: PlayerId;
    reason: string;
} | {
    type: 'game:error';
    error: string;
} | {
    type: 'gamestate:full';
    gameState: FullPlaytestGameState;
};
export type PlaytestEventType = PlaytestEvent['type'];
export interface PlaytestEventMessage {
    event: PlaytestEvent;
    deckId: string;
    timestamp: string;
}
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
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
}
export interface CumulativeTokenUsage {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReadInputTokens: number;
    totalCacheCreationInputTokens: number;
    callCount: number;
}
export declare const DEFAULT_TOKEN_USAGE: CumulativeTokenUsage;
export interface AIDecision {
    action: GameAction;
    reasoning: string;
    confidence?: number;
    tokenUsage?: TokenUsage;
}
export interface AIThinkingState {
    player: PlayerId;
    availableActions: GameAction[];
    gameStateSummary: string;
}
