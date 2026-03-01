import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios from 'axios';
import { distance } from 'fastest-levenshtein';
import { Card } from '../../entities/card.entity';
import { SearchParserService } from './search-parser.service';
import { SearchBuilderService } from './search-builder.service';
import { SearchResult } from './dto/search-criteria.dto';

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  collector_number: string;
  set_name: string;
  mana_cost?: string;
  cmc?: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity: string;
  image_uris?: {
    normal?: string;
    small?: string;
    art_crop?: string;
    png?: string;
  };
  prices?: {
    usd?: string;
    usd_foil?: string;
  };
  layout?: string;
  card_faces?: any[];
}

interface ScryfallSearchResponse {
  object: string;
  total_cards: number;
  has_more: boolean;
  data: ScryfallCard[];
}

@Injectable()
export class CardsService {
  private readonly SCRYFALL_API = 'https://api.scryfall.com';
  private readonly CACHE_TTL_HOURS = 24;

  constructor(
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
    private searchParser: SearchParserService,
    private searchBuilder: SearchBuilderService,
  ) {}

  /**
   * Get a card by Scryfall ID, fetching from Scryfall if not cached or stale
   */
  async getOrFetch(scryfallId: string): Promise<Card> {
    // Check cache first
    const cached = await this.cardRepository.findOne({
      where: { scryfallId },
    });

    if (cached && !this.isStale(cached.fetchedAt)) {
      return cached;
    }

    // Fetch from Scryfall
    const scryfallCard = await this.fetchFromScryfall(scryfallId);
    if (!scryfallCard) {
      throw new NotFoundException(`Card not found: ${scryfallId}`);
    }

    // Upsert to database
    return this.upsertCard(scryfallCard);
  }

  /**
   * Get multiple cards by Scryfall IDs, fetching missing ones from Scryfall
   */
  async getOrFetchMany(scryfallIds: string[]): Promise<Card[]> {
    if (scryfallIds.length === 0) return [];

    // Get cached cards
    const cached = await this.cardRepository.find({
      where: { scryfallId: In(scryfallIds) },
    });

    const cachedMap = new Map(cached.map((c) => [c.scryfallId, c]));
    const validCached: Card[] = [];
    const toFetch: string[] = [];

    for (const id of scryfallIds) {
      const card = cachedMap.get(id);
      if (card && !this.isStale(card.fetchedAt)) {
        validCached.push(card);
      } else {
        toFetch.push(id);
      }
    }

    if (toFetch.length === 0) {
      return validCached;
    }

    // Fetch missing cards from Scryfall using collection endpoint
    const fetched = await this.fetchCollectionFromScryfall(toFetch);
    const upserted = await Promise.all(
      fetched.map((card) => this.upsertCard(card)),
    );

    return [...validCached, ...upserted];
  }

  /**
   * Search cards by name
   */
  async searchByName(
    query: string,
    page = 1,
  ): Promise<{ cards: Card[]; hasMore: boolean; totalCards: number }> {
    const response = await this.searchScryfall(query, page);

    // Cache search results
    const cards = await Promise.all(
      response.data.map((card) => this.upsertCard(card)),
    );

    return {
      cards,
      hasMore: response.has_more,
      totalCards: response.total_cards,
    };
  }

  /**
   * Search cards locally using Scryfall-style syntax
   * Example queries: "c:r t:dragon mv>=4", "lightning bolt", "o:draw r:rare"
   */
  async searchLocal(
    query: string,
    page = 1,
    pageSize = 50,
  ): Promise<SearchResult> {
    // Parse the query into structured criteria
    const criteria = this.searchParser.parse(query);

    // Build the TypeORM query
    let queryBuilder = this.cardRepository.createQueryBuilder('card');
    queryBuilder = this.searchBuilder.buildQuery(queryBuilder, criteria);

    // Add sorting (alphabetical by name)
    queryBuilder.orderBy('card.name', 'ASC');

    // Get total count before pagination
    const totalCards = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    // Execute query
    const cards = await queryBuilder.getMany();

    return {
      cards,
      hasMore: totalCards > page * pageSize,
      totalCards,
      page,
    };
  }

