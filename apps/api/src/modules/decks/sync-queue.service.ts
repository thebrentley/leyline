import { Injectable, OnModuleDestroy, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Deck, DeckSyncStatus } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { DeckVersion, type VersionCard } from '../../entities/deck-version.entity';
import { User } from '../../entities/user.entity';
import { CardsService } from '../cards/cards.service';
import { EventsGateway } from '../events/events.gateway';
import { AuthService } from '../auth/auth.service';

interface SyncJob {
  deckId: string;
  archidektId: number;
  userId: string;
  token: string;
}

interface ArchidektCard {
  card: {
    uid: string;
    edition: {
      editioncode: string;
    };
    collectorNumber: string;
    oracleCard: {
      name: string;
    };
  };
  quantity: number;
  categories: string[];
  colorTag?: { name: string; color: string };
}

interface ArchidektDeck {
  id: number;
  name: string;
  format?: { name: string };
  description?: string;
  cards: ArchidektCard[];
  colorTags?: { name: string; color: string }[];
}

@Injectable()
export class SyncQueueService implements OnModuleDestroy {
  private readonly ARCHIDEKT_API = 'https://archidekt.com/api';
  private readonly RATE_LIMIT_MS = 1000; // 1 second between API calls
  private queue: SyncJob[] = [];
  private isProcessing = false;
  private shouldStop = false;

  constructor(
    @InjectRepository(Deck)
    private deckRepository: Repository<Deck>,
    @InjectRepository(DeckCard)
    private deckCardRepository: Repository<DeckCard>,
    @InjectRepository(DeckVersion)
    private deckVersionRepository: Repository<DeckVersion>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private cardsService: CardsService,
    private eventsGateway: EventsGateway,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {}

  onModuleDestroy() {
    this.shouldStop = true;
  }

  /**
   * Add a deck to the sync queue
   */
  async queueSync(deckId: string, archidektId: number, userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.archidektToken) {
      throw new Error('Archidekt not connected');
    }

    // Update deck status to waiting
    await this.deckRepository.update(deckId, {
      syncStatus: 'waiting',
      syncError: null,
    });

    // Emit WebSocket event for waiting status
    this.eventsGateway.emitDeckSyncStatus(userId, deckId, 'waiting', null, 0);

    // Add to queue
    this.queue.push({
      deckId,
      archidektId,
      userId,
      token: user.archidektToken,
    });

    console.log(`[SyncQueue] Added deck ${deckId} to queue. Queue size: ${this.queue.length}`);

    // Start processing if not already
    this.startProcessing();
  }

