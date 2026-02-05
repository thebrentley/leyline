import { secureStorage } from "./storage";

// API base URL - use EXPO_PUBLIC_ environment variable
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api";

const TOKEN_KEY = "auth_token";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function getAuthToken(): Promise<string | null> {
  try {
    return await secureStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: data.message || data.error || `Request failed with status ${response.status}`,
      };
    }

    return { data };
  } catch (error) {
    console.error("API request failed:", error);
    return {
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}

// ==================== Types ====================

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  archidektId: number | null;
  archidektUsername: string | null;
  archidektConnectedAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ArchidektStatus {
  connected: boolean;
  username: string | null;
  connectedAt: string | null;
  tokenValid: boolean;
}

export interface ColorTag {
  name: string;
  color: string;
}

export type DeckSyncStatus = 'waiting' | 'syncing' | 'synced' | 'error';

export interface DeckSummary {
  id: string;
  archidektId: number | null;
  name: string;
  format: string | null;
  cardCount: number;
  commanders: string[];
  commanderImageCrop: string | null; // Art only (cropped)
  commanderImageFull: string | null; // Full card with border
  colors: string[];
  lastSyncedAt: string | null;
  syncStatus: DeckSyncStatus;
  syncError: string | null;
}

export interface DeckCard {
  id: string;
  scryfallId: string;
  name: string;
  quantity: number;
  setCode?: string;
  collectorNumber?: string;
  colorTag?: string;
  isCommander: boolean;
  categories?: string[];
  imageUrl?: string;
  imageSmall?: string;
  imageArtCrop?: string;
  manaCost?: string;
  typeLine?: string;
  colors?: string[];
  colorIdentity?: string[];
  rarity?: string;
  priceUsd?: number;
  inCollection?: boolean;
  inCollectionDifferentPrint?: boolean;
  isLinkedToCollection?: boolean;
  hasAvailableCollectionCard?: boolean;
}

export interface DeckDetail {
  id: string;
  archidektId: number | null;
  name: string;
  format: string | null;
  description: string | null;
  colorTags: ColorTag[];
  colorIdentity: string[];
  lastSyncedAt: string | null;
  syncStatus: DeckSyncStatus;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
  cardCount: number;
  commanders: DeckCard[];
  mainboard: DeckCard[];
  sideboard: DeckCard[];
}

export interface VersionCard {
  name: string;
  scryfallId: string;
  quantity: number;
  colorTag: string | null;
  isCommander: boolean;
  categories: string[];
}

export interface DeckVersion {
  id: string;
  deckId: string;
  versionNumber: number;
  description: string | null;
  changeType: 'sync' | 'manual' | 'advisor' | 'revert';
  cards: VersionCard[];
  colorTags: ColorTag[];
  cardCount: number;
  createdAt: string;
}

export interface ArchidektDeck {
  archidektId: number;
  name: string;
  format?: string;
  updatedAt?: string;
}

export interface CollectionCard {
  id: string;
  scryfallId: string;
  quantity: number;
  foilQuantity: number;
  linkedDeckCard?: { deckId: string; deckName: string } | null;
  addedAt: string;
  name?: string;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUrl?: string;
  imageSmall?: string;
  manaCost?: string;
  typeLine?: string;
  rarity?: string;
  colors?: string[];
  // Original prices (when card was added to collection)
  originalPriceUsd?: number;
  originalPriceUsdFoil?: number;
  // Current prices (from Scryfall)
  currentPriceUsd?: number;
  currentPriceUsdFoil?: number;
}

export interface CollectionStats {
  totalCards: number;
  uniqueCards: number;
  // Original value (what you paid)
  originalValue: number;
  originalRegularValue: number;
  originalFoilValue: number;
  // Current value (market prices)
  currentValue: number;
  currentRegularValue: number;
  currentFoilValue: number;
  // Gain/loss
  gainLoss: number;
  colorBreakdown: Record<string, number>;
  rarityBreakdown: Record<string, number>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CardSearchResult {
  scryfallId: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  oracleText?: string;
  rarity: string;
  colors?: string[];
  colorIdentity?: string[];
  imageUrl?: string;
  imageSmall?: string;
  imageArtCrop?: string;
  priceUsd?: number;
  priceUsdFoil?: number;
}

// ==================== Auth API ====================

export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async register(
    email: string,
    password: string,
    displayName?: string
  ): Promise<ApiResponse<AuthResponse>> {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    });
  },

  async getMe(): Promise<ApiResponse<User>> {
    return request<User>("/auth/me");
  },

  async connectArchidekt(
    username: string,
    password: string
  ): Promise<ApiResponse<User>> {
    return request<User>("/auth/archidekt/connect", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  async disconnectArchidekt(): Promise<ApiResponse<User>> {
    return request<User>("/auth/archidekt/disconnect", {
      method: "DELETE",
    });
  },

  async getArchidektStatus(): Promise<ApiResponse<ArchidektStatus>> {
    return request<ArchidektStatus>("/auth/archidekt/status");
  },
};

// ==================== Decks API ====================

export const decksApi = {
  async list(): Promise<ApiResponse<DeckSummary[]>> {
    return request<DeckSummary[]>("/decks");
  },

  async create(name: string): Promise<ApiResponse<DeckSummary>> {
    return request<DeckSummary>("/decks", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async get(id: string): Promise<ApiResponse<DeckDetail>> {
    return request<DeckDetail>(`/decks/${id}`);
  },

  async delete(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/decks/${id}`, {
      method: "DELETE",
    });
  },

  async updateCardQuantity(
    deckId: string,
    cardName: string,
    delta: number
  ): Promise<ApiResponse<{ success: boolean; newQuantity: number }>> {
    return request<{ success: boolean; newQuantity: number }>(
      `/decks/${deckId}/cards/quantity`,
      {
        method: "PATCH",
        body: JSON.stringify({ cardName, delta }),
      }
    );
  },

  async updateCardTag(
    deckId: string,
    cardName: string,
    tag: string | null
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(
      `/decks/${deckId}/cards/tag`,
      {
        method: "PATCH",
        body: JSON.stringify({ cardName, tag }),
      }
    );
  },

  async setCardCommander(
    deckId: string,
    cardName: string,
    isCommander: boolean
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(
      `/decks/${deckId}/cards/commander`,
      {
        method: "PATCH",
        body: JSON.stringify({ cardName, isCommander }),
      }
    );
  },

  async setCardCategory(
    deckId: string,
    cardName: string,
    category: 'mainboard' | 'sideboard'
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(
      `/decks/${deckId}/cards/category`,
      {
        method: "PATCH",
        body: JSON.stringify({ cardName, category }),
      }
    );
  },

  async addCardToDeck(
    deckId: string,
    scryfallId: string,
    quantity: number = 1
  ): Promise<ApiResponse<{ success: boolean; cardName: string }>> {
    return request<{ success: boolean; cardName: string }>(
      `/decks/${deckId}/cards`,
      {
        method: "POST",
        body: JSON.stringify({ scryfallId, quantity }),
      }
    );
  },

  async removeCardFromDeck(
    deckId: string,
    cardName: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(
      `/decks/${deckId}/cards/${encodeURIComponent(cardName)}`,
      {
        method: "DELETE",
      }
    );
  },

  async changeCardEdition(
    deckId: string,
    cardName: string,
    scryfallId: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(
      `/decks/${deckId}/cards/edition`,
      {
        method: "PATCH",
        body: JSON.stringify({ cardName, scryfallId }),
      }
    );
  },

  async linkCardToCollection(
    deckId: string,
    cardName: string,
    collectionCardId?: string,
    forceUnlink?: boolean
  ): Promise<ApiResponse<{
    success: boolean;
    linkedDeckCard?: { deckId: string; deckName: string };
    availablePrintings?: Array<{
      id: string;
      scryfallId: string;
      setCode: string;
      setName: string;
      collectorNumber: string;
      quantity: number;
      foilQuantity: number;
      linkedTo?: { deckId: string; deckName: string };
    }>;
    needsSelection?: boolean;
    editionChanged?: boolean;
    alreadyLinked?: { deckId: string; deckName: string };
  }>> {
    return request(
      `/decks/${deckId}/cards/link`,
      {
        method: "POST",
        body: JSON.stringify({ cardName, collectionCardId, forceUnlink }),
      }
    );
  },

  async unlinkCardFromCollection(
    deckId: string,
    cardName: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(
      `/decks/${deckId}/cards/unlink`,
      {
        method: "POST",
        body: JSON.stringify({ cardName }),
      }
    );
  },

  async addColorTag(
    deckId: string,
    name: string,
    color: string
  ): Promise<ApiResponse<{ success: boolean; colorTags: ColorTag[] }>> {
    return request<{ success: boolean; colorTags: ColorTag[] }>(
      `/decks/${deckId}/color-tags`,
      {
        method: "POST",
        body: JSON.stringify({ name, color }),
      }
    );
  },

  async updateColorTag(
    deckId: string,
    oldName: string,
    newName: string,
    color: string
  ): Promise<ApiResponse<{ success: boolean; colorTags: ColorTag[] }>> {
    return request<{ success: boolean; colorTags: ColorTag[] }>(
      `/decks/${deckId}/color-tags/${encodeURIComponent(oldName)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: newName, color }),
      }
    );
  },

  async deleteColorTag(
    deckId: string,
    tagName: string
  ): Promise<ApiResponse<{ success: boolean; colorTags: ColorTag[] }>> {
    return request<{ success: boolean; colorTags: ColorTag[] }>(
      `/decks/${deckId}/color-tags/${encodeURIComponent(tagName)}`,
      {
        method: "DELETE",
      }
    );
  },

  async listArchidektDecks(): Promise<ApiResponse<ArchidektDeck[]>> {
    return request<ArchidektDeck[]>("/decks/archidekt");
  },

  async syncFromArchidekt(archidektId: number): Promise<ApiResponse<DeckDetail>> {
    return request<DeckDetail>(`/decks/sync/${archidektId}`, {
      method: "POST",
    });
  },

  async syncAllFromArchidekt(): Promise<ApiResponse<{
    queued: number;
    decks: Array<{ id: string; name: string }>;
  }>> {
    return request("/decks/sync-all", {
      method: "POST",
    });
  },

  async getSyncStatus(): Promise<ApiResponse<{
    queueSize: number;
    isProcessing: boolean;
  }>> {
    return request("/decks/sync/status");
  },

  // Version History
  async getVersions(deckId: string): Promise<ApiResponse<DeckVersion[]>> {
    return request<DeckVersion[]>(`/decks/${deckId}/versions`);
  },

  async getVersion(deckId: string, versionId: string): Promise<ApiResponse<DeckVersion>> {
    return request<DeckVersion>(`/decks/${deckId}/versions/${versionId}`);
  },

  async revertToVersion(deckId: string, versionId: string): Promise<ApiResponse<DeckDetail>> {
    return request<DeckDetail>(`/decks/${deckId}/versions/${versionId}/revert`, {
      method: "POST",
    });
  },
};