  /**
   * Search for a card by exact name (for adding to decks)
   */
  async searchByExactName(cardName: string): Promise<Card | null> {
    // Check cache first
    const cached = await this.cardRepository.findOne({
      where: { name: cardName },
    });

    if (cached && !this.isStale(cached.fetchedAt)) {
      return cached;
    }

    // Fetch from Scryfall using exact name search
    try {
      await this.rateLimitDelay();

      const response = await axios.get(`${this.SCRYFALL_API}/cards/named`, {
        params: { exact: cardName },
      });

      return this.upsertCard(response.data);
    } catch (error: any) {
      console.log(`[Scryfall] Card not found: ${cardName}`);
      return null;
    }
  }

  /**
   * Get distinct sets from the database
   */
  async getSets(): Promise<Array<{ setCode: string; setName: string }>> {
    const results = await this.cardRepository
      .createQueryBuilder('card')
      .select('card.setCode', 'setCode')
      .addSelect('MAX(card.setName)', 'setName')
      .groupBy('card.setCode')
      .orderBy('MAX(card.setName)', 'ASC')
      .getRawMany();

    return results.map((r) => ({
      setCode: r.setCode,
      setName: r.setName,
    }));
  }

  /**
   * Get distinct type words from all card type lines
   */
  async getTypes(): Promise<string[]> {
    const results = await this.cardRepository
      .createQueryBuilder('card')
      .select('DISTINCT card.type_line', 'typeLine')
      .where('card.type_line IS NOT NULL')
      .getRawMany();

    const typeSet = new Set<string>();
    const lettersOnly = /^[a-zA-Z]+$/;

    for (const row of results) {
      const line: string = row.typeLine || '';
      for (const word of line.split(/\s+/)) {
        if (word && lettersOnly.test(word)) {
          typeSet.add(word);
        }
      }
    }

    return Array.from(typeSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }

  /**
   * Autocomplete card names
   */
  async autocomplete(query: string): Promise<string[]> {
    try {
      const response = await axios.get(
        `${this.SCRYFALL_API}/cards/autocomplete`,
        {
          params: { q: query },
        },
      );
      return response.data.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Get a single card by set code and collector number
   */
  async getBySetAndNumber(setCode: string, collectorNumber: string): Promise<Card | null> {
    // Check cache first
    const cached = await this.cardRepository.findOne({
      where: {
        setCode: setCode.toLowerCase(),
        collectorNumber: collectorNumber,
      },
    });

    if (cached && !this.isStale(cached.fetchedAt)) {
      return cached;
    }

    // Fetch from Scryfall
    try {
      await this.rateLimitDelay();
      
      const response = await axios.get(
        `${this.SCRYFALL_API}/cards/${setCode.toLowerCase()}/${collectorNumber}`,
      );
      
      return this.upsertCard(response.data);
    } catch (error: any) {
      console.log(`[Scryfall] Card not found: ${setCode}/${collectorNumber}`);
      return null;
    }
  }

  /**
   * Get all printings of a card by name
   */
  async getPrints(cardName: string): Promise<Card[]> {
    try {
      await this.rateLimitDelay();

      // Use Scryfall search with unique:prints to get all printings
      // The !"name" operator means exact name match
      const response = await axios.get(`${this.SCRYFALL_API}/cards/search`, {
        params: {
          q: `!"${cardName}" game:paper`,
          unique: 'prints',
          order: 'released',
          dir: 'desc',
        },
      });

      const prints: Card[] = [];

      // Fetch all pages if there are more
      let data = response.data;
      while (data.data && data.data.length > 0) {
        const cards = await Promise.all(
          data.data.map((card: ScryfallCard) => this.upsertCard(card)),
        );
        prints.push(...cards);

        if (!data.has_more) break;

        // Fetch next page
        await this.rateLimitDelay();
        const nextResponse = await axios.get(data.next_page);
        data = nextResponse.data;
      }

      return prints;
    } catch (error: any) {
      console.error(`[Scryfall] Failed to get prints for: "${cardName}"`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Fuzzy match a card name with optional set/collector number
   * Returns top matches ranked by Levenshtein distance
   */
  async fuzzyMatchCard(
    cardName: string,
    options?: {
      setCode?: string;
      collectorNumber?: string;
      maxDistance?: number;
      limit?: number;
    },
  ): Promise<Array<{
    card: Card;
    distance: number;
    confidence: number;
  }>> {
    const maxDist = options?.maxDistance || 5;
    const limit = options?.limit || 5;

    try {
      // First: try to resolve exact printing from local DB (no API calls)
      if (options?.collectorNumber) {
        const exactPrinting = await this.findExactPrinting(
          cardName,
          options.setCode,
          options.collectorNumber,
        );
        if (exactPrinting) {
          const dist = distance(cardName.toLowerCase(), exactPrinting.name.toLowerCase());
          if (dist <= maxDist) {
            const maxLength = Math.max(cardName.length, exactPrinting.name.length);
            return [{
              card: exactPrinting,
              distance: dist,
              confidence: Math.min(1, 1 - dist / maxLength + 0.3),
            }];
          }
        }
      }

      // Search Scryfall for fuzzy name matching
      let query = cardName;
      if (options?.setCode) {
        query = `${cardName} set:${options.setCode}`;
      }

      await this.rateLimitDelay();
      const scryfallResults = await this.searchScryfall(query, 1);

      if (scryfallResults.data && scryfallResults.data.length > 0) {
        const cards = await Promise.all(
          scryfallResults.data.map((card) => this.upsertCard(card)),
        );

        const rankedResults = cards
          .map((card) => {
            const dist = distance(
              cardName.toLowerCase(),
              card.name.toLowerCase(),
            );
            const maxLength = Math.max(cardName.length, card.name.length);
            let confidence = Math.max(0, 1 - dist / maxLength);

            if (options?.setCode && card.setCode === options.setCode.toLowerCase()) {
              confidence = Math.min(1, confidence + 0.2);
            }
            if (options?.collectorNumber && card.collectorNumber === options.collectorNumber) {
              confidence = Math.min(1, confidence + 0.1);
            }

            return { card, distance: dist, confidence };
          })
          .filter((result) => result.distance <= maxDist)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, limit);

        if (rankedResults.length > 0) {
          // Now that we have the correct card name from Scryfall, try exact printing from DB
          const topMatch = rankedResults[0];
          if (options?.collectorNumber && topMatch.distance <= 2) {
            const exactPrinting = await this.findExactPrinting(
              topMatch.card.name,
              options.setCode,
              options.collectorNumber,
            );
            if (exactPrinting) {
              return [{
                card: exactPrinting,
                distance: topMatch.distance,
                confidence: Math.min(1, topMatch.confidence + 0.3),
              }];
            }
          }

          return rankedResults;
        }
      }

      // Fallback: Get all unique card names from database and compute distances
      // Database fallback
      const allCards = await this.cardRepository
        .createQueryBuilder('card')
        .select(['card.scryfallId', 'card.name'])
        .distinct(true)
        .addSelect('MIN(card.fetchedAt)', 'fetchedAt')
        .groupBy('card.name')
        .addGroupBy('card.scryfallId')
        .limit(10000) // Limit to avoid memory issues
        .getRawMany();

      const fuzzyResults = allCards
        .map((c: any) => ({
          name: c.card_name,
          scryfallId: c.card_scryfallId,
          distance: distance(cardName.toLowerCase(), c.card_name.toLowerCase()),
        }))
        .filter((c) => c.distance <= maxDist)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      // Fetch full card objects
      const results = await Promise.all(
        fuzzyResults.map(async (result) => {
          const card = await this.getOrFetch(result.scryfallId);
          const maxLength = Math.max(cardName.length, card.name.length);
          const confidence = Math.max(0, 1 - result.distance / maxLength);

          return {
            card,
            distance: result.distance,
            confidence,
          };
        }),
      );

      return results;
    } catch (error: any) {
      console.error('[FuzzyMatch] Error:', error.message);
      return [];
    }
  }

  /**
   * Try to find the exact printing by set code + collector number.
   * If set code is provided, does a direct Scryfall lookup.
   * Otherwise, fetches all printings and matches by collector number.
   */
  private async findExactPrinting(
    cardName: string,
    setCode?: string,
    collectorNumber?: string,
  ): Promise<Card | null> {
    if (!collectorNumber) return null;

    try {
      // If we have both set code and collector number, do a direct Scryfall lookup
      if (setCode) {
        const exact = await this.getBySetAndNumber(setCode, collectorNumber);
        if (exact) return exact;
      }

      // Check local DB first — avoids extra Scryfall API calls
      const dbQuery: any = {
        name: cardName,
        collectorNumber: collectorNumber,
      };
      if (setCode) {
        dbQuery.setCode = setCode.toLowerCase();
      }
      const dbMatches = await this.cardRepository.find({ where: dbQuery });

      if (setCode && dbMatches.length >= 1) {
        return dbMatches[0];
      }
      if (dbMatches.length === 1) {
        return dbMatches[0];
      }
      if (dbMatches.length > 1) {
        // Multiple printings share this collector number — return most recent
        return dbMatches.sort((a, b) =>
          new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
        )[0];
      }

      // DB miss — fetch all printings from Scryfall and match
      const prints = await this.getPrints(cardName);
      if (prints.length === 0) return null;

      if (setCode) {
        const setAndNumMatch = prints.find(
          p => p.setCode === setCode.toLowerCase() && p.collectorNumber === collectorNumber,
        );
        if (setAndNumMatch) return setAndNumMatch;
      }

      const numMatches = prints.filter(p => p.collectorNumber === collectorNumber);
      if (numMatches.length >= 1) {
        return numMatches[0];
      }

      return null;
    } catch (error: any) {
      console.error('[FuzzyMatch] findExactPrinting error:', error.message);
      return null;
    }
  }

  private async fetchFromScryfall(
    scryfallId: string,
  ): Promise<ScryfallCard | null> {
    try {
      // Rate limit: 50ms between requests
      await this.rateLimitDelay();

      const response = await axios.get(
        `${this.SCRYFALL_API}/cards/${scryfallId}`,
      );
      return response.data;
    } catch {
      return null;
    }
  }

  private async fetchCollectionFromScryfall(
    scryfallIds: string[],
  ): Promise<ScryfallCard[]> {
    try {
      await this.rateLimitDelay();

      const identifiers = scryfallIds.map((id) => ({ id }));
      const response = await axios.post(
        `${this.SCRYFALL_API}/cards/collection`,
        { identifiers },
      );
      return response.data.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch cards by set code and collector number
   */
  async getOrFetchManyBySetCollector(
    cards: Array<{ setCode: string; collectorNumber: string }>,
  ): Promise<Card[]> {
    if (cards.length === 0) return [];

    // Batch-lookup all cards in a single query instead of one SELECT per card
    const existingCards = await this.batchLookupBySetCollector(cards);
    const existingMap = new Map(
      existingCards.map((c) => [`${c.setCode}|${c.collectorNumber}`, c]),
    );

    const cached: Card[] = [];
    const toFetch: Array<{ setCode: string; collectorNumber: string }> = [];

    for (const card of cards) {
      const key = `${card.setCode.toLowerCase()}|${card.collectorNumber}`;
      const existing = existingMap.get(key);
      if (existing && !this.isStale(existing.fetchedAt)) {
        cached.push(existing);
      } else {
        toFetch.push(card);
      }
    }

    if (toFetch.length === 0) {
      return cached;
    }

    // Fetch from Scryfall using collection endpoint with set/collector_number
    const fetched = await this.fetchCollectionBySetCollector(toFetch);
    const upserted = await Promise.all(
      fetched.map((card) => this.upsertCard(card)),
    );

    return [...cached, ...upserted];
  }

  /**
   * Lookup cards by set code and collector number - LOCAL DATABASE ONLY
   * Does NOT fetch from Scryfall. Returns only cards that already exist in the database.
   */
  async lookupExistingBySetCollector(
    cards: Array<{ setCode: string; collectorNumber: string }>,
  ): Promise<Card[]> {
    if (cards.length === 0) return [];

    return this.batchLookupBySetCollector(cards);
  }

  /**
   * Batch-lookup cards by (setCode, collectorNumber) in a single query.
   * Processes in chunks of 500 to avoid exceeding SQL parameter limits.
   */
  private async batchLookupBySetCollector(
    cards: Array<{ setCode: string; collectorNumber: string }>,
  ): Promise<Card[]> {
    if (cards.length === 0) return [];

    const CHUNK_SIZE = 500;
    const allResults: Card[] = [];

    for (let i = 0; i < cards.length; i += CHUNK_SIZE) {
      const chunk = cards.slice(i, i + CHUNK_SIZE);
      const conditions: string[] = [];

      chunk.forEach((card, idx) => {
        const setParam = `set_${i + idx}`;
        const numParam = `num_${i + idx}`;
        conditions.push(`(card.set_code = :${setParam} AND card.collector_number = :${numParam})`);
      });

      const qb = this.cardRepository.createQueryBuilder('card');
      qb.where(conditions.join(' OR '));

      chunk.forEach((card, idx) => {
        qb.setParameter(`set_${i + idx}`, card.setCode.toLowerCase());
        qb.setParameter(`num_${i + idx}`, card.collectorNumber);
      });

      const results = await qb.getMany();
      allResults.push(...results);
    }

    return allResults;
  }

  private async fetchCollectionBySetCollector(
    cards: Array<{ setCode: string; collectorNumber: string }>,
  ): Promise<ScryfallCard[]> {
    const BATCH_SIZE = 75; // Scryfall limit
    const allResults: ScryfallCard[] = [];

    // Split into batches of 75
    for (let i = 0; i < cards.length; i += BATCH_SIZE) {
      const batch = cards.slice(i, i + BATCH_SIZE);

      try {
        await this.rateLimitDelay();

        const identifiers = batch.map((c) => ({
          set: c.setCode.toLowerCase(),
          collector_number: c.collectorNumber,
        }));

        console.log(
          `[Scryfall] Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
          identifiers.slice(0, 3),
          `... (${identifiers.length} cards)`,
        );

        const response = await axios.post(
          `${this.SCRYFALL_API}/cards/collection`,
          { identifiers },
        );

        const notFound = response.data.not_found || [];
        if (notFound.length > 0) {
          console.log('[Scryfall] Cards not found:', notFound.slice(0, 5));
        }

        allResults.push(...(response.data.data || []));
      } catch (error: any) {
        console.error('[Scryfall] Error fetching batch:', error.message);
        // Continue with next batch instead of failing completely
      }
    }

    return allResults;
  }

  private async searchScryfall(
    query: string,
    page: number,
  ): Promise<ScryfallSearchResponse> {
    try {
      await this.rateLimitDelay();

      const response = await axios.get(`${this.SCRYFALL_API}/cards/search`, {
        params: { q: query, page },
      });
      return response.data;
    } catch {
      return { object: 'list', total_cards: 0, has_more: false, data: [] };
    }
  }

  private async upsertCard(scryfallCard: ScryfallCard): Promise<Card> {
    const cardData: Partial<Card> = {
      scryfallId: scryfallCard.id,
      name: scryfallCard.name,
      setCode: scryfallCard.set,
      collectorNumber: scryfallCard.collector_number,
      setName: scryfallCard.set_name,
      manaCost: scryfallCard.mana_cost || null,
      cmc: scryfallCard.cmc || null,
      typeLine: scryfallCard.type_line,
      oracleText: scryfallCard.oracle_text || null,
      colors: scryfallCard.colors || [],
      colorIdentity: scryfallCard.color_identity || [],
      power: scryfallCard.power || null,
      toughness: scryfallCard.toughness || null,
      loyalty: scryfallCard.loyalty || null,
      rarity: scryfallCard.rarity,
      imageNormal: scryfallCard.image_uris?.normal || null,
      imageSmall: scryfallCard.image_uris?.small || null,
      imageArtCrop: scryfallCard.image_uris?.art_crop || null,
      imagePng: scryfallCard.image_uris?.png || null,
      priceUsd: scryfallCard.prices?.usd
        ? parseFloat(scryfallCard.prices.usd)
        : null,
      priceUsdFoil: scryfallCard.prices?.usd_foil
        ? parseFloat(scryfallCard.prices.usd_foil)
        : null,
      layout: scryfallCard.layout || null,
      cardFaces: scryfallCard.card_faces || null,
      pricesUpdatedAt: new Date(),
    };

    // Handle double-faced cards that don't have image_uris at top level
    if (!cardData.imageNormal && scryfallCard.card_faces?.[0]?.image_uris) {
      const frontFace = scryfallCard.card_faces[0];
      cardData.imageNormal = frontFace.image_uris.normal || null;
      cardData.imageSmall = frontFace.image_uris.small || null;
      cardData.imageArtCrop = frontFace.image_uris.art_crop || null;
      cardData.imagePng = frontFace.image_uris.png || null;
    }

    await this.cardRepository.upsert(cardData, ['scryfallId']);

    return this.cardRepository.findOneOrFail({
      where: { scryfallId: scryfallCard.id },
    });
  }

  private isStale(fetchedAt: Date): boolean {
    const ageHours =
      (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
    return ageHours > this.CACHE_TTL_HOURS;
  }

  private lastRequestTime = 0;
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < 100) {
      await new Promise((resolve) => setTimeout(resolve, 100 - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
