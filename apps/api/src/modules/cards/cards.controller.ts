import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { CardsService } from './cards.service';

class BatchFetchDto {
  @IsArray()
  @IsString({ each: true})
  scryfallIds: string[];
}

class FuzzyMatchDto {
  @IsString()
  cardName: string;

  @IsOptional()
  @IsString()
  setCode?: string;

  @IsOptional()
  @IsString()
  collectorNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxDistance?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

@Controller('cards')
export class CardsController {
  constructor(private cardsService: CardsService) {}

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('page') page?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const result = await this.cardsService.searchByName(query, pageNum);

    // Format for mobile
    return {
      cards: result.cards.map((card) => ({
        scryfallId: card.scryfallId,
        name: card.name,
        setCode: card.setCode,
        setName: card.setName,
        collectorNumber: card.collectorNumber,
        manaCost: card.manaCost,
        typeLine: card.typeLine,
        rarity: card.rarity,
        colors: card.colors,
        colorIdentity: card.colorIdentity,
        imageUrl: card.imageNormal,
        imageSmall: card.imageSmall,
        imageArtCrop: card.imageArtCrop,
        priceUsd: card.priceUsd,
        priceUsdFoil: card.priceUsdFoil,
      })),
      hasMore: result.hasMore,
      totalCards: result.totalCards,
    };
  }

  @Get('search/local')
  async searchLocal(
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSize = limit ? parseInt(limit, 10) : 50;
    const result = await this.cardsService.searchLocal(query, pageNum, pageSize);

    // Format for mobile (same format as regular search for compatibility)
    return {
      cards: result.cards.map((card) => ({
        scryfallId: card.scryfallId,
        name: card.name,
        setCode: card.setCode,
        setName: card.setName,
        collectorNumber: card.collectorNumber,
        manaCost: card.manaCost,
        cmc: card.cmc,
        typeLine: card.typeLine,
        oracleText: card.oracleText,
        rarity: card.rarity,
        colors: card.colors,
        colorIdentity: card.colorIdentity,
        imageUrl: card.imageNormal,
        imageSmall: card.imageSmall,
        imageArtCrop: card.imageArtCrop,
        priceUsd: card.priceUsd,
        priceUsdFoil: card.priceUsdFoil,
        layout: card.layout,
      })),
      hasMore: result.hasMore,
      totalCards: result.totalCards,
      page: result.page,
    };
  }

  @Get('autocomplete')
  async autocomplete(@Query('q') query: string) {
    const suggestions = await this.cardsService.autocomplete(query);
    return { suggestions };
  }

  @Post('fuzzy-match')
  async fuzzyMatch(@Body() dto: FuzzyMatchDto) {
    const results = await this.cardsService.fuzzyMatchCard(dto.cardName, {
      setCode: dto.setCode,
      collectorNumber: dto.collectorNumber,
      maxDistance: dto.maxDistance,
      limit: dto.limit,
    });

    return {
      matches: results.map(({ card, distance, confidence }) => ({
        scryfallId: card.scryfallId,
        name: card.name,
        setCode: card.setCode,
        setName: card.setName,
        collectorNumber: card.collectorNumber,
        manaCost: card.manaCost,
        typeLine: card.typeLine,
        rarity: card.rarity,
        colors: card.colors,
        colorIdentity: card.colorIdentity,
        imageUrl: card.imageNormal,
        imageSmall: card.imageSmall,
        imageArtCrop: card.imageArtCrop,
        priceUsd: card.priceUsd,
        priceUsdFoil: card.priceUsdFoil,
        distance,
        confidence,
      })),
    };
  }

  @Post('batch')
  async batchFetch(@Body() dto: BatchFetchDto) {
    const cards = await this.cardsService.getOrFetchMany(dto.scryfallIds);

    // Format for mobile
    return cards.map((card) => ({
      scryfallId: card.scryfallId,
      name: card.name,
      setCode: card.setCode,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      manaCost: card.manaCost,
      typeLine: card.typeLine,
      rarity: card.rarity,
      colors: card.colors,
      colorIdentity: card.colorIdentity,
      imageUrl: card.imageNormal,
      imageSmall: card.imageSmall,
      imageArtCrop: card.imageArtCrop,
      priceUsd: card.priceUsd,
      priceUsdFoil: card.priceUsdFoil,
    }));
  }

  @Get('prints/:cardName')
  async getPrints(@Param('cardName') cardName: string) {
    const prints = await this.cardsService.getPrints(cardName);

    return prints.map((card) => ({
      scryfallId: card.scryfallId,
      name: card.name,
      setCode: card.setCode,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      manaCost: card.manaCost,
      typeLine: card.typeLine,
      rarity: card.rarity,
      colors: card.colors,
      colorIdentity: card.colorIdentity,
      imageUrl: card.imageNormal,
      imageSmall: card.imageSmall,
      imageArtCrop: card.imageArtCrop,
      priceUsd: card.priceUsd,
      priceUsdFoil: card.priceUsdFoil,
    }));
  }

  @Get(':scryfallId')
  async getCard(@Param('scryfallId') scryfallId: string) {
    const card = await this.cardsService.getOrFetch(scryfallId);

    return {
      scryfallId: card.scryfallId,
      name: card.name,
      setCode: card.setCode,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      manaCost: card.manaCost,
      cmc: card.cmc,
      typeLine: card.typeLine,
      oracleText: card.oracleText,
      power: card.power,
      toughness: card.toughness,
      loyalty: card.loyalty,
      rarity: card.rarity,
      colors: card.colors,
      colorIdentity: card.colorIdentity,
      imageUrl: card.imageNormal,
      imageSmall: card.imageSmall,
      imageArtCrop: card.imageArtCrop,
      priceUsd: card.priceUsd,
      priceUsdFoil: card.priceUsdFoil,
      layout: card.layout,
      cardFaces: card.cardFaces,
    };
  }
}