// ==================== Collection API ====================

export const collectionApi = {
  async list(options?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<ApiResponse<PaginatedResponse<CollectionCard>>> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", options.page.toString());
    if (options?.pageSize) params.set("pageSize", options.pageSize.toString());
    if (options?.search) params.set("search", options.search);
    
    const query = params.toString();
    return request<PaginatedResponse<CollectionCard>>(
      `/collection${query ? `?${query}` : ""}`
    );
  },

  async getStats(): Promise<ApiResponse<CollectionStats>> {
    return request<CollectionStats>("/collection/stats");
  },

  async add(
    scryfallId: string,
    quantity: number,
    foilQuantity?: number
  ): Promise<ApiResponse<CollectionCard>> {
    return request<CollectionCard>("/collection", {
      method: "POST",
      body: JSON.stringify({ scryfallId, quantity, foilQuantity }),
    });
  },

  async update(
    id: string,
    data: {
      quantity?: number;
      foilQuantity?: number;
      linkedDeckCard?: { deckId: string; deckName: string } | null;
    }
  ): Promise<ApiResponse<CollectionCard>> {
    return request<CollectionCard>(`/collection/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async remove(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/collection/${id}`, {
      method: "DELETE",
    });
  },

  async linkAllToDecks(): Promise<ApiResponse<{ linked: number; total: number }>> {
    return request<{ linked: number; total: number }>("/collection/link-all", {
      method: "POST",
    });
  },

  async bulkImport(
    lines: string[],
    options?: { autoLink?: boolean }
  ): Promise<ApiResponse<{
    imported: number;
    linked: number;
    errors: Array<{ line: string; error: string }>;
  }>> {
    return request("/collection/bulk-import", {
      method: "POST",
      body: JSON.stringify({ lines, options }),
    });
  },
};

