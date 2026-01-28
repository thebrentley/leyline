import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Deck } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { DeckVersion, type VersionCard } from '../../entities/deck-version.entity';
import { User } from '../../entities/user.entity';
import { CollectionCard } from '../../entities/collection-card.entity';
import { CardsService } from '../cards/cards.service';
import { AuthService } from '../auth/auth.service';

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
export class DecksService {
  private readonly ARCHIDEKT_API = 'https://archidekt.com/api';
  private lastArchidektRequest = 0;
  private readonly ARCHIDEKT_RATE_LIMIT_MS = 500; // 500ms between requests

  constructor(
    @InjectRepository(Deck)
    private deckRepository: Repository<Deck>,
    @InjectRepository(DeckCard)
    private deckCardRepository: Repository<DeckCard>,
    @InjectRepository(DeckVersion)
    private deckVersionRepository: Repository<DeckVersion>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CollectionCard)
    private collectionRepository: Repository<CollectionCard>,
    private cardsService: CardsService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {}

  /**
   * Rate limit Archidekt API requests
   */
  private async archidektRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastArchidektRequest;
    if (elapsed < this.ARCHIDEKT_RATE_LIMIT_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.ARCHIDEKT_RATE_LIMIT_MS - elapsed),
      );
    }
    this.lastArchidektRequest = Date.now();
  }

  /**
   * Get all decks for a user
   */
  async getUserDecks(userId: string) {
    const decks = await this.deckRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });

    return Promise.all(
      decks.map(async (deck) => {
        // Get all cards to calculate total quantity (not just count of unique cards)
        const allCards = await this.deckCardRepository.find({
          where: { deckId: deck.id },
        });
        const cardCount = allCards.reduce((sum, c) => sum + c.quantity, 0);

        const commanders = await this.deckCardRepository.find({
          where: { deckId: deck.id, isCommander: true },
          relations: ['card'],
        });

        // Get primary commander (first one) for image
        const primaryCommander = commanders[0]?.card;
        
        // Debug logging
        if (commanders.length > 0) {
          console.log(`[Deck ${deck.name}] Commanders found:`, commanders.length);
          console.log(`[Deck ${deck.name}] Primary commander:`, primaryCommander?.name);
          console.log(`[Deck ${deck.name}] imageArtCrop:`, primaryCommander?.imageArtCrop?.substring(0, 50) || 'null');
          console.log(`[Deck ${deck.name}] imageNormal:`, primaryCommander?.imageNormal?.substring(0, 50) || 'null');
        } else {
          console.log(`[Deck ${deck.name}] No commanders found`);
        }
        
        return {
          id: deck.id,
          archidektId: deck.archidektId,
          name: deck.name,
          format: deck.format,
          lastSyncedAt: deck.lastSyncedAt,
          syncStatus: deck.syncStatus,
          syncError: deck.syncError,
          cardCount,
          commanders: commanders.map((c) => c.card?.name).filter(Boolean),
          commanderImageCrop: primaryCommander?.imageArtCrop || null,
          commanderImageFull: primaryCommander?.imageNormal || null,
          colors: this.extractColors(commanders),
        };
      }),
    );
  }

  /**
   * Find or create a deck record for syncing
   */
  async findOrCreateDeck(archidektId: number, userId: string): Promise<Deck> {
    let deck = await this.deckRepository.findOne({
      where: { archidektId, userId },
    });

    if (!deck) {
      deck = this.deckRepository.create({
        archidektId,
        userId,
        name: `Deck ${archidektId}`, // Will be updated during sync
        syncStatus: 'waiting',
        lastSyncedAt: null,
      });
      await this.deckRepository.save(deck);
    }

    return deck;
  }

  /**
   * Get a single deck with all cards (raw entity)
   */
  async getDeck(deckId: string, userId: string): Promise<Deck> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    return deck;
  }

  /**
   * Get a deck with formatted card data for mobile
   */
  async getDeckWithCards(deckId: string, userId: string) {
    const deck = await this.getDeck(deckId, userId);

    // Get user's collection to check which cards they own
    const collectionCards = await this.collectionRepository.find({
      where: { userId },
      relations: ['card'],
    });

    // Build lookup maps for collection
    const collectionByScryfall = new Map<string, any>();
    const collectionByName = new Map<string, any[]>();

    for (const collCard of collectionCards) {
      collectionByScryfall.set(collCard.scryfallId, collCard);

      const cardName = collCard.card?.name;
      if (cardName) {
        if (!collectionByName.has(cardName)) {
          collectionByName.set(cardName, []);
        }
        collectionByName.get(cardName)!.push(collCard);
      }
    }

    // Group cards by category
    const commanders: any[] = [];
    const mainboard: any[] = [];
    const sideboard: any[] = [];

    for (const deckCard of deck.cards) {
      const cardName = deckCard.card?.name || 'Unknown';

      // Check if exact printing is in collection
      const exactCollectionCard = collectionByScryfall.get(deckCard.scryfallId);
      const inCollectionExact = !!exactCollectionCard;

      // Check if same card name but different printing is in collection
      const cardsWithSameName = collectionByName.get(cardName) || [];
      const differentPrintCards = cardsWithSameName.filter(
        (cc) => cc.scryfallId !== deckCard.scryfallId
      );
      const inCollectionDifferentPrint = differentPrintCards.length > 0;

      // Check if this card is linked to this deck in collection
      const linkedCollectionCard = cardsWithSameName.find(
        (cc) => cc.linkedDeckCard?.deckId === deck.id
      );
      const isLinkedToCollection = !!linkedCollectionCard;

      // Check if there are any available (unlinked) collection cards to link
      // A card is available if it's not linked to a different deck
      const availableExact = exactCollectionCard &&
        (!exactCollectionCard.linkedDeckCard || exactCollectionCard.linkedDeckCard.deckId === deck.id);
      const availableDifferent = differentPrintCards.some(
        (cc) => !cc.linkedDeckCard || cc.linkedDeckCard.deckId === deck.id
      );
      const hasAvailableCollectionCard = availableExact || availableDifferent;

      const cardData = {
        id: deckCard.id,
        scryfallId: deckCard.scryfallId,
        name: cardName,
        quantity: deckCard.quantity,
        setCode: deckCard.card?.setCode,
        collectorNumber: deckCard.card?.collectorNumber,
        colorTag: deckCard.colorTag,
        isCommander: deckCard.isCommander,
        categories: deckCard.categories,
        imageUrl: deckCard.card?.imageNormal,
        imageSmall: deckCard.card?.imageSmall,
        imageArtCrop: deckCard.card?.imageArtCrop,
        manaCost: deckCard.card?.manaCost,
        typeLine: deckCard.card?.typeLine,
        colors: deckCard.card?.colors,
        colorIdentity: deckCard.card?.colorIdentity,
        rarity: deckCard.card?.rarity,
        priceUsd: deckCard.card?.priceUsd,
        inCollection: inCollectionExact,
        inCollectionDifferentPrint: inCollectionDifferentPrint,
        isLinkedToCollection: isLinkedToCollection,
        hasAvailableCollectionCard: hasAvailableCollectionCard,
      };

      if (deckCard.isCommander) {
        commanders.push(cardData);
      } else if (
        deckCard.categories.some((c) => c.toLowerCase() === 'sideboard')
      ) {
        sideboard.push(cardData);
      } else {
        mainboard.push(cardData);
      }
    }

    // Extract color identity from commanders
    const colorIdentity = this.extractColors(
      deck.cards.filter((c) => c.isCommander),
    );

    return {
      id: deck.id,
      archidektId: deck.archidektId,
      name: deck.name,
      format: deck.format,
      description: deck.description,
      colorTags: deck.colorTags,
      colorIdentity,
      lastSyncedAt: deck.lastSyncedAt,
      syncStatus: deck.syncStatus,
      syncError: deck.syncError,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      cardCount: deck.cards.reduce((sum, c) => sum + c.quantity, 0),
      commanders,
      mainboard,
      sideboard,
    };
  }

  /**
   * Delete a synced deck
   */
  async deleteDeck(deckId: string, userId: string): Promise<void> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    await this.deckRepository.remove(deck);
  }

  /**
   * Update card quantity in a deck
   */
  async updateCardQuantity(
    deckId: string,
    cardName: string,
    delta: number,
    userId: string,
  ): Promise<{ success: boolean; newQuantity: number }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    // Find the card in the deck
    let deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    // If card doesn't exist in deck and we're adding (delta > 0), create it
    if (!deckCard && delta > 0) {
      // Search for the card by name in Scryfall/cache
      const card = await this.cardsService.searchByExactName(cardName);
      
      if (!card) {
        throw new NotFoundException(`Card "${cardName}" not found`);
      }

      // Create new deck card entry
      deckCard = this.deckCardRepository.create({
        deckId,
        scryfallId: card.scryfallId,
        quantity: delta,
        isCommander: false,
        categories: ['Mainboard'],
      });
      
      await this.deckCardRepository.save(deckCard);
      return { success: true, newQuantity: delta };
    }

    if (!deckCard) {
      // Trying to reduce quantity of a card that doesn't exist
      return { success: true, newQuantity: 0 };
    }

    // Calculate new quantity
    const newQuantity = Math.max(0, deckCard.quantity + delta);

    if (newQuantity === 0) {
      // Remove the card from the deck
      await this.deckCardRepository.remove(deckCard);
    } else {
      // Update the quantity
      deckCard.quantity = newQuantity;
      await this.deckCardRepository.save(deckCard);
    }

    return { success: true, newQuantity };
  }

  /**
   * Add a card to deck by scryfallId
   */
  async addCardToDeckByScryfallId(
    deckId: string,
    scryfallId: string,
    quantity: number,
    userId: string,
  ): Promise<{ success: boolean; cardName: string }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    // Fetch the card from Scryfall/cache
    const card = await this.cardsService.getOrFetch(scryfallId);

    if (!card) {
      throw new NotFoundException(`Card not found`);
    }

    // Check if card already exists in deck - prevent duplicates
    const existingCard = deck.cards.find((c) => c.card.name === card.name);

    if (existingCard) {
      throw new BadRequestException(`${card.name} is already in this deck`);
    }

    // Create new deck card entry
    const deckCard = this.deckCardRepository.create({
      deckId,
      scryfallId: card.scryfallId,
      quantity,
      isCommander: false,
      categories: ['Mainboard'],
    });

    await this.deckCardRepository.save(deckCard);

    // Create version
    await this.createVersion(
      deck.id,
      userId,
      'manual',
      `Added ${quantity}x ${card.name}`
    );

    return { success: true, cardName: card.name };
  }

  /**
   * Remove a card from a deck
   */
  async removeCardFromDeck(
    deckId: string,
    cardName: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    // Find the card by name
    const deckCard = deck.cards.find((c) => c.card.name === cardName);

    if (!deckCard) {
      throw new NotFoundException(`${cardName} not found in deck`);
    }

    // Remove the card
    await this.deckCardRepository.remove(deckCard);

    // Create version
    await this.createVersion(
      deck.id,
      userId,
      'manual',
      `Removed ${cardName}`
    );

    return { success: true };
  }

  /**
   * Update card color tag
   */
  async updateCardTag(
    deckId: string,
    cardName: string,
    tag: string | null,
    userId: string,
  ): Promise<{ success: boolean }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    deckCard.colorTag = tag;
    await this.deckCardRepository.save(deckCard);

    return { success: true };
  }

  /**
   * Set/unset card as commander
   */
  async setCardCommander(
    deckId: string,
    cardName: string,
    isCommander: boolean,
    userId: string,
  ): Promise<{ success: boolean }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    deckCard.isCommander = isCommander;
    if (isCommander) {
      // Remove from mainboard/sideboard categories, add to commander
      deckCard.categories = ['Commander'];
    } else {
      // Move back to mainboard
      deckCard.categories = ['Mainboard'];
    }
    await this.deckCardRepository.save(deckCard);

    return { success: true };
  }

  /**
   * Move card to mainboard or sideboard
   */
  async setCardCategory(
    deckId: string,
    cardName: string,
    category: 'mainboard' | 'sideboard',
    userId: string,
  ): Promise<{ success: boolean }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    deckCard.categories = [category === 'sideboard' ? 'Sideboard' : 'Mainboard'];
    deckCard.isCommander = false; // Can't be commander if moving to sideboard/mainboard
    await this.deckCardRepository.save(deckCard);

    return { success: true };
  }

  /**
   * Change card edition (swap to different printing)
   */
  async changeCardEdition(
    deckId: string,
    cardName: string,
    newScryfallId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    // Ensure the new card exists in our database
    await this.cardsService.getOrFetch(newScryfallId);

    // Update the scryfall ID
    deckCard.scryfallId = newScryfallId;
    await this.deckCardRepository.save(deckCard);

    return { success: true };
  }

  /**
   * Link a deck card to the user's collection
   * Automatically links if exact match (same scryfallId) exists
   * Otherwise prompts user to select from available printings
   * When linking different printing, changes the deck card's edition to match
   */
  async linkCardToCollection(
    deckId: string,
    cardName: string,
    userId: string,
    collectionCardId?: string, // Optional: specific collection card to link
    forceUnlink?: boolean, // Force unlink from another deck if already linked
  ): Promise<{
    success: boolean;
    linkedDeckCard?: { deckId: string; deckName: string };
    availablePrintings?: Array<{ id: string; scryfallId: string; setCode: string; setName: string; collectorNumber: string; quantity: number; foilQuantity: number; linkedTo?: { deckId: string; deckName: string } }>;
    needsSelection?: boolean;
    editionChanged?: boolean;
    alreadyLinked?: { deckId: string; deckName: string };
  }> {
    console.log(`[LinkToCollection] Starting: deckId=${deckId}, cardName=${cardName}, collectionCardId=${collectionCardId}`);

    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      console.error(`[LinkToCollection] Deck not found: ${deckId}`);
      throw new NotFoundException('Deck not found');
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      console.error(`[LinkToCollection] Card "${cardName}" not found in deck`);
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    console.log(`[LinkToCollection] Found deck card: ${deckCard.card?.name} (${deckCard.scryfallId})`);

    // If specific collection card ID provided, use that
    if (collectionCardId) {
      const collectionCard = await this.collectionRepository.findOne({
        where: { id: collectionCardId, userId },
        relations: ['card'],
      });

      if (!collectionCard) {
        throw new NotFoundException('Collection card not found');
      }

      // Verify it's the same card name
      if (collectionCard.card?.name?.toLowerCase() !== cardName.toLowerCase()) {
        throw new BadRequestException('Collection card name does not match deck card');
      }

      // Check if this collection card is already linked to a different deck
      if (collectionCard.linkedDeckCard &&
          collectionCard.linkedDeckCard.deckId !== deckId &&
          !forceUnlink) {
        console.log(`[LinkToCollection] Collection card already linked to deck ${collectionCard.linkedDeckCard.deckName}`);
        return {
          success: false,
          alreadyLinked: collectionCard.linkedDeckCard,
        };
      }

      let editionChanged = false;

      // If the collection card has a different scryfallId than the deck card,
      // change the deck card's edition to match the collection
      if (collectionCard.scryfallId !== deckCard.scryfallId) {
        console.log(
          `[LinkToCollection] Changing deck card edition from ${deckCard.scryfallId} to ${collectionCard.scryfallId}`
        );
        deckCard.scryfallId = collectionCard.scryfallId;
        await this.deckCardRepository.save(deckCard);
        editionChanged = true;

        // Create a version entry for the edition change
        await this.createVersion(
          deck.id,
          userId,
          'manual',
          `Changed ${cardName} edition to ${collectionCard.card?.setCode} #${collectionCard.card?.collectorNumber}`
        );
      }

      // Unlink any other collection card that was linked to this deck card
      const existingLinks = await this.collectionRepository.find({
        where: { userId },
      });

      for (const card of existingLinks) {
        if (card.linkedDeckCard?.deckId === deckId &&
            card.card?.name?.toLowerCase() === cardName.toLowerCase() &&
            card.id !== collectionCardId) {
          card.linkedDeckCard = null;
          await this.collectionRepository.save(card);
        }
      }

      // Link the selected collection card
      collectionCard.linkedDeckCard = { deckId: deck.id, deckName: deck.name };
      await this.collectionRepository.save(collectionCard);

      return {
        success: true,
        linkedDeckCard: { deckId: deck.id, deckName: deck.name },
        editionChanged
      };
    }

    // Auto-link: Try to find exact match first (same scryfallId)
    console.log(`[LinkToCollection] Looking for exact match with scryfallId: ${deckCard.scryfallId}`);
    let collectionCard = await this.collectionRepository.findOne({
      where: { userId, scryfallId: deckCard.scryfallId },
      relations: ['card'],
    });

    if (collectionCard) {
      console.log(`[LinkToCollection] Found exact match`);

      // Check if this collection card is already linked to a different deck
      if (collectionCard.linkedDeckCard &&
          collectionCard.linkedDeckCard.deckId !== deckId &&
          !forceUnlink) {
        console.log(`[LinkToCollection] Collection card already linked to deck ${collectionCard.linkedDeckCard.deckName}`);
        return {
          success: false,
          alreadyLinked: collectionCard.linkedDeckCard,
        };
      }

      // Link it automatically
      collectionCard.linkedDeckCard = { deckId: deck.id, deckName: deck.name };
      await this.collectionRepository.save(collectionCard);
      return { success: true, linkedDeckCard: { deckId: deck.id, deckName: deck.name } };
    }

    console.log(`[LinkToCollection] No exact match - searching for other printings`);
    // No exact match - find all collection cards with same name
    const allCollectionCards = await this.collectionRepository.find({
      where: { userId },
      relations: ['card'],
    });

    const matchingCards = allCollectionCards.filter(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase()
    );

    console.log(`[LinkToCollection] Found ${matchingCards.length} printings of "${cardName}" in collection`);

    if (matchingCards.length === 0) {
      console.error(`[LinkToCollection] Card not found in collection`);
      throw new NotFoundException('Card not found in your collection. Add it first.');
    }

    if (matchingCards.length === 1) {
      console.log(`[LinkToCollection] Only one printing available`);
      const card = matchingCards[0];

      // Check if this collection card is already linked to a different deck
      if (card.linkedDeckCard &&
          card.linkedDeckCard.deckId !== deckId &&
          !forceUnlink) {
        console.log(`[LinkToCollection] Collection card already linked to deck ${card.linkedDeckCard.deckName}`);
        return {
          success: false,
          alreadyLinked: card.linkedDeckCard,
        };
      }

      const editionChanged = card.scryfallId !== deckCard.scryfallId;

      // Change deck card edition if different
      if (editionChanged) {
        console.log(`[LinkToCollection] Changing edition from ${deckCard.scryfallId} to ${card.scryfallId}`);
        deckCard.scryfallId = card.scryfallId;
        await this.deckCardRepository.save(deckCard);
        await this.createVersion(
          deck.id,
          userId,
          'manual',
          `Changed ${cardName} edition to ${card.card?.setCode} #${card.card?.collectorNumber}`
        );
      }

      card.linkedDeckCard = { deckId: deck.id, deckName: deck.name };
      await this.collectionRepository.save(card);
      return {
        success: true,
        linkedDeckCard: { deckId: deck.id, deckName: deck.name },
        editionChanged
      };
    }

    console.log(`[LinkToCollection] Multiple printings - returning for user selection`);
    // Multiple printings available - return them for user selection
    return {
      success: false,
      needsSelection: true,
      availablePrintings: matchingCards.map((c) => ({
        id: c.id,
        scryfallId: c.scryfallId,
        setCode: c.card?.setCode || '',
        setName: c.card?.setName || '',
        collectorNumber: c.card?.collectorNumber || '',
        quantity: c.quantity,
        foilQuantity: c.foilQuantity,
        linkedTo: c.linkedDeckCard && c.linkedDeckCard.deckId !== deckId
          ? c.linkedDeckCard
          : undefined,
      })),
    };
  }

  /**
   * Unlink a deck card from the user's collection
   */
  async unlinkCardFromCollection(
    deckId: string,
    cardName: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards', 'cards.card'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    // Find the collection card that's linked to this deck card
    const collectionCard = await this.collectionRepository.findOne({
      where: { 
        userId, 
        scryfallId: deckCard.scryfallId,
      },
    });

    if (collectionCard && collectionCard.linkedDeckCard?.deckId === deckId) {
      collectionCard.linkedDeckCard = null;
      await this.collectionRepository.save(collectionCard);
    }

    return { success: true };
  }

  /**
   * Add a new color tag to a deck
   */
  async addColorTag(
    deckId: string,
    name: string,
    color: string,
    userId: string,
  ): Promise<{ success: boolean; colorTags: any[] }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    // Check if tag already exists
    if (deck.colorTags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      throw new BadRequestException(`Tag "${name}" already exists`);
    }

    deck.colorTags.push({ name, color });
    await this.deckRepository.save(deck);

    return { success: true, colorTags: deck.colorTags };
  }

  /**
   * Update an existing color tag
   */
  async updateColorTag(
    deckId: string,
    oldName: string,
    newName: string,
    newColor: string,
    userId: string,
  ): Promise<{ success: boolean; colorTags: any[] }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const tagIndex = deck.colorTags.findIndex(
      (t) => t.name.toLowerCase() === oldName.toLowerCase(),
    );

    if (tagIndex === -1) {
      throw new NotFoundException(`Tag "${oldName}" not found`);
    }

    // Update tag
    deck.colorTags[tagIndex] = { name: newName, color: newColor };

    // Update all cards using this tag if name changed
    if (oldName !== newName) {
      for (const card of deck.cards) {
        if (card.colorTag === oldName) {
          card.colorTag = newName;
          await this.deckCardRepository.save(card);
        }
      }
    }

    await this.deckRepository.save(deck);

    return { success: true, colorTags: deck.colorTags };
  }

  /**
   * Delete a color tag from a deck
   */
  async deleteColorTag(
    deckId: string,
    tagName: string,
    userId: string,
  ): Promise<{ success: boolean; colorTags: any[] }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ['cards'],
    });

    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const tagIndex = deck.colorTags.findIndex(
      (t) => t.name.toLowerCase() === tagName.toLowerCase(),
    );

    if (tagIndex === -1) {
      throw new NotFoundException(`Tag "${tagName}" not found`);
    }

    // Remove tag
    deck.colorTags.splice(tagIndex, 1);

    // Unassign from all cards using this tag
    for (const card of deck.cards) {
      if (card.colorTag === tagName) {
        card.colorTag = null;
        await this.deckCardRepository.save(card);
      }
    }

    await this.deckRepository.save(deck);

    return { success: true, colorTags: deck.colorTags };
  }

  /**
   * Sync all decks from Archidekt
   */
  async syncAllFromArchidekt(userId: string) {
    const archidektDecks = await this.listArchidektDecks(userId);
    const results: { synced: number; failed: number; decks: any[] } = {
      synced: 0,
      failed: 0,
      decks: [],
    };

    for (const archDeck of archidektDecks) {
      try {
        const synced = await this.syncFromArchidekt(archDeck.archidektId, userId);
        results.synced++;
        results.decks.push({
          id: synced.id,
          name: synced.name,
          status: 'synced',
        });
      } catch (error) {
        results.failed++;
        results.decks.push({
          archidektId: archDeck.archidektId,
          name: archDeck.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Sync a deck from Archidekt
   */
  async syncFromArchidekt(
    archidektId: number,
    userId: string,
  ): Promise<Deck> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.archidektId || !user?.archidektToken) {
      throw new BadRequestException(
        'Archidekt account not connected. Please connect your Archidekt account first.',
      );
    }

    // Fetch deck from Archidekt
    const archidektDeck = await this.fetchArchidektDeck(
      archidektId,
      user.archidektToken,
    );

    if (!archidektDeck) {
      throw new NotFoundException('Deck not found on Archidekt');
    }

    // Find or create deck
    let deck = await this.deckRepository.findOne({
      where: { archidektId, userId },
    });

    if (!deck) {
      deck = this.deckRepository.create({
        archidektId,
        userId,
        name: archidektDeck.name,
        format: archidektDeck.format?.name || null,
        description: archidektDeck.description || null,
        colorTags: archidektDeck.colorTags || [],
        lastSyncedAt: new Date(),
      });
    } else {
      deck.name = archidektDeck.name;
      deck.format = archidektDeck.format?.name || null;
      deck.description = archidektDeck.description || null;
      deck.colorTags = archidektDeck.colorTags || [];
      deck.lastSyncedAt = new Date();
    }

    await this.deckRepository.save(deck);

    // Delete existing cards
    await this.deckCardRepository.delete({ deckId: deck.id });

    // Extract set code and collector number from Archidekt cards
    const cardIdentifiers = archidektDeck.cards.map((c) => ({
      setCode: c.card.edition.editioncode,
      collectorNumber: c.card.collectorNumber,
    }));

    // Fetch cards from Scryfall using set + collector number
    const fetchedCards =
      await this.cardsService.getOrFetchManyBySetCollector(cardIdentifiers);

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

        deckCards.push(
          this.deckCardRepository.create({
            deckId: deck!.id,
            scryfallId,
            quantity: archCard.quantity,
            colorTag: archCard.colorTag?.color || null,
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

    if (deckCards.length > 0) {
      await this.deckCardRepository.save(deckCards);
    }

    // Log if some cards were skipped
    if (skippedCards.length > 0) {
      console.log(
        `[Sync] Skipped ${skippedCards.length} cards that couldn't be fetched from Scryfall:`,
        skippedCards,
      );
    }

    return this.getDeck(deck.id, userId);
  }

  /**
   * List user's decks from Archidekt (with pagination)
   */
  async listArchidektDecks(userId: string, isRetry = false): Promise<Array<{ archidektId: number; name: string; format: null; updatedAt: null }>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.archidektId || !user?.archidektToken) {
      throw new BadRequestException(
        'Archidekt account not connected. Please connect your Archidekt account first.',
      );
    }

    console.log('[Archidekt] Fetching decks for user:', user.archidektUsername, 'id:', user.archidektId);

    try {
      await this.archidektRateLimit();

      // Use /rest-auth/user/ endpoint which includes all user's decks
      const response = await axios.get(
        `${this.ARCHIDEKT_API}/rest-auth/user/`,
        {
          headers: {
            Authorization: `JWT ${user.archidektToken}`,
            Accept: 'application/json',
          },
        },
      );

      const userData = response.data;
      const decks = userData.decks || [];

      console.log('[Archidekt] Found', decks.length, 'decks in user data');

      return decks.map((deck: any) => ({
        archidektId: deck.id,
        name: deck.name,
        format: null, // Basic deck info doesn't include format
        updatedAt: null,
      }));
    } catch (error: any) {
      console.log('[Archidekt] Error fetching decks:', error.message);
      console.log('[Archidekt] Error response status:', error.response?.status);
      
      // Handle token expiration - try to auto-refresh
      if (error.response?.status === 401 && !isRetry) {
        console.log('[Archidekt] Token expired, attempting auto-refresh...');
        const newToken = await this.authService.autoRefreshArchidektToken(userId);
        
        if (newToken) {
          console.log('[Archidekt] Token refreshed, retrying...');
          return this.listArchidektDecks(userId, true);
        }
        
        throw new BadRequestException('Archidekt session expired. Please reconnect your account.');
      }
      
      throw new BadRequestException('Failed to fetch Archidekt decks: ' + (error.response?.data?.detail || error.message));
    }
  }

  private async fetchArchidektDeck(
    deckId: number,
    token: string,
  ): Promise<ArchidektDeck | null> {
    console.log('[Archidekt] Fetching deck:', deckId);
    try {
      await this.archidektRateLimit();
      
      const response = await axios.get(
        `${this.ARCHIDEKT_API}/decks/${deckId}/`,
        {
          headers: {
            Authorization: `JWT ${token}`,
            Accept: 'application/json',
          },
        },
      );
      console.log('[Archidekt] Deck fetched successfully:', response.data?.name);
      return response.data;
    } catch (error: any) {
      console.log('[Archidekt] Error fetching deck:', error.message);
      console.log('[Archidekt] Error status:', error.response?.status);
      return null;
    }
  }

  private extractColors(commanders: DeckCard[]): string[] {
    const colors = new Set<string>();
    for (const cmd of commanders) {
      if (cmd.card?.colorIdentity) {
        for (const color of cmd.card.colorIdentity) {
          colors.add(color);
        }
      }
    }
    return Array.from(colors);
  }

  // ==================== Version History ====================

  /**
   * Create a version snapshot of a deck
   */
  async createVersion(
    deckId: string,
    userId: string,
    changeType: 'sync' | 'manual' | 'advisor' | 'revert',
    description?: string,
  ): Promise<DeckVersion> {
    const deck = await this.getDeck(deckId, userId);

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
      description: description || `${changeType} - ${new Date().toLocaleDateString()}`,
      changeType,
      cards,
      colorTags: deck.colorTags,
      cardCount: cards.reduce((sum, c) => sum + c.quantity, 0),
    });

    return this.deckVersionRepository.save(version);
  }

  /**
   * Get all versions for a deck
   */
  async getVersions(deckId: string, userId: string): Promise<DeckVersion[]> {
    // Verify user owns the deck
    await this.getDeck(deckId, userId);

    return this.deckVersionRepository.find({
      where: { deckId },
      order: { versionNumber: 'DESC' },
    });
  }

  /**
   * Get a specific version
   */
  async getVersion(
    versionId: string,
    userId: string,
  ): Promise<DeckVersion> {
    const version = await this.deckVersionRepository.findOne({
      where: { id: versionId },
      relations: ['deck'],
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    // Verify user owns the deck
    if (version.deck.userId !== userId) {
      throw new NotFoundException('Version not found');
    }

    return version;
  }

  /**
   * Revert a deck to a previous version
   */
  async revertToVersion(
    versionId: string,
    userId: string,
  ): Promise<Deck> {
    const version = await this.getVersion(versionId, userId);
    const deck = await this.getDeck(version.deckId, userId);

    // Create a snapshot of current state before reverting
    await this.createVersion(deck.id, userId, 'revert', `Before revert to v${version.versionNumber}`);

    // Remove all current cards
    await this.deckCardRepository.delete({ deckId: deck.id });

    // Restore cards from version
    for (const vCard of version.cards) {
      // Find or fetch the card
      let card;
      try {
        card = await this.cardsService.getOrFetch(vCard.scryfallId);
      } catch {
        console.log(`[Version] Could not restore card: ${vCard.name}`);
        continue;
      }

      const deckCard = this.deckCardRepository.create({
        deckId: deck.id,
        scryfallId: vCard.scryfallId,
        quantity: vCard.quantity,
        colorTag: vCard.colorTag,
        isCommander: vCard.isCommander,
        categories: vCard.categories,
      });

      await this.deckCardRepository.save(deckCard);
    }

    // Restore color tags
    deck.colorTags = version.colorTags;
    await this.deckRepository.save(deck);

    // Create a new version for the reverted state
    await this.createVersion(deck.id, userId, 'revert', `Reverted to v${version.versionNumber}`);

    return this.getDeck(deck.id, userId);
  }
}
