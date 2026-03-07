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
  options: RequestInit = {},
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
        error:
          data.message ||
          data.error ||
          `Request failed with status ${response.status}`,
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
  profilePicture: string | null;
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
  id: string;
  name: string;
  color: string;
}

export type DeckSyncStatus = "waiting" | "syncing" | "synced" | "error";
export type DeckVisibility = "private" | "public" | "pod";

export interface DeckSummary {
  id: string;
  archidektId: number | null;
  name: string;
  format: string | null;
  visibility: DeckVisibility;
  cardCount: number;
  commanders: string[];
  commanderImageCrop: string | null; // Art only (cropped)
  commanderImageFull: string | null; // Full card with border
  colors: string[];
  lastSyncedAt: string | null;
  syncStatus: DeckSyncStatus;
  syncError: string | null;
  scores: DeckScores | null;
}

export interface ExploreDeckSummary {
  id: string;
  name: string;
  format: string | null;
  cardCount: number;
  commanders: string[];
  colors: string[];
  commanderImageCrop: string | null;
  ownerName: string;
  ownerId: string;
  scores: DeckScores | null;
}

export interface ExploreFilters {
  name?: string;
  commander?: string;
  cardName?: string;
  colors?: string[];
  format?: string;
}

export interface DeckCard {
  id: string;
  scryfallId: string;
  name: string;
  quantity: number;
  setCode?: string;
  collectorNumber?: string;
  colorTag?: string;
  colorTagId?: string;
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
  visibility?: DeckVisibility;
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
  isReadOnly?: boolean;
  ownerName?: string;
  ownerId?: string;
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
  changeType: "sync" | "manual" | "advisor" | "revert";
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

export interface CollectionFolder {
  id: string;
  name: string;
  cardCount: number;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface FolderListResponse {
  folders: CollectionFolder[];
  totalCards: number;
  unfiledCount: number;
  unfiledValue: number;
}

export interface DeckGroup {
  deckId: string;
  deckName: string;
  cardCount: number;
  totalValue: number;
}

export interface DeckGroupsResponse {
  decks: DeckGroup[];
  totalCards: number;
  unlinkedCount: number;
  unlinkedValue: number;
}

export interface CollectionCard {
  id: string;
  scryfallId: string;
  quantity: number;
  foilQuantity: number;
  folderId?: string | null;
  linkedDeckCards?: Array<{ deckId: string; deckName: string }>;
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
  async login(
    email: string,
    password: string,
  ): Promise<ApiResponse<AuthResponse>> {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<ApiResponse<AuthResponse>> {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    });
  },

  async getMe(): Promise<ApiResponse<User>> {
    return request<User>("/auth/me");
  },

