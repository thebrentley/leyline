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