  /**
   * Sync all user's Archidekt decks - only fetches deck metadata, not cards
   * Cards are synced when viewing individual deck
   */
  async queueSyncAll(userId: string): Promise<{ queued: number; decks: Array<{ id: string; name: string }> }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.archidektId || !user?.archidektToken) {
      throw new Error('Archidekt not connected');
    }

    console.log('[SyncQueue] Fetching deck list for user:', user.archidektUsername, 'archidektId:', user.archidektId);

    // Fetch all decks from Archidekt (metadata only)
    const archidektDecks = await this.fetchAllArchidektDecks(user.archidektId, user.archidektToken, userId);
    
    console.log('[SyncQueue] Found', archidektDecks.length, 'decks from Archidekt');
    
    const syncedDecks: Array<{ id: string; name: string }> = [];

    for (const archDeck of archidektDecks) {
      // Find or create deck record
      let deck = await this.deckRepository.findOne({
        where: { archidektId: archDeck.id, userId },
      });

      if (!deck) {
        // New deck - create with waiting status (cards not yet synced)
        deck = this.deckRepository.create({
          archidektId: archDeck.id,
          userId,
          name: archDeck.name,
          format: archDeck.format || null,
          syncStatus: 'waiting',
          lastSyncedAt: null,
        });
        await this.deckRepository.save(deck);
      } else {
        // Existing deck - reset to waiting for re-sync
        await this.deckRepository.update(deck.id, {
          name: archDeck.name,
          syncStatus: 'waiting',
          syncError: null,
        });
      }

      // Emit WebSocket event for waiting status
      this.eventsGateway.emitDeckSyncStatus(userId, deck.id, 'waiting', null, 0);

      syncedDecks.push({ id: deck.id, name: archDeck.name });

      // Queue for card sync
      this.queue.push({
        deckId: deck.id,
        archidektId: archDeck.id,
        userId,
        token: user.archidektToken,
      });
    }

    console.log(`[SyncQueue] Queued ${syncedDecks.length} decks for sync`);

    // Start processing the queue
    this.startProcessing();

    return { queued: syncedDecks.length, decks: syncedDecks };
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): { queueSize: number; isProcessing: boolean } {
    return {
      queueSize: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Start processing the queue
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processQueue();
  }

  /**
   * Process jobs in the queue
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && !this.shouldStop) {
      const job = this.queue.shift();
      if (!job) continue;

      console.log(`[SyncQueue] Processing deck ${job.deckId} (${this.queue.length} remaining)`);

      try {
        await this.processSyncJob(job);
      } catch (error) {
        console.error(`[SyncQueue] Error processing deck ${job.deckId}:`, error);
      }

      // Rate limit
      if (this.queue.length > 0) {
        await this.delay(this.RATE_LIMIT_MS);
      }
    }

    this.isProcessing = false;
    console.log('[SyncQueue] Queue processing complete');
  }

  /**
   * Process a single sync job
   */
  private async processSyncJob(job: SyncJob): Promise<void> {
    // Update status to syncing
    await this.deckRepository.update(job.deckId, {
      syncStatus: 'syncing',
      syncError: null,
    });
    
    // Emit WebSocket event - 0% progress
    this.eventsGateway.emitDeckSyncStatus(job.userId, job.deckId, 'syncing', null, 0);

    try {
      // Fetch deck from Archidekt (throws on error, auto-refreshes token on 401)
      const archidektDeck = await this.fetchArchidektDeck(job.archidektId, job.token, job.userId);

      // Extract color tags from card labels
      // Archidekt stores color tags in the 'label' field as ',#hexcolor'
      const colorTagSet = new Set<string>();
      for (const card of archidektDeck.cards || []) {
        const label = (card as any).label;
        if (label && typeof label === 'string') {
          // Extract hex color from label (format: ',#656565')
          const match = label.match(/#[0-9A-Fa-f]{6}/);
          if (match) {
            colorTagSet.add(match[0].toUpperCase());
          }
        }
      }

      // Build colorTags array from unique colors found
      const colorTags = Array.from(colorTagSet).map(color => ({
        name: color,
        color: color,
      }));

      console.log('[SyncQueue] Extracted color tags:', colorTags);

      // 10% - Fetched deck info
      this.eventsGateway.emitDeckSyncStatus(job.userId, job.deckId, 'syncing', null, 10);

      // Update deck info
      await this.deckRepository.update(job.deckId, {
        name: archidektDeck.name,
        format: archidektDeck.format?.name || null,
        description: archidektDeck.description || null,
        colorTags,
      });

      // Delete existing cards
      await this.deckCardRepository.delete({ deckId: job.deckId });

      // 20% - Ready to fetch cards
      this.eventsGateway.emitDeckSyncStatus(job.userId, job.deckId, 'syncing', null, 20);

      // Extract set code and collector number from Archidekt cards
      const cardIdentifiers = archidektDeck.cards.map((c) => ({
        setCode: c.card.edition.editioncode,
        collectorNumber: c.card.collectorNumber,
      }));

      // Lookup cards from local database only (no Scryfall fetching)
      let fetchedCards: any[] = [];
      if (cardIdentifiers.length > 0) {
        fetchedCards =
          await this.cardsService.lookupExistingBySetCollector(cardIdentifiers);
      }

      // 70% - Fetched all cards from Scryfall
      this.eventsGateway.emitDeckSyncStatus(job.userId, job.deckId, 'syncing', null, 70);

      // Create a map of set+collector to scryfallId
      const cardMap = new Map<string, string>();
      for (const card of fetchedCards) {
        const key = `${card.setCode.toLowerCase()}:${card.collectorNumber}`;
        cardMap.set(key, card.scryfallId);
      }

      // Create deck cards only for cards that exist in our database
      const deckCards: any[] = [];
      const skippedCards: Array<{ name: string; set: string; collector: string }> = [];

      for (const archCard of archidektDeck.cards) {
        const key = `${archCard.card.edition.editioncode.toLowerCase()}:${archCard.card.collectorNumber}`;
        const scryfallId = cardMap.get(key);

        if (scryfallId) {
          const isCommander = archCard.categories.some(
            (cat) => cat.toLowerCase() === 'commander',
          );

          // Extract color tag from label field (format: ',#656565')
          let cardColorTag: string | null = null;
          const label = (archCard as any).label;
          if (label && typeof label === 'string') {
            const match = label.match(/#[0-9A-Fa-f]{6}/);
            if (match) {
              cardColorTag = match[0].toUpperCase();
            }
          }

          deckCards.push(
            this.deckCardRepository.create({
              deckId: job.deckId,
              scryfallId,
              quantity: archCard.quantity,
              colorTag: cardColorTag,
              categories: archCard.categories,
              isCommander,
            }),
          );
        } else {
          skippedCards.push({
            name: archCard.card.oracleCard.name,
            set: archCard.card.edition.editioncode,
            collector: archCard.card.collectorNumber,
          });
        }
      }

      // 85% - Created deck cards
      this.eventsGateway.emitDeckSyncStatus(job.userId, job.deckId, 'syncing', null, 85);

      if (deckCards.length > 0) {
        await this.deckCardRepository.save(deckCards);
      }

      // Log if some cards were skipped
      if (skippedCards.length > 0) {
        console.log(
          `[SyncQueue] Skipped ${skippedCards.length} cards for deck ${job.deckId}:`,
          skippedCards,
        );
      }

      // Update status to synced
      await this.deckRepository.update(job.deckId, {
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        syncError: null,
      });

      // Create a version snapshot
      await this.createVersionSnapshot(job.deckId);

      // Emit WebSocket event - 100% complete
      this.eventsGateway.emitDeckSyncStatus(job.userId, job.deckId, 'synced', null, 100);

      console.log(`[SyncQueue] Successfully synced deck ${job.deckId}`);
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error(`[SyncQueue] Failed to sync deck ${job.deckId}:`, errorMessage);

      // Update status to error
      await this.deckRepository.update(job.deckId, {
        syncStatus: 'error',
        syncError: errorMessage,
      });

      // Emit WebSocket event
      this.eventsGateway.emitDeckSyncStatus(job.userId, job.deckId, 'error', errorMessage);
    }
  }

  /**
   * Fetch all decks from Archidekt via user endpoint
   */
  private async fetchAllArchidektDecks(
    ownerId: number,
    token: string,
    userId: string,
  ): Promise<Array<{ id: number; name: string; format?: string }>> {
    let currentToken = token;

    try {
      await this.delay(this.RATE_LIMIT_MS);

      console.log('[SyncQueue] Fetching user decks from /rest-auth/user/');

      const response = await axios.get(
        `${this.ARCHIDEKT_API}/rest-auth/user/`,
        {
          headers: {
            Authorization: `JWT ${currentToken}`,
            Accept: 'application/json',
          },
        },
      );

      const userData = response.data;
      const decks = userData.decks || [];

      console.log('[SyncQueue] Found', decks.length, 'decks in user data');

      return decks.map((deck: any) => ({
        id: deck.id,
        name: deck.name,
        format: undefined, // Basic deck info doesn't include format
      }));
    } catch (error: any) {
      const status = error.response?.status;
      console.error(
        '[SyncQueue] Error fetching Archidekt user decks:',
        status,
        error.message,
      );

      // Try to auto-refresh on 401
      if (status === 401) {
        console.log('[SyncQueue] Token expired, attempting refresh...');
        const newToken = await this.authService.autoRefreshArchidektToken(userId);

        if (newToken) {
          console.log('[SyncQueue] Token refreshed, retrying...');
          return this.fetchAllArchidektDecks(ownerId, newToken, userId);
        }
      }

      return [];
    }
  }

  /**
   * Fetch a single deck from Archidekt
   */
  private async fetchArchidektDeck(
    deckId: number,
    token: string,
    userId?: string,
    isRetry = false,
  ): Promise<ArchidektDeck> {
    try {
      const response = await axios.get(
        `${this.ARCHIDEKT_API}/decks/${deckId}/`,
        {
          headers: {
            Authorization: `JWT ${token}`,
            Accept: 'application/json',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      console.error(`[SyncQueue] Error fetching deck ${deckId}:`, status, error.message);
      
      if (status === 401 && userId && !isRetry) {
        // Attempt to auto-refresh token
        console.log('[SyncQueue] Token expired, attempting auto-refresh...');
        const newToken = await this.authService.autoRefreshArchidektToken(userId);
        
        if (newToken) {
          console.log('[SyncQueue] Token refreshed, retrying fetch...');
          return this.fetchArchidektDeck(deckId, newToken, userId, true);
        }
        
        throw new Error('Archidekt token expired. Please reconnect your account.');
      }
      
      if (status === 401) {
        throw new Error('Archidekt token expired. Please reconnect your account.');
      }
      if (status === 404) {
        throw new Error('Deck not found on Archidekt');
      }
      throw new Error(`Failed to fetch deck: ${error.message}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a version snapshot after syncing
   */
  private async createVersionSnapshot(deckId: string): Promise<void> {
    try {
      const deck = await this.deckRepository.findOne({
        where: { id: deckId },
        relations: ['cards', 'cards.card'],
      });

      if (!deck) return;

      // Get current version number
      const latestVersion = await this.deckVersionRepository.findOne({
        where: { deckId },
        order: { versionNumber: 'DESC' },
      });
      const versionNumber = (latestVersion?.versionNumber || 0) + 1;

      // Create card snapshot
      const cards: VersionCard[] = deck.cards.map((c) => ({
        name: c.card?.name || 'Unknown',
        scryfallId: c.scryfallId,
        quantity: c.quantity,
        colorTag: c.colorTag,
        isCommander: c.isCommander,
        categories: c.categories,
      }));

      const version = this.deckVersionRepository.create({
        deckId,
        versionNumber,
        description: `Sync from Archidekt`,
        changeType: 'sync',
        cards,
        colorTags: deck.colorTags,
        cardCount: cards.reduce((sum, c) => sum + c.quantity, 0),
      });

      await this.deckVersionRepository.save(version);
      console.log(`[SyncQueue] Created version ${versionNumber} for deck ${deckId}`);
    } catch (error: any) {
      console.error(`[SyncQueue] Failed to create version snapshot:`, error.message);
      // Don't throw - version creation failure shouldn't fail the sync
    }
  }
}