// ==================== Cards API ====================

export const cardsApi = {
  async search(
    query: string,
    page?: number
  ): Promise<ApiResponse<{
    cards: CardSearchResult[];
    hasMore: boolean;
    totalCards: number;
  }>> {
    const params = new URLSearchParams({ q: query });
    if (page) params.set("page", page.toString());

    return request(`/cards/search?${params.toString()}`);
  },

  async searchLocal(
    query: string,
    page?: number,
    limit?: number
  ): Promise<ApiResponse<{
    cards: CardSearchResult[];
    hasMore: boolean;
    totalCards: number;
    page?: number;
  }>> {
    const params = new URLSearchParams({ q: query });
    if (page) params.set("page", page.toString());
    if (limit) params.set("limit", limit.toString());

    return request(`/cards/search/local?${params.toString()}`);
  },

  async autocomplete(query: string): Promise<ApiResponse<{ suggestions: string[] }>> {
    return request<{ suggestions: string[] }>(
      `/cards/autocomplete?q=${encodeURIComponent(query)}`
    );
  },

  async get(scryfallId: string): Promise<ApiResponse<CardSearchResult>> {
    return request<CardSearchResult>(`/cards/${scryfallId}`);
  },

  async batch(scryfallIds: string[]): Promise<ApiResponse<CardSearchResult[]>> {
    return request<CardSearchResult[]>("/cards/batch", {
      method: "POST",
      body: JSON.stringify({ scryfallIds }),
    });
  },

  async getPrints(cardName: string): Promise<ApiResponse<CardSearchResult[]>> {
    return request<CardSearchResult[]>(
      `/cards/prints/${encodeURIComponent(cardName)}`
    );
  },

  async fuzzyMatch(
    cardName: string,
    options?: {
      setCode?: string;
      collectorNumber?: string;
      maxDistance?: number;
      limit?: number;
    }
  ): Promise<ApiResponse<{
    matches: Array<CardSearchResult & { distance: number; confidence: number }>;
  }>> {
    return request<{
      matches: Array<CardSearchResult & { distance: number; confidence: number }>;
    }>("/cards/fuzzy-match", {
      method: "POST",
      body: JSON.stringify({
        cardName,
        setCode: options?.setCode,
        collectorNumber: options?.collectorNumber,
        maxDistance: options?.maxDistance || 5,
        limit: options?.limit || 5,
      }),
    });
  },
};