  async updateProfile(updates: {
    displayName?: string;
    profilePicture?: string;
  }): Promise<ApiResponse<User>> {
    return request<User>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async deleteAccount(
    password: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>("/auth/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });
  },

  async connectArchidekt(
    username: string,
    password: string,
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

  async forgotPassword(
    email: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async registerPushToken(
    token: string,
    platform?: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>("/auth/push-token", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    });
  },

  async unregisterPushToken(
    token: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>("/auth/push-token", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  },
};

// ==================== Decks API ====================

export const decksApi = {
  async list(): Promise<ApiResponse<DeckSummary[]>> {
    return request<DeckSummary[]>("/decks");
  },

  async explore(
    filters?: ExploreFilters & { page?: number; pageSize?: number },
  ): Promise<ApiResponse<PaginatedResponse<ExploreDeckSummary>>> {
    const params = new URLSearchParams();
    if (filters?.page) params.set("page", filters.page.toString());
    if (filters?.pageSize) params.set("pageSize", filters.pageSize.toString());
    if (filters?.name) params.set("name", filters.name);
    if (filters?.commander) params.set("commander", filters.commander);
    if (filters?.cardName) params.set("cardName", filters.cardName);
    if (filters?.colors?.length) params.set("colors", filters.colors.join(","));
    if (filters?.format) params.set("format", filters.format);
    const query = params.toString();
    return request<PaginatedResponse<ExploreDeckSummary>>(
      `/decks/explore${query ? `?${query}` : ""}`,
    );
  },

  async updateVisibility(
    deckId: string,
    visibility: DeckVisibility,
  ): Promise<ApiResponse<{ success: boolean; visibility: DeckVisibility }>> {
    return request<{ success: boolean; visibility: DeckVisibility }>(
      `/decks/${deckId}/visibility`,
      {
        method: "PATCH",
        body: JSON.stringify({ visibility }),
      },
    );
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
    delta: number,
  ): Promise<ApiResponse<{ success: boolean; newQuantity: number }>> {
    return request<{ success: boolean; newQuantity: number }>(
      `/decks/${deckId}/cards/quantity`,
      {
        method: "PATCH",
        body: JSON.stringify({ cardName, delta }),
      },
    );
  },

  async updateCardTag(
    deckId: string,
    cardName: string,
    tagId: string | null,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/decks/${deckId}/cards/tag`, {
      method: "PATCH",
      body: JSON.stringify({ cardName, tagId }),
    });
  },

  async setCardCommander(
    deckId: string,
    cardName: string,
    isCommander: boolean,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/decks/${deckId}/cards/commander`, {
      method: "PATCH",
      body: JSON.stringify({ cardName, isCommander }),
    });
  },

  async setCardCategory(
    deckId: string,
    cardName: string,
    category: "mainboard" | "sideboard",
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/decks/${deckId}/cards/category`, {
      method: "PATCH",
      body: JSON.stringify({ cardName, category }),
    });
  },

  async addCardToDeck(
    deckId: string,
    scryfallId: string,
    quantity: number = 1,
  ): Promise<ApiResponse<{ success: boolean; cardName: string }>> {
    return request<{ success: boolean; cardName: string }>(
      `/decks/${deckId}/cards`,
      {
        method: "POST",
        body: JSON.stringify({ scryfallId, quantity }),
      },
    );
  },

  async removeCardFromDeck(
    deckId: string,
    cardName: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(
      `/decks/${deckId}/cards/${encodeURIComponent(cardName)}`,
      {
        method: "DELETE",
      },
    );
  },

  async changeCardEdition(
    deckId: string,
    cardName: string,
    scryfallId: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/decks/${deckId}/cards/edition`, {
      method: "PATCH",
      body: JSON.stringify({ cardName, scryfallId }),
    });
  },

  async linkCardToCollection(
    deckId: string,
    cardName: string,
    collectionCardId?: string,
    forceUnlink?: boolean,
  ): Promise<
    ApiResponse<{
      success: boolean;
      linkedDeckCards?: Array<{ deckId: string; deckName: string }>;
      availablePrintings?: Array<{
        id: string;
        scryfallId: string;
        setCode: string;
        setName: string;
        collectorNumber: string;
        quantity: number;
        foilQuantity: number;
        linkedTo?: Array<{ deckId: string; deckName: string }>;
      }>;
      needsSelection?: boolean;
      editionChanged?: boolean;
    }>
  > {
    return request(`/decks/${deckId}/cards/link`, {
      method: "POST",
      body: JSON.stringify({ cardName, collectionCardId, forceUnlink }),
    });
  },

  async unlinkCardFromCollection(
    deckId: string,
    cardName: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/decks/${deckId}/cards/unlink`, {
      method: "POST",
      body: JSON.stringify({ cardName }),
    });
  },

  async addColorTag(
    deckId: string,
    name: string,
    color: string,
  ): Promise<ApiResponse<{ success: boolean; colorTags: ColorTag[] }>> {
    return request<{ success: boolean; colorTags: ColorTag[] }>(
      `/decks/${deckId}/color-tags`,
      {
        method: "POST",
        body: JSON.stringify({ name, color }),
      },
    );
  },

  async updateColorTag(
    deckId: string,
    tagId: string,
    newName: string,
    color: string,
  ): Promise<ApiResponse<{ success: boolean; colorTags: ColorTag[] }>> {
    return request<{ success: boolean; colorTags: ColorTag[] }>(
      `/decks/${deckId}/color-tags/${tagId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: newName, color }),
      },
    );
  },

