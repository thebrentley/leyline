// Re-export all playtesting types
export * from './playtesting';

// =====================
// User Types
// =====================

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  // Archidekt connection (optional)
  archidektId: number | null;
  archidektUsername: string | null;
  archidektConnectedAt: Date | null;
  createdAt: Date;
}

export interface RegisterDto {
  email: string;
  password: string;
  displayName?: string;
}

export interface ConnectArchidektDto {
  username: string;
  password: string;
}

// =====================
// Card Types (Scryfall Cache)
// =====================

export interface Card {
  scryfallId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  setName: string;
  manaCost: string | null;
  cmc: number | null;
  typeLine: string;
  oracleText: string | null;
  colors: string[];
  colorIdentity: string[];
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic';
  imageNormal: string | null;
  imageSmall: string | null;
  imageArtCrop: string | null;
  imagePng: string | null;
  priceUsd: number | null;
  priceUsdFoil: number | null;
  layout: string | null;
  cardFaces: CardFace[] | null;
  fetchedAt: Date;
  pricesUpdatedAt: Date | null;
}

export interface CardFace {
  name: string;
  manaCost?: string;
  typeLine: string;
  oracleText?: string;
  power?: string;
  toughness?: string;
  imageUri?: string;
}

// =====================
// Deck Types
// =====================

export interface ColorTag {
  id: string;
  name: string;
  color: string;
}

export interface Deck {
  id: string;
  userId: string;
  archidektId: number;
  name: string;
  format: string | null;
  lastSyncedAt: Date;
  colorTags: ColorTag[];
  cards?: DeckCard[];
}

export interface DeckCard {
  id: string;
  deckId: string;
  scryfallId: string;
  quantity: number;
  colorTagId: string | null;
  categories: string[];
  isCommander: boolean;
  card?: Card;
}

export interface DeckSummary {
  id: string;
  archidektId: number;
  name: string;
  format: string | null;
  lastSyncedAt: Date;
  cardCount: number;
  commanders: string[];
  colors: string[];
}

// =====================
// Collection Types
// =====================

export interface CollectionCard {
  id: string;
  userId: string;
  scryfallId: string;
  quantity: number;
  foilQuantity: number;
  linkedDeckCard: LinkedDeckCard | null;
  addedAt: Date;
  updatedAt: Date;
  card?: Card;
}

export interface LinkedDeckCard {
  deckId: string;
  deckName: string;
}

export interface AddToCollectionDto {
  scryfallId: string;
  quantity: number;
  foilQuantity?: number;
}

export interface UpdateCollectionCardDto {
  quantity?: number;
  foilQuantity?: number;
  linkedDeckCard?: LinkedDeckCard | null;
}

// =====================
// AI Advisor Types
// =====================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedChanges?: DeckChange[];
}

export interface DeckChange {
  id: string;
  action: 'add' | 'remove' | 'swap';
  cardName: string;
  targetCardName?: string; // For swaps
  quantity: number;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ChatSession {
  id: string;
  userId: string;
  deckId: string;
  name: string;
  messages: ChatMessage[];
  pendingChanges: DeckChange[];
  createdAt: Date;
}

export interface SendMessageDto {
  sessionId?: string;
  deckId: string;
  message: string;
}

export interface AdvisorStreamEvent {
  type: 'content' | 'changes' | 'done' | 'error';
  content?: string;
  changes?: DeckChange[];
  error?: string;
}

// =====================
// Auth Types
// =====================

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// =====================
// API Response Types
// =====================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// =====================
// Scryfall Search Types
// =====================

export interface CardSearchResult {
  cards: Card[];
  hasMore: boolean;
  totalCards: number;
}

export interface CardSearchParams {
  query: string;
  page?: number;
  unique?: 'cards' | 'art' | 'prints';
}

// =====================
// Playtesting Types
// =====================

/**
 * Base interface for all playtest messages.
 * Uses discriminated union pattern for extensibility.
 */
export interface PlaytestMessageBase {
  type: string;
  deckId: string;
  timestamp: string;
  seq: number;
}

/**
 * Sent when a playtest session starts
 */
export interface PlaytestSessionStartedMessage extends PlaytestMessageBase {
  type: 'session:started';
  sessionId: string;
}

/**
 * Sent when a playtest session ends
 */
export interface PlaytestSessionEndedMessage extends PlaytestMessageBase {
  type: 'session:ended';
  sessionId: string;
}

/**
 * Sent when there's an error in the playtest session
 */
export interface PlaytestErrorMessage extends PlaytestMessageBase {
  type: 'error';
  error: string;
}

// =====================
// Playtesting Game State Types
// =====================

/**
 * Zones where cards can exist during a game
 */
export type GameZone =
  | 'library'
  | 'hand'
  | 'battlefield'
  | 'graveyard'
  | 'exile'
  | 'command';

/**
 * A card instance in the game with a unique ID.
 * The same card can have multiple instances (e.g., 4x Lightning Bolt).
 */
export interface GameCard {
  /** Unique instance ID for this card in this game */
  instanceId: string;
  /** Reference to the Scryfall card ID */
  scryfallId: string;
  /** Card name for display */
  name: string;
  /** Current zone */
  zone: GameZone;
  /** Whether the card is tapped */
  isTapped: boolean;
  /** Whether the card is face down */
  isFaceDown: boolean;
  /** Image URL for display */
  imageUrl: string | null;
  /** Mana cost for sorting/display */
  manaCost: string | null;
  /** Type line for categorization */
  typeLine: string | null;
  /** Whether this card is a commander */
  isCommander: boolean;
}

/**
 * The complete game state for a playtest session
 */
export interface PlaytestGameState {
  /** Session identifier */
  sessionId: string;
  /** Deck being playtested */
  deckId: string;
  /** Deck name for display */
  deckName: string;
  /** Current turn number */
  turn: number;
  /** Player's life total */
  life: number;
  /** All cards in the game, keyed by instanceId */
  cards: Record<string, GameCard>;
  /** Order of cards in the library (instanceIds, top of deck first) */
  libraryOrder: string[];
  /** Order of cards in hand (instanceIds) */
  handOrder: string[];
  /** Timestamp of last update */
  updatedAt: string;
}

/**
 * Response when starting a new playtest game
 */
export interface StartPlaytestResponse {
  success: boolean;
  gameState: PlaytestGameState;
}

/**
 * Game state update message sent over WebSocket
 */
export interface PlaytestGameStateUpdateMessage extends PlaytestMessageBase {
  type: 'gamestate:update';
  gameState: PlaytestGameState;
}

/**
 * Union of all playtest message types.
 * Add new message types here as the feature expands.
 */
export type PlaytestMessage =
  | PlaytestSessionStartedMessage
  | PlaytestSessionEndedMessage
  | PlaytestErrorMessage
  | PlaytestGameStateUpdateMessage;

/**
 * Extract message type literals for type-safe event handling
 */
export type PlaytestMessageType = PlaytestMessage['type'];

/**
 * Client-to-server events for playtesting
 */
export interface PlaytestClientEvents {
  'playtest:join': { deckId: string };
  'playtest:leave': { deckId: string };
}

/**
 * Server-to-client events for playtesting
 */
export interface PlaytestServerEvents {
  'playtest:message': PlaytestMessage;
  'playtest:joined': { deckId: string; sessionId: string | null };
  'playtest:left': { deckId: string };
}
