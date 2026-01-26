import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CollectionCard } from '../../entities/collection-card.entity';
import { Deck } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { CardsService } from '../cards/cards.service';

interface AddToCollectionDto {
  scryfallId: string;
  quantity: number;
  foilQuantity?: number;
}

interface UpdateCollectionCardDto {
  quantity?: number;
  foilQuantity?: number;
  linkedDeckCard?: { deckId: string; deckName: string } | null;
}

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(CollectionCard)
    private collectionRepository: Repository<CollectionCard>,
    @InjectRepository(Deck)
    private deckRepository: Repository<Deck>,
    @InjectRepository(DeckCard)
    private deckCardRepository: Repository<DeckCard>,
    private cardsService: CardsService,
  ) {}

  /**
   * Get user's entire collection
   */
  async getUserCollection(
    userId: string,
    options?: { page?: number; pageSize?: number; sort?: string; search?: string },
  ) {
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

    queryBuilder
      .orderBy('collection.addedAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [cards, total] = await queryBuilder.getManyAndCount();

    // Format cards for mobile
    const formattedCards = cards.map((item) => ({
      id: item.id,
      scryfallId: item.scryfallId,
      quantity: item.quantity,
      foilQuantity: item.foilQuantity,
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
   * Get collection statistics
   */
  async getCollectionStats(userId: string) {
    const collection = await this.collectionRepository.find({
      where: { userId },
      relations: ['card'],
    });

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
   * Remove a card from collection
   */
  async removeFromCollection(id: string, userId: string): Promise<void> {
    const result = await this.collectionRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Collection card not found');
    }
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
    options?: { autoLink?: boolean },
  ): Promise<{
    imported: number;
    linked: number;
    errors: Array<{ line: string; error: string }>;
  }> {
    let imported = 0;
    let linked = 0;
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

        // Add to collection
        await this.addToCollection(userId, {
          scryfallId: card.scryfallId,
          quantity: count,
          foilQuantity: 0,
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

    // Auto-link if requested
    if (options?.autoLink && importedScryfallIds.length > 0) {
      const linkResult = await this.linkAllToDecks(userId);
      linked = linkResult.linked;
    }

    console.log(`[Collection] Bulk import complete: ${imported} imported, ${linked} linked, ${errors.length} errors`);

    return { imported, linked, errors };
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
}
