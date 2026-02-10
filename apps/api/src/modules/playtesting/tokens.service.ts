import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Token } from '../../entities/token.entity';
import type {
  ExtendedGameCard,
  FullPlaytestGameState,
  PlayerId,
} from '@leyline/shared';
import { KeywordAbilitiesService } from './keyword-abilities.service';

@Injectable()
export class TokensService {
  private tokenCounter = 0;

  constructor(
    @InjectRepository(Token)
    private tokenRepository: Repository<Token>,
    private keywordService: KeywordAbilitiesService,
  ) {}

  /**
   * Create one or more token instances on the battlefield
   * @param state - The current game state
   * @param tokenId - The token definition ID (e.g., "food", "soldier-1-1-white")
   * @param controller - The player who controls the token
   * @param quantity - Number of tokens to create
   * @param modifiers - Optional modifications to token properties (for dynamic tokens)
   * @returns Array of instance IDs for the created tokens
   */
  async createTokens(
    state: FullPlaytestGameState,
    tokenId: string,
    controller: PlayerId,
    quantity: number = 1,
    modifiers?: Partial<ExtendedGameCard>,
  ): Promise<string[]> {
    // Fetch token definition from database
    const tokenDef = await this.tokenRepository.findOne({
      where: { tokenId },
    });

    if (!tokenDef) {
      throw new Error(`Token definition not found: ${tokenId}`);
    }

    return this.createTokensFromDefinition(
      state,
      tokenDef,
      controller,
      quantity,
      modifiers,
    );
  }

  /**
   * Create tokens from a token definition object
   * @param state - The current game state
   * @param tokenDef - The token definition
   * @param controller - The player who controls the token
   * @param quantity - Number of tokens to create
   * @param modifiers - Optional modifications to token properties
   * @returns Array of instance IDs for the created tokens
   */
  createTokensFromDefinition(
    state: FullPlaytestGameState,
    tokenDef: Token,
    controller: PlayerId,
    quantity: number = 1,
    modifiers?: Partial<ExtendedGameCard>,
  ): string[] {
    const tokenInstanceIds: string[] = [];

    for (let i = 0; i < quantity; i++) {
      const instanceId = `${state.sessionId}-token-${this.tokenCounter++}`;

      // Parse keywords from oracle text
      const keywords = this.keywordService.parseKeywords(
        tokenDef.oracleText,
        tokenDef.typeLine,
      );

      const tokenCard: ExtendedGameCard = {
        instanceId,
        scryfallId: tokenDef.scryfallId || null,
        tokenId: tokenDef.tokenId,
        isToken: true,
        name: tokenDef.name,
        owner: controller,
        controller: controller,
        zone: 'battlefield', // Tokens always enter the battlefield
        isTapped: false,
        isFaceDown: false,
        isFlipped: false,
        counters: {},
        attachedTo: null,
        attachments: [],
        summoningSickness: tokenDef.typeLine.includes('Creature'), // Creature tokens have summoning sickness
        damage: 0,
        imageUrl: tokenDef.imageNormal || null,
        manaCost: null, // Tokens have no mana cost
        cmc: 0,
        typeLine: tokenDef.typeLine,
        oracleText: tokenDef.oracleText,
        power: tokenDef.power,
        toughness: tokenDef.toughness,
        colors: tokenDef.colors,
        colorIdentity: tokenDef.colorIdentity,
        isCommander: false,
        commanderTax: 0,
        keywords: keywords.concat(tokenDef.keywords), // Combine parsed and explicit keywords
        ...modifiers, // Apply any modifications
      };

      // Add token to game state
      state.cards[instanceId] = tokenCard;
      state.battlefieldOrder[controller].push(instanceId);
      tokenInstanceIds.push(instanceId);
    }

    return tokenInstanceIds;
  }

  /**
   * Create a custom token without a predefined definition
   * Useful for tokens with variable properties determined by spell/ability
   * @param state - The current game state
   * @param controller - The player who controls the token
   * @param properties - Token properties
   * @param quantity - Number of tokens to create
   * @returns Array of instance IDs for the created tokens
   */
  createCustomTokens(
    state: FullPlaytestGameState,
    controller: PlayerId,
    properties: {
      name: string;
      typeLine: string;
      oracleText?: string;
      power?: string;
      toughness?: string;
      colors?: string[];
      keywords?: string[];
      imageUrl?: string;
    },
    quantity: number = 1,
  ): string[] {
    const tokenInstanceIds: string[] = [];

    for (let i = 0; i < quantity; i++) {
      const instanceId = `${state.sessionId}-token-${this.tokenCounter++}`;

      // Parse keywords from oracle text
      const parsedKeywords = this.keywordService.parseKeywords(
        properties.oracleText || null,
        properties.typeLine,
      );

      const tokenCard: ExtendedGameCard = {
        instanceId,
        scryfallId: null,
        isToken: true,
        name: properties.name,
        owner: controller,
        controller: controller,
        zone: 'battlefield',
        isTapped: false,
        isFaceDown: false,
        isFlipped: false,
        counters: {},
        attachedTo: null,
        attachments: [],
        summoningSickness: properties.typeLine.includes('Creature'),
        damage: 0,
        imageUrl: properties.imageUrl || null,
        manaCost: null,
        cmc: 0,
        typeLine: properties.typeLine,
        oracleText: properties.oracleText || null,
        power: properties.power || null,
        toughness: properties.toughness || null,
        colors: properties.colors || [],
        colorIdentity: properties.colors || [],
        isCommander: false,
        commanderTax: 0,
        keywords: [
          ...parsedKeywords,
          ...(properties.keywords || []),
        ],
      };

      state.cards[instanceId] = tokenCard;
      state.battlefieldOrder[controller].push(instanceId);
      tokenInstanceIds.push(instanceId);
    }

    return tokenInstanceIds;
  }

  /**
   * Get all available token definitions
   */
  async getAllTokens(): Promise<Token[]> {
    return this.tokenRepository.find();
  }

  /**
   * Find token definitions by name
   */
  async findTokensByName(name: string): Promise<Token[]> {
    return this.tokenRepository.find({
      where: { name },
    });
  }

  /**
   * Find a specific token definition by ID
   */
  async findTokenById(tokenId: string): Promise<Token | null> {
    return this.tokenRepository.findOne({
      where: { tokenId },
    });
  }

  /**
   * Reset the token counter (useful for testing)
   */
  resetCounter(): void {
    this.tokenCounter = 0;
  }
}