  async deleteColorTag(
    deckId: string,
    tagId: string,
  ): Promise<ApiResponse<{ success: boolean; colorTags: ColorTag[] }>> {
    return request<{ success: boolean; colorTags: ColorTag[] }>(
      `/decks/${deckId}/color-tags/${tagId}`,
      {
        method: "DELETE",
      },
    );
  },

  async listArchidektDecks(): Promise<ApiResponse<ArchidektDeck[]>> {
    return request<ArchidektDeck[]>("/decks/archidekt");
  },

  async syncFromArchidekt(
    archidektId: number,
  ): Promise<ApiResponse<DeckDetail>> {
    return request<DeckDetail>(`/decks/sync/${archidektId}`, {
      method: "POST",
    });
  },

  async syncAllFromArchidekt(): Promise<
    ApiResponse<{
      queued: number;
      decks: Array<{ id: string; name: string }>;
    }>
  > {
    return request("/decks/sync-all", {
      method: "POST",
    });
  },

  async getSyncStatus(): Promise<
    ApiResponse<{
      queueSize: number;
      isProcessing: boolean;
    }>
  > {
    return request("/decks/sync/status");
  },

  // Version History
  async getVersions(deckId: string): Promise<ApiResponse<DeckVersion[]>> {
    return request<DeckVersion[]>(`/decks/${deckId}/versions`);
  },

  async getVersion(
    deckId: string,
    versionId: string,
  ): Promise<ApiResponse<DeckVersion>> {
    return request<DeckVersion>(`/decks/${deckId}/versions/${versionId}`);
  },

  async revertToVersion(
    deckId: string,
    versionId: string,
  ): Promise<ApiResponse<DeckDetail>> {
    return request<DeckDetail>(
      `/decks/${deckId}/versions/${versionId}/revert`,
      {
        method: "POST",
      },
    );
  },
};

// ==================== Collection API ====================

export const collectionApi = {
  async list(options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    folderId?: string;
    deckId?: string;
    sort?: "name" | "value" | "date";
  }): Promise<ApiResponse<PaginatedResponse<CollectionCard>>> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", options.page.toString());
    if (options?.pageSize) params.set("pageSize", options.pageSize.toString());
    if (options?.search) params.set("search", options.search);
    if (options?.folderId) params.set("folderId", options.folderId);
    if (options?.deckId) params.set("deckId", options.deckId);
    if (options?.sort) params.set("sort", options.sort);

    const query = params.toString();
    return request<PaginatedResponse<CollectionCard>>(
      `/collection${query ? `?${query}` : ""}`,
    );
  },

  async getStats(options?: {
    folderId?: string;
    deckId?: string;
  }): Promise<ApiResponse<CollectionStats>> {
    const params = new URLSearchParams();
    if (options?.folderId) params.set("folderId", options.folderId);
    if (options?.deckId) params.set("deckId", options.deckId);
    const query = params.toString();
    return request<CollectionStats>(
      `/collection/stats${query ? `?${query}` : ""}`,
    );
  },

  // ==================== Folder methods ====================

  async getFolders(): Promise<ApiResponse<FolderListResponse>> {
    return request<FolderListResponse>("/collection/folders");
  },

  async createFolder(name: string): Promise<ApiResponse<CollectionFolder>> {
    return request<CollectionFolder>("/collection/folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async renameFolder(
    folderId: string,
    name: string,
  ): Promise<ApiResponse<CollectionFolder>> {
    return request<CollectionFolder>(`/collection/folders/${folderId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  },

  async deleteFolder(
    folderId: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/collection/folders/${folderId}`, {
      method: "DELETE",
    });
  },

  async moveCardsToFolder(
    cardIds: string[],
    folderId: string | null,
  ): Promise<ApiResponse<{ moved: number }>> {
    return request<{ moved: number }>("/collection/folders/move", {
      method: "POST",
      body: JSON.stringify({ cardIds, folderId }),
    });
  },

  // ==================== Deck groups ====================

  async getDeckGroups(): Promise<ApiResponse<DeckGroupsResponse>> {
    return request<DeckGroupsResponse>("/collection/deck-groups");
  },

  async add(
    scryfallId: string,
    quantity: number,
    foilQuantity?: number,
    folderId?: string,
  ): Promise<ApiResponse<CollectionCard>> {
    return request<CollectionCard>("/collection", {
      method: "POST",
      body: JSON.stringify({ scryfallId, quantity, foilQuantity, folderId }),
    });
  },

  async update(
    id: string,
    data: {
      quantity?: number;
      foilQuantity?: number;
      linkedDeckCards?: Array<{ deckId: string; deckName: string }> | null;
    },
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

  async bulkRemove(
    cardIds: string[],
  ): Promise<ApiResponse<{ removed: number }>> {
    return request<{ removed: number }>("/collection/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ cardIds }),
    });
  },

  async getAllIds(options?: {
    search?: string;
    folderId?: string;
    deckId?: string;
  }): Promise<ApiResponse<string[]>> {
    const params = new URLSearchParams();
    if (options?.search) params.set("search", options.search);
    if (options?.folderId) params.set("folderId", options.folderId);
    if (options?.deckId) params.set("deckId", options.deckId);
    const qs = params.toString();
    return request<string[]>(`/collection/all-ids${qs ? `?${qs}` : ""}`);
  },

  async linkAllToDecks(): Promise<
    ApiResponse<{ linked: number; total: number }>
  > {
    return request<{ linked: number; total: number }>("/collection/link-all", {
      method: "POST",
    });
  },

  async bulkImport(
    lines: string[],
    options?: {
      autoLink?: boolean;
      folderId?: string;
      deckId?: string;
      overrideSet?: boolean;
      addMissing?: boolean;
    },
  ): Promise<
    ApiResponse<{
      imported: number;
      linked: number;
      added: number;
      errors: Array<{ line: string; error: string }>;
    }>
  > {
    return request("/collection/bulk-import", {
      method: "POST",
      body: JSON.stringify({ lines, options }),
    });
  },

  async linkImportedToDeck(
    scryfallIds: string[],
    deckId: string,
    options?: { overrideSet?: boolean; addMissing?: boolean },
  ): Promise<ApiResponse<{ linked: number; added: number }>> {
    return request("/collection/link-to-deck", {
      method: "POST",
      body: JSON.stringify({ scryfallIds, deckId, ...options }),
    });
  },
};