// ==================== AI Advisor Types ====================

export interface DeckChange {
  id: string;
  action: 'add' | 'remove' | 'swap';
  cardName: string;
  targetCardName?: string;
  quantity: number;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedChanges?: DeckChange[];
}

export interface ChatSession {
  id: string;
  deckId: string;
  userId: string;
  name: string;
  messages: ChatMessage[];
  pendingChanges: DeckChange[];
  createdAt: string;
  updatedAt: string;
}

// ==================== AI Advisor API ====================

// ==================== Playtesting API ====================

// Re-export types from SocketContext for convenience
export type { PlaytestGameState, GameCard, GameZone } from "~/contexts/SocketContext";

export interface StartPlaytestResponse {
  success: boolean;
  gameState: import("~/contexts/SocketContext").PlaytestGameState;
}

export const playtestingApi = {
  async startGame(player1DeckId: string, player2DeckId: string): Promise<ApiResponse<StartPlaytestResponse>> {
    return request<StartPlaytestResponse>(`/playtesting/start`, {
      method: "POST",
      body: JSON.stringify({ player1DeckId, player2DeckId }),
    });
  },

  async getGameState(deckId: string): Promise<ApiResponse<{ success: boolean; gameState: import("~/contexts/SocketContext").PlaytestGameState | null }>> {
    return request<{ success: boolean; gameState: import("~/contexts/SocketContext").PlaytestGameState | null }>(`/playtesting/game/${deckId}`);
  },

  async endGame(deckId: string): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/playtesting/game/${deckId}`, {
      method: "DELETE",
    });
  },

  async pauseGame(deckId: string): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/playtesting/pause/${deckId}`, {
      method: "POST",
    });
  },

  async resumeGame(deckId: string): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/playtesting/resume/${deckId}`, {
      method: "POST",
    });
  },
};

// ==================== Advisor API ====================

export const advisorApi = {
  async getSessions(deckId: string): Promise<ApiResponse<ChatSession[]>> {
    return request<ChatSession[]>(`/advisor/sessions/${deckId}`);
  },

  async getSession(sessionId: string): Promise<ApiResponse<ChatSession>> {
    return request<ChatSession>(`/advisor/session/${sessionId}`);
  },

  async createSession(deckId: string, name?: string): Promise<ApiResponse<ChatSession>> {
    return request<ChatSession>("/advisor/sessions", {
      method: "POST",
      body: JSON.stringify({ deckId, name }),
    });
  },

  // Chat uses SSE streaming, handled separately with EventSource
  getChatUrl(sessionId: string): string {
    return `${API_URL}/advisor/chat/${sessionId}`;
  },

  async updateChangeStatus(
    sessionId: string,
    changeId: string,
    status: 'accepted' | 'rejected'
  ): Promise<ApiResponse<ChatSession>> {
    return request<ChatSession>(`/advisor/session/${sessionId}/change`, {
      method: "PUT",
      body: JSON.stringify({ changeId, status }),
    });
  },

  async bulkUpdateChangeStatus(
    sessionId: string,
    changeIds: string[],
    status: 'accepted' | 'rejected'
  ): Promise<ApiResponse<ChatSession>> {
    return request<ChatSession>(`/advisor/session/${sessionId}/changes/bulk`, {
      method: "PUT",
      body: JSON.stringify({ changeIds, status }),
    });
  },

  async deleteSession(sessionId: string): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/advisor/session/${sessionId}`, {
      method: "DELETE",
    });
  },

  async updateSession(sessionId: string, updates: { name?: string }): Promise<ApiResponse<ChatSession>> {
    return request<ChatSession>(`/advisor/session/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },
};

export { API_URL };
