import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In, IsNull } from 'typeorm';
import { CollectionCard } from '../../entities/collection-card.entity';
import { CollectionFolder } from '../../entities/collection-folder.entity';
import { Deck } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { CardsService } from '../cards/cards.service';

interface AddToCollectionDto {
  scryfallId: string;
  quantity: number;
  foilQuantity?: number;
  folderId?: string;
}

interface UpdateCollectionCardDto {
  quantity?: number;
  foilQuantity?: number;
  linkedDeckCard?: { deckId: string; deckName: string } | null;
}

interface CollectionFilterOptions {
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'value' | 'date';
  search?: string;
  folderId?: string;
  deckId?: string;
}

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(CollectionCard)
    private collectionRepository: Repository<CollectionCard>,
    @InjectRepository(CollectionFolder)
    private folderRepository: Repository<CollectionFolder>,
    @InjectRepository(Deck)
    private deckRepository: Repository<Deck>,
    @InjectRepository(DeckCard)
    private deckCardRepository: Repository<DeckCard>,
    private cardsService: CardsService,
  ) {}

  // ==================== Collection Filters (shared) ====================

  private applyCollectionFilters(
    queryBuilder: any,
    alias: string,
    options?: { folderId?: string; deckId?: string },
  ) {
    if (options?.folderId) {
      if (options.folderId === 'unfiled') {
        queryBuilder.andWhere(`${alias}.folderId IS NULL`);
      } else {
        queryBuilder.andWhere(`${alias}.folderId = :folderId`, {
          folderId: options.folderId,
        });
      }
    }

    if (options?.deckId) {
      if (options.deckId === 'unlinked') {
        queryBuilder.andWhere(`${alias}.linkedDeckCard IS NULL`);
      } else {
        // Use raw column name for JSONB operator since TypeORM can't translate property names with JSON operators
        queryBuilder.andWhere(`${alias}.linked_deck_card->>'deckId' = :deckId`, {
          deckId: options.deckId,
        });
      }
    }
  }

  // ==================== Folder CRUD ====================

  async getUserFolders(userId: string) {
    const folders = await this.folderRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });

    // Get card counts and values per folder in a single query
    const countQuery = await this.collectionRepository
      .createQueryBuilder('cc')
      .select('cc.folderId', 'folderId')
      .addSelect('COUNT(*)::int', 'cardCount')
      .addSelect(
        'COALESCE(SUM(cc.quantity * COALESCE(card.priceUsd, 0) + cc.foilQuantity * COALESCE(card.priceUsdFoil, 0)), 0)',
        'totalValue',
      )
      .leftJoin('cc.card', 'card')
      .where('cc.userId = :userId', { userId })
      .groupBy('cc.folderId')
      .getRawMany();

    const countMap = new Map<string | null, { cardCount: number; totalValue: number }>();
    for (const row of countQuery) {
      countMap.set(row.folderId, {
        cardCount: parseInt(row.cardCount, 10),
        totalValue: parseFloat(row.totalValue) || 0,
      });
    }

    const folderData = folders.map((f) => {
      const stats = countMap.get(f.id) || { cardCount: 0, totalValue: 0 };
      return {
        id: f.id,
        name: f.name,
        cardCount: stats.cardCount,
        totalValue: stats.totalValue,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
    });

    // Total cards across all folders
    let totalCards = 0;
    for (const [, stats] of countMap) {
      totalCards += stats.cardCount;
    }

    const unfiledStats = countMap.get(null) || { cardCount: 0, totalValue: 0 };

    return {
      folders: folderData,
      totalCards,
      unfiledCount: unfiledStats.cardCount,
      unfiledValue: unfiledStats.totalValue,
    };
  }

  async createFolder(userId: string, name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ConflictException('Folder name cannot be empty');
    }

    const existing = await this.folderRepository.findOne({
      where: { userId, name: trimmedName },
    });
    if (existing) {
      throw new ConflictException('A folder with this name already exists');
    }

    const folder = this.folderRepository.create({
      userId,
      name: trimmedName,
    });
    return this.folderRepository.save(folder);
  }

  async renameFolder(id: string, userId: string, name: string) {
    const folder = await this.folderRepository.findOne({ where: { id, userId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ConflictException('Folder name cannot be empty');
    }

    const existing = await this.folderRepository.findOne({
      where: { userId, name: trimmedName },
    });
    if (existing && existing.id !== id) {
      throw new ConflictException('A folder with this name already exists');
    }

    folder.name = trimmedName;
    return this.folderRepository.save(folder);
  }

  async deleteFolder(id: string, userId: string) {
    const result = await this.folderRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Folder not found');
    }
    // ON DELETE SET NULL handles moving cards to unfiled
  }

  async moveCardsToFolder(userId: string, cardIds: string[], folderId: string | null) {
    if (cardIds.length === 0) return { moved: 0 };

    // Validate folder exists if not unfiling
    if (folderId !== null) {
      const folder = await this.folderRepository.findOne({ where: { id: folderId, userId } });
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
    }

    // Use find + save to ensure TypeORM properly maps property names to columns
    const cards = await this.collectionRepository.find({
      where: { id: In(cardIds), userId },
    });

    for (const card of cards) {
      card.folderId = folderId;
    }

    if (cards.length > 0) {
      await this.collectionRepository.save(cards);
    }

    return { moved: cards.length };
  }

  // ==================== Deck Groups ====================

  async getDeckGroups(userId: string) {
    const collection = await this.collectionRepository.find({
      where: { userId },
      relations: ['card'],
    });

    const deckMap = new Map<string, { deckName: string; cardCount: number; totalValue: number }>();
    let unlinkedCount = 0;
    let unlinkedValue = 0;
    let totalCards = 0;

    for (const item of collection) {
      totalCards++;
      const cardValue =
        (item.quantity * Number(item.card?.priceUsd || 0)) +
        (item.foilQuantity * Number(item.card?.priceUsdFoil || 0));

      if (item.linkedDeckCard) {
        const { deckId, deckName } = item.linkedDeckCard;
        const existing = deckMap.get(deckId);
        if (existing) {
          existing.cardCount++;
          existing.totalValue += cardValue;
        } else {
          deckMap.set(deckId, { deckName, cardCount: 1, totalValue: cardValue });
        }
      } else {
        unlinkedCount++;
        unlinkedValue += cardValue;
      }
    }

    const decks = Array.from(deckMap.entries()).map(([deckId, data]) => ({
      deckId,
      deckName: data.deckName,
      cardCount: data.cardCount,
      totalValue: data.totalValue,
    }));

    // Sort by deck name
    decks.sort((a, b) => a.deckName.localeCompare(b.deckName));

    return { decks, totalCards, unlinkedCount, unlinkedValue };
  }

  // ==================== Collection List & Stats ====================

  /**
   * Get user's collection with optional folder/deck filters
   */
  async getUserCollection(userId: string, options?: CollectionFilterOptions) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoinAndSelect('collection.card', 'card')
      .where('collection.userId = :userId', { userId });

    // Add search filter if provided
    if (options?.search) {
      queryBuilder.andWhere('card.name ILIKE :search', {
        search: `%${options.search}%`,
      });
    }

    // Apply folder/deck filters
    this.applyCollectionFilters(queryBuilder, 'collection', options);

    // Apply sort
    switch (options?.sort) {
      case 'name':
        queryBuilder.orderBy('card.name', 'ASC');
        break;
      case 'value':
        queryBuilder.orderBy('card.priceUsd', 'DESC', 'NULLS LAST');
        break;
      case 'date':
      default:
        queryBuilder.orderBy('collection.addedAt', 'DESC');
        break;
    }

    queryBuilder.skip(skip).take(pageSize);

    const [cards, total] = await queryBuilder.getManyAndCount();

    // Format cards for mobile
    const formattedCards = cards.map((item) => ({
      id: item.id,
      scryfallId: item.scryfallId,
      quantity: item.quantity,
      foilQuantity: item.foilQuantity,
      folderId: item.folderId,
      linkedDeckCard: item.linkedDeckCard,
      addedAt: item.addedAt,
      name: item.card?.name,
      setCode: item.card?.setCode,
      setName: item.card?.setName,
      collectorNumber: item.card?.collectorNumber,
      imageUrl: item.card?.imageNormal,
      imageSmall: item.card?.imageSmall,
      manaCost: item.card?.manaCost,
      typeLine: item.card?.typeLine,
      rarity: item.card?.rarity,
      colors: item.card?.colors,
      // Original prices (when added to collection)
      originalPriceUsd: item.originalPriceUsd,
      originalPriceUsdFoil: item.originalPriceUsdFoil,
      // Current prices (from Scryfall)
      currentPriceUsd: item.card?.priceUsd,
      currentPriceUsdFoil: item.card?.priceUsdFoil,
    }));

    return {
      data: formattedCards,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get collection statistics, optionally scoped to a folder or deck
   */
  async getCollectionStats(
    userId: string,
    options?: { folderId?: string; deckId?: string },
  ) {
    const queryBuilder = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoinAndSelect('collection.card', 'card')
      .where('collection.userId = :userId', { userId });

    this.applyCollectionFilters(queryBuilder, 'collection', options);

    const collection = await queryBuilder.getMany();

    let totalCards = 0;
    // Original value (what you paid)
    let originalValue = 0;
    let originalFoilValue = 0;
    // Current value (current market prices)
    let currentValue = 0;
    let currentFoilValue = 0;
    const colorBreakdown: Record<string, number> = {};
    const rarityBreakdown: Record<string, number> = {};

    for (const item of collection) {
      totalCards += item.quantity + item.foilQuantity;

      // Calculate original value (from when cards were added)
      if (item.originalPriceUsd) {
        originalValue += item.quantity * Number(item.originalPriceUsd);
      }
      if (item.originalPriceUsdFoil) {
        originalFoilValue += item.foilQuantity * Number(item.originalPriceUsdFoil);
      }

      // Calculate current value (from latest Scryfall data)
      if (item.card) {
        if (item.card.priceUsd) {
          currentValue += item.quantity * item.card.priceUsd;
        }
        if (item.card.priceUsdFoil) {
          currentFoilValue += item.foilQuantity * item.card.priceUsdFoil;
        }

        // Color breakdown
        for (const color of item.card.colorIdentity || []) {
          colorBreakdown[color] = (colorBreakdown[color] || 0) + item.quantity;
        }
        if ((item.card.colorIdentity || []).length === 0) {
          colorBreakdown['C'] = (colorBreakdown['C'] || 0) + item.quantity;
        }

        // Rarity breakdown
        const rarity = item.card.rarity || 'unknown';
        rarityBreakdown[rarity] = (rarityBreakdown[rarity] || 0) + item.quantity;
      }
    }

    return {
      totalCards,
      uniqueCards: collection.length,
      // Original value (what you paid)
      originalValue: originalValue + originalFoilValue,
      originalRegularValue: originalValue,
      originalFoilValue: originalFoilValue,
      // Current value (market prices)
      currentValue: currentValue + currentFoilValue,
      currentRegularValue: currentValue,
      currentFoilValue: currentFoilValue,
      // Gain/loss
      gainLoss: (currentValue + currentFoilValue) - (originalValue + originalFoilValue),
      colorBreakdown,
      rarityBreakdown,
    };
  }

  /**
   * Add a card to collection
   */
  async addToCollection(
    userId: string,
    dto: AddToCollectionDto,
  ): Promise<CollectionCard> {
    // Ensure card exists in cache and get current prices
    const cardData = await this.cardsService.getOrFetch(dto.scryfallId);

    // Check if card already in collection
    const existing = await this.collectionRepository.findOne({
      where: { userId, scryfallId: dto.scryfallId },
    });

    if (existing) {
      // Update quantity - original prices stay the same
      existing.quantity += dto.quantity;
      existing.foilQuantity += dto.foilQuantity || 0;
      return this.collectionRepository.save(existing);
    }

    // Create new collection card with original prices captured
    const card = this.collectionRepository.create({
      userId,
      scryfallId: dto.scryfallId,
      quantity: dto.quantity,
      foilQuantity: dto.foilQuantity || 0,
      folderId: dto.folderId || null,
      // Capture prices at time of addition
      originalPriceUsd: cardData.priceUsd || null,
      originalPriceUsdFoil: cardData.priceUsdFoil || null,
    });

    return this.collectionRepository.save(card);
  }

  /**
   * Update a collection card
   */
  async updateCollectionCard(
    id: string,
    userId: string,
    dto: UpdateCollectionCardDto,
  ): Promise<CollectionCard> {
    const card = await this.collectionRepository.findOne({
      where: { id, userId },
      relations: ['card'],
    });

    if (!card) {
      throw new NotFoundException('Collection card not found');
    }

    if (dto.quantity !== undefined) {
      card.quantity = dto.quantity;
    }
    if (dto.foilQuantity !== undefined) {
      card.foilQuantity = dto.foilQuantity;
    }
    if (dto.linkedDeckCard !== undefined) {
      card.linkedDeckCard = dto.linkedDeckCard;
    }

    return this.collectionRepository.save(card);
  }

  /**
   * Get all card IDs matching current filters (for select-all)
   */
  async getAllCardIds(
    userId: string,
    options?: { search?: string; folderId?: string; deckId?: string },
  ): Promise<string[]> {
    const queryBuilder = this.collectionRepository
      .createQueryBuilder('collection')
      .select('collection.id')
      .where('collection.userId = :userId', { userId });

    if (options?.search) {
      queryBuilder
        .leftJoin('collection.card', 'card')
        .andWhere('card.name ILIKE :search', {
          search: `%${options.search}%`,
        });
    }

    this.applyCollectionFilters(queryBuilder, 'collection', options);

    const results = await queryBuilder.getRawMany();
    return results.map((r) => r.collection_id);
  }

  /**
   * Remove a card from collection
   */
  async removeFromCollection(id: string, userId: string): Promise<void> {
    const result = await this.collectionRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Collection card not found');
    }
  }

  /**
   * Bulk remove cards from collection
   */
  async bulkRemove(userId: string, cardIds: string[]): Promise<{ removed: number }> {
    if (cardIds.length === 0) return { removed: 0 };

    const result = await this.collectionRepository.delete({
      id: In(cardIds),
      userId,
    });

    return { removed: result.affected ?? 0 };
  }

  /**
   * Check which cards from a deck are in collection
   */
  async checkDeckOwnership(
    userId: string,
    scryfallIds: string[],
  ): Promise<Map<string, { owned: number; needed: number }>> {
    const collection = await this.collectionRepository.find({
      where: { userId },
    });

    const ownedMap = new Map<string, number>();
    for (const card of collection) {
      ownedMap.set(card.scryfallId, card.quantity + card.foilQuantity);
    }

    const result = new Map<string, { owned: number; needed: number }>();
    for (const id of scryfallIds) {
      const owned = ownedMap.get(id) || 0;
      result.set(id, { owned, needed: Math.max(0, 1 - owned) });
    }

    return result;
  }

  /**
   * Bulk import cards from text lines
   * Format: <count> <name> (<set>) <number>
   */
  async bulkImport(
    userId: string,
    lines: string[],
    options?: {
      autoLink?: boolean;
      folderId?: string;
      deckId?: string;
      overrideSet?: boolean;
      addMissing?: boolean;
    },
  ): Promise<{
    imported: number;
    linked: number;
    added: number;
    errors: Array<{ line: string; error: string }>;
  }> {
    let imported = 0;
    let linked = 0;
    let added = 0;
    const errors: Array<{ line: string; error: string }> = [];
    const importedScryfallIds: string[] = [];

    // Filter non-empty lines
    const validLines = lines.filter((l) => l.trim());

    console.log(`[Collection] Starting bulk import of ${validLines.length} lines...`);

    for (const line of validLines) {
      const trimmed = line.trim();

      try {
        // Parse: <count> <name> (<set>) <number>
        const match = trimmed.match(/^(\d+)\s+(.+?)\s+\(([A-Za-z0-9]+)\)\s+(\S+)$/);

        if (!match) {
          errors.push({
            line: trimmed,
            error: 'Invalid format. Expected: <count> <name> (<set>) <number>',
          });
          continue;
        }

        const [, countStr, name, setCode, collectorNumber] = match;
        const count = parseInt(countStr, 10);

        if (isNaN(count) || count < 1) {
          errors.push({ line: trimmed, error: 'Invalid count' });
          continue;
        }

        // Rate limit - small delay to avoid hammering Scryfall
        await new Promise((resolve) => setTimeout(resolve, 75));

        // Fetch card from Scryfall by set and collector number
        const card = await this.cardsService.getBySetAndNumber(setCode, collectorNumber);

        if (!card) {
          errors.push({
            line: trimmed,
            error: `Card not found: ${setCode} #${collectorNumber}`,
          });
          continue;
        }

        // Add to collection (with optional folder destination)
        await this.addToCollection(userId, {
          scryfallId: card.scryfallId,
          quantity: count,
          foilQuantity: 0,
          folderId: options?.folderId || undefined,
        });

        imported++;
        importedScryfallIds.push(card.scryfallId);
      } catch (err: any) {
        errors.push({
          line: trimmed,
          error: err.message || 'Unknown error',
        });
      }
    }

    // Auto-link to all decks if requested
    if (options?.autoLink && importedScryfallIds.length > 0) {
      const linkResult = await this.linkAllToDecks(userId);
      linked = linkResult.linked;
    }

    // Link to specific deck if requested
    if (options?.deckId && importedScryfallIds.length > 0) {
      const linkResult = await this.linkImportedToDeck(
        userId,
        importedScryfallIds,
        options.deckId,
        { overrideSet: options.overrideSet, addMissing: options.addMissing },
      );
      linked = linkResult.linked;
      added = linkResult.added;
    }

    console.log(`[Collection] Bulk import complete: ${imported} imported, ${linked} linked, ${added} added to deck, ${errors.length} errors`);

    return { imported, linked, added, errors };
  }

  /**
   * Auto-link collection cards to deck cards
   * Links by matching scryfallId (exact card match)
   */
  async linkAllToDecks(userId: string): Promise<{ linked: number; total: number }> {
    // Get all user's decks with their cards
    const decks = await this.deckRepository.find({
      where: { userId },
      relations: ['cards'],
    });

    // Build a map of scryfallId -> deck info
    const deckCardMap = new Map<string, { deckId: string; deckName: string }>();
    for (const deck of decks) {
      for (const deckCard of deck.cards) {
        // Only map if not already mapped (first deck wins)
        if (!deckCardMap.has(deckCard.scryfallId)) {
          deckCardMap.set(deckCard.scryfallId, {
            deckId: deck.id,
            deckName: deck.name,
          });
        }
      }
    }

    // Get all unlinked collection cards
    const collection = await this.collectionRepository.find({
      where: { userId },
    });

    let linked = 0;
    for (const collectionCard of collection) {
      // Skip if already linked
      if (collectionCard.linkedDeckCard) continue;

      const deckInfo = deckCardMap.get(collectionCard.scryfallId);
      if (deckInfo) {
        collectionCard.linkedDeckCard = deckInfo;
        await this.collectionRepository.save(collectionCard);
        linked++;
      }
    }

    return { linked, total: collection.length };
  }

  /**
   * Link imported collection cards to a specific deck.
   *
   * For each imported scryfallId:
   * 1. Find the collection card for that scryfallId
   * 2. Skip if already linked (links are one-to-one; new card goes unfiled)
   * 3. Try exact match: deck has a card with same scryfallId → link
   * 4. If overrideSet: try name match on unlinked deck cards → update deck card's scryfallId to the imported one, then link
   * 5. If addMissing: no match at all → add a new DeckCard to the deck, then link
   */
  async linkImportedToDeck(
    userId: string,
    importedScryfallIds: string[],
    deckId: string,
    options?: { overrideSet?: boolean; addMissing?: boolean },
  ): Promise<{ linked: number; added: number }> {
    if (importedScryfallIds.length === 0) return { linked: 0, added: 0 };

    // Verify deck ownership
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
    });
    if (!deck) throw new NotFoundException('Deck not found');

    // Load deck cards with their card relations (for name matching)
    const deckCards = await this.deckCardRepository.find({
      where: { deckId },
      relations: ['card'],
    });

    // Load collection cards for the imported scryfallIds
    const collectionCards = await this.collectionRepository.find({
      where: {
        userId,
        scryfallId: In(importedScryfallIds),
      },
      relations: ['card'],
    });

    // Build lookup: scryfallId → collection card
    const collectionMap = new Map<string, CollectionCard>();
    for (const cc of collectionCards) {
      collectionMap.set(cc.scryfallId, cc);
    }

    // Track which deck cards have been claimed by a link (to prevent double-linking)
    const claimedDeckCardIds = new Set<string>();

    // Pre-collect linked scryfallIds from existing collection cards to avoid re-querying
    const existingLinkedScryfallIds = new Set(
      collectionCards
        .filter((cc) => cc.linkedDeckCard)
        .map((cc) => cc.scryfallId),
    );

    let linked = 0;
    let added = 0;

    for (const scryfallId of importedScryfallIds) {
      const collectionCard = collectionMap.get(scryfallId);
      if (!collectionCard) continue;

      // Skip if already linked (one-to-one; this card stays unfiled)
      if (existingLinkedScryfallIds.has(scryfallId)) continue;

      // 1. Try exact scryfallId match in deck
      const exactMatch = deckCards.find(
        (dc) => dc.scryfallId === scryfallId && !claimedDeckCardIds.has(dc.id),
      );

      if (exactMatch) {
        collectionCard.linkedDeckCard = { deckId, deckName: deck.name };
        await this.collectionRepository.save(collectionCard);
        claimedDeckCardIds.add(exactMatch.id);
        existingLinkedScryfallIds.add(scryfallId);
        linked++;
        continue;
      }

      // 2. If overrideSet: find deck card matching by name that isn't already claimed
      if (options?.overrideSet && collectionCard.card?.name) {
        const cardName = collectionCard.card.name.toLowerCase();

        const nameMatch = deckCards.find(
          (dc) =>
            dc.card?.name?.toLowerCase() === cardName &&
            !claimedDeckCardIds.has(dc.id),
        );

        if (nameMatch) {
          // Update the deck card to point to the imported card's scryfallId
          nameMatch.scryfallId = scryfallId;
          await this.deckCardRepository.save(nameMatch);

          // Link the collection card
          collectionCard.linkedDeckCard = { deckId, deckName: deck.name };
          await this.collectionRepository.save(collectionCard);
          claimedDeckCardIds.add(nameMatch.id);
          existingLinkedScryfallIds.add(scryfallId);
          linked++;
          continue;
        }
      }

      // 3. If addMissing: add a new deck card and link
      if (options?.addMissing) {
        const newDeckCard = this.deckCardRepository.create({
          deckId,
          scryfallId,
          quantity: 1,
          categories: ['Mainboard'],
          isCommander: false,
        });
        await this.deckCardRepository.save(newDeckCard);

        collectionCard.linkedDeckCard = { deckId, deckName: deck.name };
        await this.collectionRepository.save(collectionCard);
        existingLinkedScryfallIds.add(scryfallId);
        linked++;
        added++;
        continue;
      }
    }

    return { linked, added };
  }
}
