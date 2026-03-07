import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import axios from "axios";
import { Deck } from "../../entities/deck.entity";
import { DeckCard } from "../../entities/deck-card.entity";
import {
  DeckVersion,
  type VersionCard,
} from "../../entities/deck-version.entity";
import { CollectionCard } from "../../entities/collection-card.entity";
import { ColorTag } from "../../entities/color-tag.entity";
import { DeckScore } from "../../entities/deck-score.entity";
import { PodMember } from "../../entities/pod-member.entity";
import { CardsService } from "../cards/cards.service";
import { AuthService } from "../auth/auth.service";

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
  private readonly ARCHIDEKT_API = "https://archidekt.com/api";
  private lastArchidektRequest = 0;
  private readonly ARCHIDEKT_RATE_LIMIT_MS = 500; // 500ms between requests

  constructor(
    @InjectRepository(Deck)
    private deckRepository: Repository<Deck>,
    @InjectRepository(DeckCard)
    private deckCardRepository: Repository<DeckCard>,
    @InjectRepository(DeckVersion)
    private deckVersionRepository: Repository<DeckVersion>,
    @InjectRepository(CollectionCard)
    private collectionRepository: Repository<CollectionCard>,
    @InjectRepository(ColorTag)
    private colorTagRepository: Repository<ColorTag>,
    @InjectRepository(DeckScore)
    private deckScoreRepository: Repository<DeckScore>,
    @InjectRepository(PodMember)
    private podMemberRepository: Repository<PodMember>,
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
   * Check if two users share any pods
   */
  private async usersSharePod(userId1: string, userId2: string): Promise<boolean> {
    if (userId1 === userId2) return true;

    // Get all pods for user1
    const user1Pods = await this.podMemberRepository.find({
      where: { userId: userId1 },
      select: ['podId'],
    });

    if (user1Pods.length === 0) return false;

    const podIds = user1Pods.map(m => m.podId);

    // Check if user2 is in any of those pods
    const count = await this.podMemberRepository
      .createQueryBuilder('pm')
      .where('pm.userId = :userId2', { userId2 })
      .andWhere('pm.podId IN (:...podIds)', { podIds })
      .getCount();

    return count > 0;
  }

  /**
   * Create a new deck without Archidekt sync
   */
  async createDeck(name: string, userId: string): Promise<Deck> {
    const deck = this.deckRepository.create({
      archidektId: null,
      userId,
      name,
      format: null,
      description: null,
      lastSyncedAt: null,
      syncStatus: "synced", // No sync needed for manual decks
    });

    await this.deckRepository.save(deck);

    // Create initial version
    await this.createVersion(deck.id, userId, "manual", "Deck created");

    return deck;
  }

  /**
   * Get all decks for a user
   */
  async getUserDecks(userId: string) {
    const decks = await this.deckRepository.find({
      where: { userId },
      order: { updatedAt: "DESC" },
    });

    // Batch-fetch all deck scores in one query
    const deckIds = decks.map((d) => d.id);
    const allScores = deckIds.length > 0
      ? await this.deckScoreRepository
          .createQueryBuilder("ds")
          .where("ds.deck_id IN (:...deckIds)", { deckIds })
          .getMany()
      : [];
    const scoresByDeckId = new Map(allScores.map((s) => [s.deckId, s]));

    // Batch-fetch all deck cards and commanders in two queries instead of 2*N
    const allDeckCards = deckIds.length > 0
      ? await this.deckCardRepository.find({
          where: { deckId: In(deckIds) },
        })
      : [];
    const allCommanders = deckIds.length > 0
      ? await this.deckCardRepository.find({
          where: { deckId: In(deckIds), isCommander: true },
          relations: ["card"],
        })
      : [];

    // Group by deckId for O(1) lookups
    const cardsByDeckId = new Map<string, DeckCard[]>();
    for (const card of allDeckCards) {
      const list = cardsByDeckId.get(card.deckId);
      if (list) list.push(card);
      else cardsByDeckId.set(card.deckId, [card]);
    }
    const commandersByDeckId = new Map<string, DeckCard[]>();
    for (const cmd of allCommanders) {
      const list = commandersByDeckId.get(cmd.deckId);
      if (list) list.push(cmd);
      else commandersByDeckId.set(cmd.deckId, [cmd]);
    }

    return decks.map((deck) => {
      const deckCards = cardsByDeckId.get(deck.id) || [];
      const cardCount = deckCards.reduce((sum, c) => sum + c.quantity, 0);
      const commanders = commandersByDeckId.get(deck.id) || [];
      const primaryCommander = commanders[0]?.card;
      const score = scoresByDeckId.get(deck.id);

      return {
        id: deck.id,
        archidektId: deck.archidektId,
        name: deck.name,
        format: deck.format,
        visibility: deck.visibility,
        lastSyncedAt: deck.lastSyncedAt,
        syncStatus: deck.syncStatus,
        syncError: deck.syncError,
        cardCount,
        commanders: commanders.map((c) => c.card?.name).filter(Boolean),
        commanderImageCrop: primaryCommander?.imageArtCrop || null,
        commanderImageFull: primaryCommander?.imageNormal || null,
        colors: this.extractColors(commanders),
        scores: score
          ? { power: score.power, salt: score.salt, fear: score.fear, airtime: score.airtime }
          : null,
      };
    });
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
        syncStatus: "waiting",
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
      relations: ["cards", "cards.card", "cards.colorTagEntity", "colorTags"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    return deck;
  }

  /**
   * Get a deck with formatted card data for mobile
   */
  async getDeckWithCards(deckId: string, userId: string) {
    const deck = await this.getDeck(deckId, userId);

    // Collect the scryfallIds and card names from the deck to filter the collection query
    const deckScryfallIds = deck.cards
      .map((c) => c.scryfallId)
      .filter(Boolean);
    const deckCardNames = deck.cards
      .map((c) => c.card?.name)
      .filter((n): n is string => !!n);

    // Only fetch collection cards that match the deck's cards (by scryfallId or name)
    // instead of loading the entire collection
    let collectionCards: CollectionCard[] = [];
    if (deckScryfallIds.length > 0 || deckCardNames.length > 0) {
      const qb = this.collectionRepository
        .createQueryBuilder("cc")
        .leftJoinAndSelect("cc.card", "card")
        .where("cc.userId = :userId", { userId });

      const conditions: string[] = [];
      if (deckScryfallIds.length > 0) {
        conditions.push("cc.scryfallId IN (:...scryfallIds)");
      }
      if (deckCardNames.length > 0) {
        conditions.push("card.name IN (:...cardNames)");
      }
      qb.andWhere(`(${conditions.join(" OR ")})`, {
        ...(deckScryfallIds.length > 0 && { scryfallIds: deckScryfallIds }),
        ...(deckCardNames.length > 0 && { cardNames: deckCardNames }),
      });

      collectionCards = await qb.getMany();
    }

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
      const cardName = deckCard.card?.name || "Unknown";

      // Check if exact printing is in collection
      const exactCollectionCard = collectionByScryfall.get(deckCard.scryfallId);
      const inCollectionExact = !!exactCollectionCard;

      // Check if same card name but different printing is in collection
      const cardsWithSameName = collectionByName.get(cardName) || [];
      const differentPrintCards = cardsWithSameName.filter(
        (cc) => cc.scryfallId !== deckCard.scryfallId,
      );
      const inCollectionDifferentPrint = differentPrintCards.length > 0;

      // Check if this card is linked to this deck in collection
      const linkedCollectionCard = cardsWithSameName.find(
        (cc) => cc.linkedDeckCards?.some((l: any) => l.deckId === deck.id),
      );
      const isLinkedToCollection = !!linkedCollectionCard;

      // Check if there are any available collection cards to link
      // With multi-deck linking, any card in collection is available
      const hasAvailableCollectionCard = !!exactCollectionCard || differentPrintCards.length > 0;

      const cardData = {
        id: deckCard.id,
        scryfallId: deckCard.scryfallId,
        name: cardName,
        quantity: deckCard.quantity,
        setCode: deckCard.card?.setCode,
        collectorNumber: deckCard.card?.collectorNumber,
        colorTag: deckCard.colorTagEntity?.color ?? undefined,
        colorTagId: deckCard.colorTagId ?? undefined,
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
        deckCard.categories.some((c) => c.toLowerCase() === "sideboard")
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
      visibility: deck.visibility,
      colorTags: (deck.colorTags || []).map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      })),
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
      isReadOnly: false,
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
      throw new NotFoundException("Deck not found");
    }

    // Remove this deck from linkedDeckCards arrays on all collection cards
    const linkedCards = await this.collectionRepository
      .createQueryBuilder("cc")
      .where("cc.userId = :userId", { userId })
      .andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(cc.linked_deck_card, '[]'::jsonb)) AS elem WHERE elem->>'deckId' = :deckId)`,
        { deckId },
      )
      .getMany();

    if (linkedCards.length > 0) {
      for (const card of linkedCards) {
        card.linkedDeckCards = (card.linkedDeckCards || []).filter(
          (l) => l.deckId !== deckId,
        );
        if (card.linkedDeckCards.length === 0) {
          card.linkedDeckCards = null;
        }
      }
      await this.collectionRepository.save(linkedCards);
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
      relations: ["cards", "cards.card"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
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
        categories: ["Mainboard"],
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
      // Remove this deck from the collection card's linked decks
      const collectionCard = await this.collectionRepository.findOne({
        where: { userId, scryfallId: deckCard.scryfallId },
      });
      if (collectionCard && collectionCard.linkedDeckCards?.some((l) => l.deckId === deckId)) {
        collectionCard.linkedDeckCards = collectionCard.linkedDeckCards.filter(
          (l) => l.deckId !== deckId,
        );
        if (collectionCard.linkedDeckCards.length === 0) {
          collectionCard.linkedDeckCards = null;
        }
        await this.collectionRepository.save(collectionCard);
      }

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
      relations: ["cards", "cards.card"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
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
      categories: ["Mainboard"],
    });

    await this.deckCardRepository.save(deckCard);

    // Create version
    await this.createVersion(
      deck.id,
      userId,
      "manual",
      `Added ${quantity}x ${card.name}`,
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
      relations: ["cards", "cards.card"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    // Find the card by name
    const deckCard = deck.cards.find((c) => c.card.name === cardName);

    if (!deckCard) {
      throw new NotFoundException(`${cardName} not found in deck`);
    }

    // Remove this deck from the collection card's linked decks
    const collectionCard = await this.collectionRepository.findOne({
      where: { userId, scryfallId: deckCard.scryfallId },
    });
    if (collectionCard && collectionCard.linkedDeckCards?.some((l) => l.deckId === deckId)) {
      collectionCard.linkedDeckCards = collectionCard.linkedDeckCards.filter(
        (l) => l.deckId !== deckId,
      );
      if (collectionCard.linkedDeckCards.length === 0) {
        collectionCard.linkedDeckCards = null;
      }
      await this.collectionRepository.save(collectionCard);
    }

    // Remove the card
    await this.deckCardRepository.remove(deckCard);

    // Create version
    await this.createVersion(deck.id, userId, "manual", `Removed ${cardName}`);

    return { success: true };
  }

  /**
   * Update card color tag
   */
  async updateCardTag(
    deckId: string,
    cardName: string,
    tagId: string | null,
    userId: string,
  ): Promise<{ success: boolean }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ["cards", "cards.card"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    deckCard.colorTagId = tagId;
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
      relations: ["cards", "cards.card"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
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
      deckCard.categories = ["Commander"];
    } else {
      // Move back to mainboard
      deckCard.categories = ["Mainboard"];
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
    category: "mainboard" | "sideboard",
    userId: string,
  ): Promise<{ success: boolean }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ["cards", "cards.card"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    deckCard.categories = [
      category === "sideboard" ? "Sideboard" : "Mainboard",
    ];
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
      relations: ["cards", "cards.card"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    // Ensure the new card exists in our database and get it
    const newCard = await this.cardsService.getOrFetch(newScryfallId);

    // Update both the scryfall ID and the card relation
    deckCard.scryfallId = newScryfallId;
    deckCard.card = newCard;
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
    _forceUnlink?: boolean, // Kept for API compat but no longer needed with multi-link
  ): Promise<{
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
  }> {
    console.log(
      `[LinkToCollection] Starting: deckId=${deckId}, cardName=${cardName}, collectionCardId=${collectionCardId}`,
    );

    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
      relations: ["cards", "cards.card"],
    });

    if (!deck) {
      console.error(`[LinkToCollection] Deck not found: ${deckId}`);
      throw new NotFoundException("Deck not found");
    }

    const deckCard = deck.cards.find(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    if (!deckCard) {
      console.error(`[LinkToCollection] Card "${cardName}" not found in deck`);
      throw new NotFoundException(`Card "${cardName}" not found in deck`);
    }

    console.log(
      `[LinkToCollection] Found deck card: ${deckCard.card?.name} (${deckCard.scryfallId})`,
    );

    // Helper to add a deck link to a collection card's array
    const addDeckLink = (card: CollectionCard): boolean => {
      const links = card.linkedDeckCards || [];
      if (links.some((l) => l.deckId === deckId)) return false; // already linked
      links.push({ deckId: deck.id, deckName: deck.name });
      card.linkedDeckCards = links;
      return true;
    };

    // If specific collection card ID provided, use that
    if (collectionCardId) {
      const collectionCard = await this.collectionRepository.findOne({
        where: { id: collectionCardId, userId },
        relations: ["card"],
      });

      if (!collectionCard) {
        throw new NotFoundException("Collection card not found");
      }

      // Verify it's the same card name
      if (collectionCard.card?.name?.toLowerCase() !== cardName.toLowerCase()) {
        throw new BadRequestException(
          "Collection card name does not match deck card",
        );
      }

      let editionChanged = false;

      // If the collection card has a different scryfallId than the deck card,
      // change the deck card's edition to match the collection
      if (collectionCard.scryfallId !== deckCard.scryfallId) {
        console.log(
          `[LinkToCollection] Changing deck card edition from ${deckCard.scryfallId} to ${collectionCard.scryfallId}`,
        );
        deckCard.scryfallId = collectionCard.scryfallId;
        await this.deckCardRepository.save(deckCard);
        editionChanged = true;

        await this.createVersion(
          deck.id,
          userId,
          "manual",
          `Changed ${cardName} edition to ${collectionCard.card?.setCode} #${collectionCard.card?.collectorNumber}`,
        );
      }

      // Remove this deck's link from any OTHER collection card with the same name
      const existingLinks = await this.collectionRepository.find({
        where: { userId },
      });

      for (const card of existingLinks) {
        if (
          card.linkedDeckCards?.some((l) => l.deckId === deckId) &&
          card.card?.name?.toLowerCase() === cardName.toLowerCase() &&
          card.id !== collectionCardId
        ) {
          card.linkedDeckCards = card.linkedDeckCards.filter(
            (l) => l.deckId !== deckId,
          );
          if (card.linkedDeckCards.length === 0) card.linkedDeckCards = null;
          await this.collectionRepository.save(card);
        }
      }

      // Add the deck link to the selected collection card
      addDeckLink(collectionCard);
      await this.collectionRepository.save(collectionCard);

      return {
        success: true,
        linkedDeckCards: collectionCard.linkedDeckCards || [],
        editionChanged,
      };
    }

    // Auto-link: Try to find exact match first (same scryfallId)
    console.log(
      `[LinkToCollection] Looking for exact match with scryfallId: ${deckCard.scryfallId}`,
    );
    let collectionCard = await this.collectionRepository.findOne({
      where: { userId, scryfallId: deckCard.scryfallId },
      relations: ["card"],
    });

    if (collectionCard) {
      console.log(`[LinkToCollection] Found exact match`);

      addDeckLink(collectionCard);
      await this.collectionRepository.save(collectionCard);
      return {
        success: true,
        linkedDeckCards: collectionCard.linkedDeckCards || [],
      };
    }

    console.log(
      `[LinkToCollection] No exact match - searching for other printings`,
    );
    // No exact match - find all collection cards with same name
    const allCollectionCards = await this.collectionRepository.find({
      where: { userId },
      relations: ["card"],
    });

    const matchingCards = allCollectionCards.filter(
      (c) => c.card?.name?.toLowerCase() === cardName.toLowerCase(),
    );

    console.log(
      `[LinkToCollection] Found ${matchingCards.length} printings of "${cardName}" in collection`,
    );

    if (matchingCards.length === 0) {
      console.error(`[LinkToCollection] Card not found in collection`);
      throw new NotFoundException(
        "Card not found in your collection. Add it first.",
      );
    }

    if (matchingCards.length === 1) {
      console.log(`[LinkToCollection] Only one printing available`);
      const card = matchingCards[0];

      const editionChanged = card.scryfallId !== deckCard.scryfallId;

      // Change deck card edition if different
      if (editionChanged) {
        console.log(
          `[LinkToCollection] Changing edition from ${deckCard.scryfallId} to ${card.scryfallId}`,
        );
        deckCard.scryfallId = card.scryfallId;
        await this.deckCardRepository.save(deckCard);
        await this.createVersion(
          deck.id,
          userId,
          "manual",
          `Changed ${cardName} edition to ${card.card?.setCode} #${card.card?.collectorNumber}`,
        );
      }

      addDeckLink(card);
      await this.collectionRepository.save(card);
      return {
        success: true,
        linkedDeckCards: card.linkedDeckCards || [],
        editionChanged,
      };
    }

    console.log(
      `[LinkToCollection] Multiple printings - returning for user selection`,
    );
    // Multiple printings available - return them for user selection
    return {
      success: false,
      needsSelection: true,
      availablePrintings: matchingCards.map((c) => ({
        id: c.id,
        scryfallId: c.scryfallId,
        setCode: c.card?.setCode || "",
        setName: c.card?.setName || "",
        collectorNumber: c.card?.collectorNumber || "",
        quantity: c.quantity,
        foilQuantity: c.foilQuantity,
        linkedTo:
          c.linkedDeckCards && c.linkedDeckCards.length > 0
            ? c.linkedDeckCards.filter((l) => l.deckId !== deckId)
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
      relations: ["cards", "cards.card"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
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

    if (collectionCard && collectionCard.linkedDeckCards?.some((l) => l.deckId === deckId)) {
      collectionCard.linkedDeckCards = collectionCard.linkedDeckCards.filter(
        (l) => l.deckId !== deckId,
      );
      if (collectionCard.linkedDeckCards.length === 0) {
        collectionCard.linkedDeckCards = null;
      }
      await this.collectionRepository.save(collectionCard);
    }

    return { success: true };
  }

  /**
   * Helper to return serialized color tags for a deck
   */
  private async getSerializedColorTags(deckId: string) {
    const tags = await this.colorTagRepository.find({ where: { deckId } });
    return tags.map((t) => ({ id: t.id, name: t.name, color: t.color }));
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
      throw new NotFoundException("Deck not found");
    }

    // Check if tag already exists
    const existing = await this.colorTagRepository.findOne({
      where: { deckId, name },
    });
    if (existing) {
      throw new BadRequestException(`Tag "${name}" already exists`);
    }

    const tag = this.colorTagRepository.create({ deckId, name, color });
    await this.colorTagRepository.save(tag);

    return {
      success: true,
      colorTags: await this.getSerializedColorTags(deckId),
    };
  }

  /**
   * Update an existing color tag
   */
  async updateColorTag(
    deckId: string,
    tagId: string,
    newName: string,
    newColor: string,
    userId: string,
  ): Promise<{ success: boolean; colorTags: any[] }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    const tag = await this.colorTagRepository.findOne({
      where: { id: tagId, deckId },
    });

    if (!tag) {
      throw new NotFoundException("Tag not found");
    }

    tag.name = newName;
    tag.color = newColor;
    await this.colorTagRepository.save(tag);

    return {
      success: true,
      colorTags: await this.getSerializedColorTags(deckId),
    };
  }

  /**
   * Delete a color tag from a deck
   */
  async deleteColorTag(
    deckId: string,
    tagId: string,
    userId: string,
  ): Promise<{ success: boolean; colorTags: any[] }> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    const tag = await this.colorTagRepository.findOne({
      where: { id: tagId, deckId },
    });

    if (!tag) {
      throw new NotFoundException("Tag not found");
    }

    // ON DELETE SET NULL handles nullifying deck_cards.color_tag_id
    await this.colorTagRepository.remove(tag);

    return {
      success: true,
      colorTags: await this.getSerializedColorTags(deckId),
    };
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
        const synced = await this.syncFromArchidekt(
          archDeck.archidektId,
          userId,
        );
        results.synced++;
        results.decks.push({
          id: synced.id,
          name: synced.name,
          status: "synced",
        });
      } catch (error) {
        results.failed++;
        results.decks.push({
          archidektId: archDeck.archidektId,
          name: archDeck.name,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Sync a deck from Archidekt
   */
  async syncFromArchidekt(archidektId: number, userId: string): Promise<Deck> {
    const archidektUserIdVal = await this.authService.getArchidektId(userId);
    const archidektToken = await this.authService.getArchidektToken(userId);

    if (!archidektUserIdVal || !archidektToken) {
      throw new BadRequestException(
        "Archidekt account not connected. Please connect your Archidekt account first.",
      );
    }

    // Fetch deck from Archidekt
    const archidektDeck = await this.fetchArchidektDeck(
      archidektId,
      archidektToken,
    );

    if (!archidektDeck) {
      throw new NotFoundException("Deck not found on Archidekt");
    }

    // Extract color tags from card labels
    // Archidekt stores color tags in the 'label' field as ',#hexcolor'
    const colorTagSet = new Set<string>();
    for (const card of archidektDeck.cards || []) {
      const label = (card as any).label;
      if (label && typeof label === "string") {
        const match = label.match(/#[0-9A-Fa-f]{6}/);
        if (match) {
          colorTagSet.add(match[0].toUpperCase());
        }
      }
    }

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
        lastSyncedAt: new Date(),
      });
    } else {
      deck.name = archidektDeck.name;
      deck.format = archidektDeck.format?.name || null;
      deck.description = archidektDeck.description || null;
      deck.lastSyncedAt = new Date();
    }

    await this.deckRepository.save(deck);

    // Delete existing cards and color tags
    await this.deckCardRepository.delete({ deckId: deck.id });
    await this.colorTagRepository.delete({ deckId: deck.id });

    // Create color tag entities and build lookup map
    const colorToTagId = new Map<string, string>();
    for (const color of colorTagSet) {
      const tag = this.colorTagRepository.create({
        deckId: deck.id,
        name: color,
        color: color,
      });
      const saved = await this.colorTagRepository.save(tag);
      colorToTagId.set(color, saved.id);
    }

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
    const skippedCards: Array<{
      name: string;
      set: string;
      collector: string;
    }> = [];

    for (const archCard of archidektDeck.cards) {
      const key = `${archCard.card.edition.editioncode.toLowerCase()}:${archCard.card.collectorNumber}`;
      const scryfallId = cardMap.get(key);

      if (scryfallId) {
        const isCommander = archCard.categories.some(
          (cat) => cat.toLowerCase() === "commander",
        );

        // Extract color tag from label field (format: ',#656565')
        let cardColorTagId: string | null = null;
        const label = (archCard as any).label;
        if (label && typeof label === "string") {
          const match = label.match(/#[0-9A-Fa-f]{6}/);
          if (match) {
            cardColorTagId =
              colorToTagId.get(match[0].toUpperCase()) ?? null;
          }
        }

        deckCards.push(
          this.deckCardRepository.create({
            deckId: deck!.id,
            scryfallId,
            quantity: archCard.quantity,
            colorTagId: cardColorTagId,
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
  async listArchidektDecks(
    userId: string,
    isRetry = false,
  ): Promise<
    Array<{ archidektId: number; name: string; format: null; updatedAt: null }>
  > {
    const archidektUserIdVal = await this.authService.getArchidektId(userId);
    const archidektToken = await this.authService.getArchidektToken(userId);

    if (!archidektUserIdVal || !archidektToken) {
      throw new BadRequestException(
        "Archidekt account not connected. Please connect your Archidekt account first.",
      );
    }

    console.log(
      "[Archidekt] Fetching decks for archidektId:",
      archidektUserIdVal,
    );

    try {
      const allDecks: any[] = [];
      let page = 1;
      let hasMore = true;

      // Fetch all pages
      while (hasMore) {
        await this.archidektRateLimit();

        console.log(`[Archidekt] Fetching page ${page}...`);

        // Use the curated/self endpoint with pagination
        const response = await axios.get(
          `${this.ARCHIDEKT_API}/decks/curated/self/`,
          {
            params: {
              page,
              pageSize: 36, // Archidekt's default page size
            },
            headers: {
              Authorization: `JWT ${archidektToken}`,
              Accept: "application/json",
            },
          },
        );

        const results = response.data.results || [];
        console.log(`[Archidekt] Page ${page}: Found ${results.length} decks`);

        allDecks.push(...results);

        // Check if there's a next page
        hasMore = !!response.data.next;
        page++;
      }

      console.log("[Archidekt] Total decks found:", allDecks.length);

      return allDecks.map((deck: any) => ({
        archidektId: deck.id,
        name: deck.name,
        format: null, // Basic deck info doesn't include format
        updatedAt: null,
      }));
    } catch (error: any) {
      console.log("[Archidekt] Error fetching decks:", error.message);
      console.log("[Archidekt] Error response status:", error.response?.status);

      // Handle token expiration - try to auto-refresh
      if (error.response?.status === 401 && !isRetry) {
        console.log("[Archidekt] Token expired, attempting auto-refresh...");
        const newToken =
          await this.authService.autoRefreshArchidektToken(userId);

        if (newToken) {
          console.log("[Archidekt] Token refreshed, retrying...");
          return this.listArchidektDecks(userId, true);
        }

        throw new BadRequestException(
          "Archidekt session expired. Please reconnect your account.",
        );
      }

      throw new BadRequestException(
        "Failed to fetch Archidekt decks: " +
          (error.response?.data?.detail || error.message),
      );
    }
  }

  private async fetchArchidektDeck(
    deckId: number,
    token: string,
  ): Promise<ArchidektDeck | null> {
    console.log("[Archidekt] Fetching deck:", deckId);
    try {
      await this.archidektRateLimit();

      const response = await axios.get(
        `${this.ARCHIDEKT_API}/decks/${deckId}/`,
        {
          headers: {
            Authorization: `JWT ${token}`,
            Accept: "application/json",
          },
        },
      );
      console.log(
        "[Archidekt] Deck fetched successfully:",
        response.data?.name,
      );
      return response.data;
    } catch (error: any) {
      console.log("[Archidekt] Error fetching deck:", error.message);
      console.log("[Archidekt] Error status:", error.response?.status);
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

  // ==================== Visibility & Explore ====================

  /**
   * Update deck visibility (private/public/pod)
   */
  async updateVisibility(
    deckId: string,
    userId: string,
    visibility: "private" | "public" | "pod",
  ): Promise<void> {
    const deck = await this.deckRepository.findOne({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    deck.visibility = visibility;
    await this.deckRepository.save(deck);
  }

  /**
   * Browse public decks with filters
   */
  async explorePublicDecks(options: {
    page?: number;
    pageSize?: number;
    name?: string;
    commander?: string;
    cardName?: string;
    colors?: string[];
    format?: string;
  }) {
    const page = options.page || 1;
    const pageSize = Math.min(options.pageSize || 20, 50);
    const skip = (page - 1) * pageSize;

    const qb = this.deckRepository
      .createQueryBuilder("deck")
      .leftJoin("deck.user", "user")
      .leftJoin("deck.deckScore", "deckScore")
      .where("deck.visibility = :visibility", { visibility: "public" })
      .addSelect(["user.displayName", "user.email"])
      .addSelect(["deckScore.power", "deckScore.salt", "deckScore.fear", "deckScore.airtime"]);

    // Deck name search
    if (options.name) {
      qb.andWhere("LOWER(deck.name) LIKE LOWER(:deckName)", {
        deckName: `%${options.name}%`,
      });
    }

    // Format filter
    if (options.format) {
      qb.andWhere("LOWER(deck.format) = LOWER(:format)", {
        format: options.format,
      });
    }

    // Commander name filter
    if (options.commander) {
      qb.andWhere(
        `deck.id IN (
          SELECT dc.deck_id FROM deck_cards dc
          JOIN cards c ON dc.scryfall_id = c.scryfall_id
          WHERE dc.is_commander = true
          AND LOWER(c.name) LIKE LOWER(:commanderName)
        )`,
        { commanderName: `%${options.commander}%` },
      );
    }

    // Contains card name filter
    if (options.cardName) {
      qb.andWhere(
        `deck.id IN (
          SELECT dc.deck_id FROM deck_cards dc
          JOIN cards c ON dc.scryfall_id = c.scryfall_id
          WHERE LOWER(c.name) LIKE LOWER(:containsCardName)
        )`,
        { containsCardName: `%${options.cardName}%` },
      );
    }

    // Color identity filter: exclude decks with commander colors outside selection
    if (options.colors && options.colors.length > 0) {
      qb.andWhere(
        `deck.id NOT IN (
          SELECT DISTINCT dc.deck_id FROM deck_cards dc
          JOIN cards c ON dc.scryfall_id = c.scryfall_id,
          LATERAL unnest(c.color_identity) AS ci(color)
          WHERE dc.is_commander = true
          AND ci.color NOT IN (${options.colors.map((_, i) => `:color${i}`).join(",")})
        )`,
        options.colors.reduce(
          (params, color, i) => ({ ...params, [`color${i}`]: color }),
          {} as Record<string, string>,
        ),
      );
    }

    qb.orderBy("deck.updatedAt", "DESC").skip(skip).take(pageSize);

    const [decks, total] = await qb.getManyAndCount();

    if (decks.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const deckIds = decks.map((d) => d.id);

    // Bulk-fetch commanders
    const commanders = await this.deckCardRepository
      .createQueryBuilder("dc")
      .leftJoinAndSelect("dc.card", "card")
      .where("dc.deckId IN (:...deckIds)", { deckIds })
      .andWhere("dc.isCommander = true")
      .getMany();

    // Bulk-fetch card counts
    const cardCounts = await this.deckCardRepository
      .createQueryBuilder("dc")
      .select("dc.deckId", "deckId")
      .addSelect("SUM(dc.quantity)", "count")
      .where("dc.deckId IN (:...deckIds)", { deckIds })
      .groupBy("dc.deckId")
      .getRawMany();

    const commandersByDeck = new Map<string, DeckCard[]>();
    for (const cmd of commanders) {
      if (!commandersByDeck.has(cmd.deckId)) {
        commandersByDeck.set(cmd.deckId, []);
      }
      commandersByDeck.get(cmd.deckId)!.push(cmd);
    }

    const countByDeck = new Map<string, number>();
    for (const row of cardCounts) {
      countByDeck.set(row.deckId, parseInt(row.count, 10));
    }

    const data = decks.map((deck) => {
      const deckCommanders = commandersByDeck.get(deck.id) || [];
      const primaryCommander = deckCommanders[0]?.card;
      return {
        id: deck.id,
        name: deck.name,
        format: deck.format,
        cardCount: countByDeck.get(deck.id) || 0,
        commanders: deckCommanders.map((c) => c.card?.name).filter(Boolean),
        colors: this.extractColors(deckCommanders),
        commanderImageCrop: primaryCommander?.imageArtCrop || null,
        ownerName:
          deck.user?.displayName || deck.user?.email?.split("@")[0] || "Unknown",
        ownerId: deck.userId,
        scores: deck.deckScore
          ? {
              power: deck.deckScore.power,
              salt: deck.deckScore.salt,
              fear: deck.deckScore.fear,
              airtime: deck.deckScore.airtime,
            }
          : null,
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get a deck with cards — supports owner access, public viewer access, and pod member access
   */
  async getPublicDeckWithCards(deckId: string, requestingUserId: string) {
    // First try as owner
    const ownedDeck = await this.deckRepository.findOne({
      where: { id: deckId, userId: requestingUserId },
    });

    if (ownedDeck) {
      const result = await this.getDeckWithCards(deckId, requestingUserId);
      return { ...result, visibility: ownedDeck.visibility, isReadOnly: false };
    }

    // Not the owner — check visibility permissions
    const deck = await this.deckRepository.findOne({
      where: { id: deckId },
      relations: ["cards", "cards.card", "cards.colorTagEntity", "colorTags", "user"],
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    // Check if user has permission to view this deck
    const canView =
      deck.visibility === "public" ||
      (deck.visibility === "pod" && await this.usersSharePod(deck.userId, requestingUserId));

    if (!canView) {
      throw new NotFoundException("Deck not found");
    }

    const commanders: any[] = [];
    const mainboard: any[] = [];
    const sideboard: any[] = [];

    for (const deckCard of deck.cards) {
      const cardData = {
        id: deckCard.id,
        scryfallId: deckCard.scryfallId,
        name: deckCard.card?.name || "Unknown",
        quantity: deckCard.quantity,
        setCode: deckCard.card?.setCode,
        collectorNumber: deckCard.card?.collectorNumber,
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
      };

      if (deckCard.isCommander) {
        commanders.push(cardData);
      } else if (
        deckCard.categories.some((c) => c.toLowerCase() === "sideboard")
      ) {
        sideboard.push(cardData);
      } else {
        mainboard.push(cardData);
      }
    }

    const colorIdentity = this.extractColors(
      deck.cards.filter((c) => c.isCommander),
    );

    return {
      id: deck.id,
      archidektId: deck.archidektId,
      name: deck.name,
      format: deck.format,
      description: deck.description,
      visibility: deck.visibility,
      colorTags: (deck.colorTags || []).map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      })),
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
      isReadOnly: true,
      ownerName:
        deck.user?.displayName || deck.user?.email?.split("@")[0] || "Unknown",
      ownerId: deck.userId,
    };
  }

  // ==================== Version History ====================

  /**
   * Create a version snapshot of a deck
   */
  async createVersion(
    deckId: string,
    userId: string,
    changeType: "sync" | "manual" | "advisor" | "revert",
    description?: string,
  ): Promise<DeckVersion> {
    const deck = await this.getDeck(deckId, userId);

    // Get current version number
    const latestVersion = await this.deckVersionRepository.findOne({
      where: { deckId },
      order: { versionNumber: "DESC" },
    });
    const versionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Create card snapshot
    const cards: VersionCard[] = deck.cards.map((c) => ({
      name: c.card?.name || "Unknown",
      scryfallId: c.scryfallId,
      quantity: c.quantity,
      colorTag: c.colorTagEntity
        ? {
            id: c.colorTagEntity.id,
            name: c.colorTagEntity.name,
            color: c.colorTagEntity.color,
          }
        : null,
      isCommander: c.isCommander,
      categories: c.categories,
    }));

    const version = this.deckVersionRepository.create({
      deckId,
      versionNumber,
      description:
        description || `${changeType} - ${new Date().toLocaleDateString()}`,
      changeType,
      cards,
      colorTags: (deck.colorTags || []).map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      })),
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
      order: { versionNumber: "DESC" },
    });
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: string, userId: string): Promise<DeckVersion> {
    const version = await this.deckVersionRepository.findOne({
      where: { id: versionId },
      relations: ["deck"],
    });

    if (!version) {
      throw new NotFoundException("Version not found");
    }

    // Verify user owns the deck
    if (version.deck.userId !== userId) {
      throw new NotFoundException("Version not found");
    }

    return version;
  }

  /**
   * Revert a deck to a previous version
   */
  async revertToVersion(versionId: string, userId: string): Promise<Deck> {
    const version = await this.getVersion(versionId, userId);
    const deck = await this.getDeck(version.deckId, userId);

    // Create a snapshot of current state before reverting
    await this.createVersion(
      deck.id,
      userId,
      "revert",
      `Before revert to v${version.versionNumber}`,
    );

    // Remove all current cards and color tags
    await this.deckCardRepository.delete({ deckId: deck.id });
    await this.colorTagRepository.delete({ deckId: deck.id });

    // Restore color tags from version snapshot
    const tagIdMap = new Map<string, string>(); // old ID or color -> new tag ID
    for (const vTag of version.colorTags) {
      const newTag = this.colorTagRepository.create({
        deckId: deck.id,
        name: vTag.name,
        color: vTag.color,
      });
      const saved = await this.colorTagRepository.save(newTag);
      if (vTag.id) tagIdMap.set(vTag.id, saved.id);
      tagIdMap.set(vTag.color, saved.id); // fallback by color
    }

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

      // Resolve the color tag ID from the version snapshot
      let colorTagId: string | null = null;
      if (vCard.colorTag) {
        if (typeof vCard.colorTag === "object" && vCard.colorTag.id) {
          // New format: { id, name, color }
          colorTagId =
            tagIdMap.get(vCard.colorTag.id) ??
            tagIdMap.get(vCard.colorTag.color) ??
            null;
        } else if (typeof vCard.colorTag === "string") {
          // Old format: hex color string
          colorTagId = tagIdMap.get(vCard.colorTag) ?? null;
        }
      }

      const deckCard = this.deckCardRepository.create({
        deckId: deck.id,
        scryfallId: vCard.scryfallId,
        quantity: vCard.quantity,
        colorTagId,
        isCommander: vCard.isCommander,
        categories: vCard.categories,
      });

      await this.deckCardRepository.save(deckCard);
    }

    // Create a new version for the reverted state
    await this.createVersion(
      deck.id,
      userId,
      "revert",
      `Reverted to v${version.versionNumber}`,
    );

    return this.getDeck(deck.id, userId);
  }
}