// ==================== Cards API ====================

export const cardsApi = {
  async search(
    query: string,
    page?: number,
  ): Promise<
    ApiResponse<{
      cards: CardSearchResult[];
      hasMore: boolean;
      totalCards: number;
    }>
  > {
    const params = new URLSearchParams({ q: query });
    if (page) params.set("page", page.toString());

    return request(`/cards/search?${params.toString()}`);
  },

  async searchLocal(
    query: string,
    page?: number,
    limit?: number,
  ): Promise<
    ApiResponse<{
      cards: CardSearchResult[];
      hasMore: boolean;
      totalCards: number;
      page?: number;
    }>
  > {
    const params = new URLSearchParams({ q: query });
    if (page) params.set("page", page.toString());
    if (limit) params.set("limit", limit.toString());

    return request(`/cards/search/local?${params.toString()}`);
  },

  async autocomplete(
    query: string,
  ): Promise<ApiResponse<{ suggestions: string[] }>> {
    return request<{ suggestions: string[] }>(
      `/cards/autocomplete?q=${encodeURIComponent(query)}`,
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
      `/cards/prints/${encodeURIComponent(cardName)}`,
    );
  },

  async getSets(): Promise<
    ApiResponse<Array<{ setCode: string; setName: string }>>
  > {
    return request<Array<{ setCode: string; setName: string }>>("/cards/sets");
  },

  async getTypes(): Promise<ApiResponse<string[]>> {
    return request<string[]>("/cards/types");
  },

  async fuzzyMatch(
    cardName: string,
    options?: {
      setCode?: string;
      collectorNumber?: string;
      maxDistance?: number;
      limit?: number;
    },
  ): Promise<
    ApiResponse<{
      matches: Array<
        CardSearchResult & { distance: number; confidence: number }
      >;
    }>
  > {
    return request<{
      matches: Array<
        CardSearchResult & { distance: number; confidence: number }
      >;
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
  action: "add" | "remove" | "swap";
  cardName: string;
  targetCardName?: string;
  quantity: number;
  reason: string;
  status: "pending" | "accepted" | "rejected";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
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
export type {
  PlaytestGameState,
  GameCard,
  GameZone,
} from "~/contexts/SocketContext";

export interface StartPlaytestResponse {
  success: boolean;
  gameState: import("~/contexts/SocketContext").PlaytestGameState;
}

export const playtestingApi = {
  async startGame(
    player1DeckId: string,
    player2DeckId: string,
  ): Promise<ApiResponse<StartPlaytestResponse>> {
    return request<StartPlaytestResponse>(`/playtesting/start`, {
      method: "POST",
      body: JSON.stringify({ player1DeckId, player2DeckId }),
    });
  },

  async getGameState(
    deckId: string,
  ): Promise<
    ApiResponse<{
      success: boolean;
      gameState: import("~/contexts/SocketContext").PlaytestGameState | null;
    }>
  > {
    return request<{
      success: boolean;
      gameState: import("~/contexts/SocketContext").PlaytestGameState | null;
    }>(`/playtesting/game/${deckId}`);
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

  async createSession(
    deckId: string,
    name?: string,
  ): Promise<ApiResponse<ChatSession>> {
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
    status: "accepted" | "rejected",
  ): Promise<ApiResponse<ChatSession>> {
    return request<ChatSession>(`/advisor/session/${sessionId}/change`, {
      method: "PUT",
      body: JSON.stringify({ changeId, status }),
    });
  },

  async bulkUpdateChangeStatus(
    sessionId: string,
    changeIds: string[],
    status: "accepted" | "rejected",
  ): Promise<ApiResponse<ChatSession>> {
    return request<ChatSession>(`/advisor/session/${sessionId}/changes/bulk`, {
      method: "PUT",
      body: JSON.stringify({ changeIds, status }),
    });
  },

  async deleteSession(
    sessionId: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>(`/advisor/session/${sessionId}`, {
      method: "DELETE",
    });
  },

  async updateSession(
    sessionId: string,
    updates: { name?: string },
  ): Promise<ApiResponse<ChatSession>> {
    return request<ChatSession>(`/advisor/session/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },
};

// =====================
// Deck Ranking Types
// =====================

export interface DeckScores {
  power: number;
  salt: number;
  fear: number;
  airtime: number;
}

export interface DeckScoreResponse {
  scores: DeckScores;
  layerBreakdown: {
    cardBaseline: DeckScores;
    tagInteraction: DeckScores;
    combos: DeckScores;
    commander: DeckScores;
    density: DeckScores;
    graph: DeckScores;
  };
  notableCards: {
    highPower: string[];
    highSalt: string[];
    highFear: string[];
    highAirtime: string[];
    synergyHubs: string[];
    comboCards: string[];
  } | null;
  detectedCombos: Array<{
    cardNames: string[];
    isGameWinning: boolean;
    pieceCount: number;
    description: string;
  }> | null;
  detectedEngines: Array<{
    cards: string[];
    description: string;
  }> | null;
  computedAt: string;
  isStale: boolean;
}

// =====================
// Deck Ranking API
// =====================

export const deckRankingApi = {
  async getScores(deckId: string): Promise<ApiResponse<DeckScoreResponse>> {
    return request<DeckScoreResponse>(`/deck-ranking/${deckId}/scores`);
  },

  async recompute(deckId: string): Promise<ApiResponse<DeckScoreResponse>> {
    return request<DeckScoreResponse>(`/deck-ranking/${deckId}/recompute`, {
      method: 'POST',
    });
  },
};

// ==================== Pod Types ====================

export type PodRole = "owner" | "admin" | "member";
export type RsvpStatus = "accepted" | "declined";

export interface PodSummary {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  memberCount: number;
  role: PodRole;
  nextEventAt: string | null;
  createdAt: string;
}

export interface PodDetail {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  inviteCode: string | null;
  memberCount: number;
  role: PodRole;
  members: Array<{
    id: string;
    userId: string;
    displayName: string | null;
    email: string;
    profilePicture: string | null;
    role: PodRole;
    joinedAt: string;
  }>;
  pendingInvites?: Array<{
    id: string;
    inviteId: string;
    displayName: string | null;
    email: string;
    isEmailInvite: boolean;
    invitedAt: string;
  }>;
  createdAt: string;
}

export interface PodMemberStats {
  totalGames: number;
  memberStats: Array<{
    userId: string | null;
    offlineMemberId?: string | null;
    name?: string | null;
    gamesPlayed: number;
    wins: number;
    winRate: number;
  }>;
}

export interface PodDeckStats {
  deckStats: Array<{
    deckId: string | null;
    deckName: string;
    userId: string | null;
    wins: number;
    gamesPlayed: number;
    winRate: number;
  }>;
}

export interface PodInviteInfo {
  id: string;
  pod: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
  };
  inviter: { displayName: string | null; email: string };
  createdAt: string;
}

export interface InviteTokenInfo {
  inviteId: string;
  podName: string;
  podDescription: string | null;
  inviterName: string;
  status: string;
  expired: boolean;
}

export interface PodEventSummary {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: { displayName: string | null };
  rsvpCounts: { accepted: number; declined: number; pending: number };
  myRsvp: RsvpStatus | null;
  createdAt: string;
}

export interface PodEventDetail {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: { id: string; displayName: string | null };
  rsvps: Array<{
    userId: string;
    displayName: string | null;
    email: string;
    profilePicture: string | null;
    status: RsvpStatus;
    comment: string | null;
    updatedAt: string;
  }>;
  offlineRsvps: Array<{
    offlineMemberId: string;
    name: string;
    status: RsvpStatus;
    comment: string | null;
    setBy: { id: string; displayName: string | null };
    updatedAt: string;
  }>;
  notResponded: Array<{ userId: string; displayName: string | null; email: string; profilePicture: string | null }>;
  offlineNotResponded: Array<{ offlineMemberId: string; name: string }>;
  createdAt: string;
}

export interface EventChatMessageData {
  id: string;
  eventId: string;
  userId: string;
  displayName: string | null;
  profilePicture: string | null;
  content: string;
  isSystem?: boolean;
  createdAt: string;
}

export interface EventChatHistoryResponse {
  messages: EventChatMessageData[];
  hasMore: boolean;
}

export interface PodOfflineMember {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  linkedUserId: string | null;
  linkedUser: {
    id: string;
    email: string;
    displayName: string | null;
  } | null;
  linkedAt: string | null;
  createdAt: string;
}

export interface PodUserProfile {
  id: string;
  displayName: string | null;
  email: string;
  profilePicture: string | null;
  createdAt: string;
  publicDecks: Array<{
    id: string;
    name: string;
    format: string | null;
    cardCount: number;
    commanders: string[];
    colors: string[];
    commanderImageCrop: string | null;
    scores: DeckScores | null;
  }>;
}

// ==================== Pods API ====================

export const podsApi = {
  // Pod CRUD
  async list(): Promise<ApiResponse<PodSummary[]>> {
    return request<PodSummary[]>("/pods");
  },

  async get(podId: string): Promise<ApiResponse<PodDetail>> {
    return request<PodDetail>(`/pods/${podId}`);
  },

  async create(
    name: string,
    description?: string,
  ): Promise<ApiResponse<PodSummary>> {
    return request<PodSummary>("/pods", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  },

  async update(
    podId: string,
    data: { name?: string; description?: string; coverImage?: string },
  ): Promise<ApiResponse<{ success: true }>> {
    return request("/pods/" + podId, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deletePod(podId: string): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}`, { method: "DELETE" });
  },

  // Invite code
  async joinByCode(
    inviteCode: string,
  ): Promise<ApiResponse<{ podId: string; podName: string; role: string }>> {
    return request(`/pods/join/${inviteCode}`, { method: "POST" });
  },

  async regenerateInviteCode(
    podId: string,
  ): Promise<ApiResponse<{ inviteCode: string }>> {
    return request(`/pods/${podId}/invite-code/regenerate`, { method: "POST" });
  },

  // Direct invites
  async inviteUser(
    podId: string,
    userId: string,
  ): Promise<ApiResponse<{ id: string }>> {
    return request(`/pods/${podId}/invites`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  async getPendingInvites(): Promise<ApiResponse<PodInviteInfo[]>> {
    return request<PodInviteInfo[]>("/pods/invites/pending");
  },

  async respondToInvite(
    inviteId: string,
    accept: boolean,
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/invites/${inviteId}/respond`, {
      method: "POST",
      body: JSON.stringify({ accept }),
    });
  },

  // Email invites
  async getInviteByToken(
    token: string,
  ): Promise<ApiResponse<InviteTokenInfo>> {
    return request<InviteTokenInfo>(`/pods/invite-token/${token}`);
  },

  async acceptInviteByToken(
    token: string,
  ): Promise<ApiResponse<{ success: true; podId: string }>> {
    return request(`/pods/invite-token/${token}/accept`, { method: "POST" });
  },

  async inviteByEmail(
    podId: string,
    email: string,
  ): Promise<ApiResponse<{ id: string }>> {
    return request(`/pods/${podId}/invite-email`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async rescindInvite(
    podId: string,
    inviteId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/invites/${inviteId}`, {
      method: "DELETE",
    });
  },

  async resendInviteEmail(
    podId: string,
    inviteId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/invites/${inviteId}/resend`, {
      method: "POST",
    });
  },

  // Members
  async removeMember(
    podId: string,
    userId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/members/${userId}`, { method: "DELETE" });
  },

  async promoteMember(
    podId: string,
    userId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/members/${userId}/promote`, {
      method: "PATCH",
    });
  },

  async demoteMember(
    podId: string,
    userId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/members/${userId}/demote`, {
      method: "PATCH",
    });
  },

  async leavePod(podId: string): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/leave`, { method: "POST" });
  },

  // User search & profile
  async searchUsers(
    query: string,
    podId?: string,
  ): Promise<
    ApiResponse<
      Array<{ id: string; displayName: string | null; email: string }>
    >
  > {
    let url = `/pods/users/search?q=${encodeURIComponent(query)}`;
    if (podId) url += `&podId=${encodeURIComponent(podId)}`;
    return request(url);
  },

  async getUserProfile(userId: string): Promise<ApiResponse<PodUserProfile>> {
    return request<PodUserProfile>(`/pods/users/${userId}/profile`);
  },

  // Events
  async listEvents(
    podId: string,
    upcoming?: boolean,
  ): Promise<ApiResponse<PodEventSummary[]>> {
    const params = upcoming ? "?upcoming=true" : "";
    return request<PodEventSummary[]>(`/pods/${podId}/events${params}`);
  },

  async getEvent(
    podId: string,
    eventId: string,
  ): Promise<ApiResponse<PodEventDetail>> {
    return request<PodEventDetail>(`/pods/${podId}/events/${eventId}`);
  },

  async createEvent(
    podId: string,
    data: {
      name: string;
      description?: string;
      location?: string;
      startsAt: string;
      endsAt?: string;
    },
  ): Promise<ApiResponse<PodEventSummary>> {
    return request(`/pods/${podId}/events`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateEvent(
    podId: string,
    eventId: string,
    data: {
      name?: string;
      description?: string;
      location?: string;
      startsAt?: string;
      endsAt?: string;
    },
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteEvent(
    podId: string,
    eventId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/events/${eventId}`, { method: "DELETE" });
  },

  async rsvp(
    podId: string,
    eventId: string,
    status: RsvpStatus,
    comment?: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/events/${eventId}/rsvp`, {
      method: "POST",
      body: JSON.stringify({ status, comment }),
    });
  },

  async removeRsvp(
    podId: string,
    eventId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request(`/pods/${podId}/events/${eventId}/rsvp`, {
      method: "DELETE",
    });
  },

  // Offline Members
  async addOfflineMember(
    podId: string,
    data: { name: string; email?: string; notes?: string },
  ): Promise<ApiResponse<PodOfflineMember>> {
    return request<PodOfflineMember>(`/pods/${podId}/offline-members`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async listOfflineMembers(
    podId: string,
  ): Promise<ApiResponse<PodOfflineMember[]>> {
    return request<PodOfflineMember[]>(`/pods/${podId}/offline-members`);
  },

  async updateOfflineMember(
    podId: string,
    offlineMemberId: string,
    data: { name?: string; email?: string; notes?: string },
  ): Promise<ApiResponse<PodOfflineMember>> {
    return request<PodOfflineMember>(
      `/pods/${podId}/offline-members/${offlineMemberId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  },

  async removeOfflineMember(
    podId: string,
    offlineMemberId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request<{ success: true }>(
      `/pods/${podId}/offline-members/${offlineMemberId}`,
      {
        method: "DELETE",
      },
    );
  },

  async linkOfflineMember(
    podId: string,
    offlineMemberId: string,
    userId: string,
  ): Promise<
    ApiResponse<{ id: string; linkedUserId: string; linkedAt: string }>
  > {
    return request<{ id: string; linkedUserId: string; linkedAt: string }>(
      `/pods/${podId}/offline-members/${offlineMemberId}/link`,
      {
        method: "PATCH",
        body: JSON.stringify({ userId }),
      },
    );
  },

  // Offline RSVPs
  async setOfflineRsvp(
    podId: string,
    eventId: string,
    offlineMemberId: string,
    status: RsvpStatus,
    comment?: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request<{ success: true }>(
      `/pods/${podId}/events/${eventId}/offline-rsvps/${offlineMemberId}`,
      {
        method: "POST",
        body: JSON.stringify({ status, comment }),
      },
    );
  },

  async removeOfflineRsvp(
    podId: string,
    eventId: string,
    offlineMemberId: string,
  ): Promise<ApiResponse<{ success: true }>> {
    return request<{ success: true }>(
      `/pods/${podId}/events/${eventId}/offline-rsvps/${offlineMemberId}`,
      {
        method: "DELETE",
      },
    );
  },

  async getMemberDecks(
    podId: string,
    userId: string,
  ): Promise<ApiResponse<DeckSummary[]>> {
    return request<DeckSummary[]>(`/pods/${podId}/members/${userId}/decks`);
  },

  async saveGameResult(
    podId: string,
    eventId: string,
    data: {
      startedAt: string;
      endedAt: string;
      winnerUserId: string | null;
      winnerOfflineMemberId?: string | null;
      players: Array<{
        userId: string | null;
        offlineMemberId?: string | null;
        deckName: string | null;
        deckId: string | null;
        finalLife: number;
        finalPoison: number;
        finalCommanderTax: number;
        commanderDamage: { [playerId: number]: number };
        deathOrder: number | null;
        isWinner: boolean;
      }>;
    },
  ): Promise<ApiResponse<{ success: true; id: string }>> {
    return request<{ success: true; id: string }>(
      `/pods/${podId}/events/${eventId}/game-results`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  async getChatMessages(
    podId: string,
    eventId: string,
    options?: { before?: string; limit?: number },
  ): Promise<ApiResponse<EventChatHistoryResponse>> {
    const params = new URLSearchParams();
    if (options?.before) params.set("before", options.before);
    if (options?.limit) params.set("limit", options.limit.toString());
    const query = params.toString();
    return request<EventChatHistoryResponse>(
      `/pods/${podId}/events/${eventId}/chat${query ? `?${query}` : ""}`,
    );
  },

  async sendChatMessage(
    podId: string,
    eventId: string,
    content: string,
  ): Promise<ApiResponse<EventChatMessageData>> {
    return request<EventChatMessageData>(
      `/pods/${podId}/events/${eventId}/chat`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
    );
  },

  async getMemberStats(podId: string): Promise<ApiResponse<PodMemberStats>> {
    return request<PodMemberStats>(`/pods/${podId}/insights/member-stats`);
  },

  async getDeckStats(podId: string): Promise<ApiResponse<PodDeckStats>> {
    return request<PodDeckStats>(`/pods/${podId}/insights/deck-stats`);
  },
};

export const feedbackApi = {
  async send(message: string): Promise<ApiResponse<{ success: boolean }>> {
    return request<{ success: boolean }>("/feedback", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },
};

export { API_URL };
