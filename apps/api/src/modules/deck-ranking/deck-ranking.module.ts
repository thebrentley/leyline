import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardTag } from '../../entities/card-tag.entity';
import { InteractionRule } from '../../entities/interaction-rule.entity';
import { ComboEntry } from '../../entities/combo-entry.entity';
import { DeckScore } from '../../entities/deck-score.entity';
import { CardTaggingJob } from '../../entities/card-tagging-job.entity';
import { Card } from '../../entities/card.entity';
import { Deck } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { DeckRankingController } from './deck-ranking.controller';
import { CardTaggingService } from './services/card-tagging.service';
import { InteractionRuleService } from './services/interaction-rule.service';
import { ComboDetectionService } from './services/combo-detection.service';
import { CommanderContextService } from './services/commander-context.service';
import { DensityAnalysisService } from './services/density-analysis.service';
import { GraphAnalysisService } from './services/graph-analysis.service';
import { ScoreComputationService } from './services/score-computation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CardTag,
      InteractionRule,
      ComboEntry,
      DeckScore,
      CardTaggingJob,
      Card,
      Deck,
      DeckCard,
    ]),
  ],
  controllers: [DeckRankingController],
  providers: [
    CardTaggingService,
    InteractionRuleService,
    ComboDetectionService,
    CommanderContextService,
    DensityAnalysisService,
    GraphAnalysisService,
    ScoreComputationService,
  ],
  exports: [ScoreComputationService, CardTaggingService],
})
export class DeckRankingModule {}
