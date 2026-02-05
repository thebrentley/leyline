import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaytestingController } from './playtesting.controller';
import { PlaytestingService } from './playtesting.service';
import { GameEngineService } from './game-engine.service';
import { KeywordAbilitiesService } from './keyword-abilities.service';
import { AIOpponentService } from './ai-opponent.service';
import { GameLoopService } from './game-loop.service';
import { TokensService } from './tokens.service';
import { SearchService } from './search.service';
import { SpellEffectsService } from './spell-effects/spell-effects.service';
import { ManyPartingsEffect } from './spell-effects/many-partings.effect';
import { LLMSpellResolutionService } from './llm-spell-resolution.service';
import { ActionExecutorService } from './action-executor.service';
import { SpellResolutionCacheService } from './spell-resolution-cache.service';
import { LandSelectionService } from './land-selection.service';
import { Deck } from '../../entities/deck.entity';
import { Token } from '../../entities/token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Deck, Token])],
  controllers: [PlaytestingController],
  providers: [
    PlaytestingService,
    GameEngineService,
    KeywordAbilitiesService,
    AIOpponentService,
    GameLoopService,
    TokensService,
    SearchService,
    SpellEffectsService,
    LLMSpellResolutionService,
    ActionExecutorService,
    SpellResolutionCacheService,
    LandSelectionService,
  ],
  exports: [
    PlaytestingService,
    GameEngineService,
    KeywordAbilitiesService,
    AIOpponentService,
    GameLoopService,
    TokensService,
    SearchService,
    SpellEffectsService,
  ],
})
export class PlaytestingModule implements OnModuleInit {
  constructor(
    private spellEffectsService: SpellEffectsService,
    private tokensService: TokensService,
    private searchService: SearchService,
    private gameEngine: GameEngineService,
    private landSelection: LandSelectionService,
  ) {}

  /**
   * Register all spell effects when the module initializes
   */
  onModuleInit() {
    // Register Many Partings effect
    const manyPartingsEffect = new ManyPartingsEffect(
      this.tokensService,
      this.searchService,
      this.gameEngine,
      this.landSelection,
    );
    this.spellEffectsService.registerEffect(manyPartingsEffect);

    // Future spell effects can be registered here
  }
}
