import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { ScoreComputationService } from './services/score-computation.service';
import { CardTaggingService } from './services/card-tagging.service';
import { ComboDetectionService } from './services/combo-detection.service';

@Controller('deck-ranking')
@UseGuards(JwtAuthGuard)
export class DeckRankingController {
  constructor(
    private scoreComputation: ScoreComputationService,
    private cardTagging: CardTaggingService,
    private comboDetection: ComboDetectionService,
  ) {}

  @Get(':deckId/scores')
  async getScores(
    @Param('deckId') deckId: string,
    @CurrentUser() user: User,
  ) {
    const isStale = await this.scoreComputation.isStale(deckId);
    let scores = await this.scoreComputation.getScores(deckId);

    if (!scores || isStale) {
      scores = await this.scoreComputation.computeScores(deckId);
    }

    return {
      scores: {
        power: scores.power,
        salt: scores.salt,
        fear: scores.fear,
        airtime: scores.airtime,
      },
      layerBreakdown: scores.layerScores,
      notableCards: scores.notableCards,
      detectedCombos: scores.detectedCombos,
      detectedEngines: scores.detectedEngines,
      computedAt: scores.computedAt,
      isStale: false,
    };
  }

  @Post(':deckId/recompute')
  async recomputeScores(
    @Param('deckId') deckId: string,
    @CurrentUser() user: User,
  ) {
    const scores = await this.scoreComputation.computeScores(deckId);
    return {
      scores: {
        power: scores.power,
        salt: scores.salt,
        fear: scores.fear,
        airtime: scores.airtime,
      },
      layerBreakdown: scores.layerScores,
      notableCards: scores.notableCards,
      detectedCombos: scores.detectedCombos,
      detectedEngines: scores.detectedEngines,
      computedAt: scores.computedAt,
      isStale: false,
    };
  }

  // === Admin endpoints ===

  @Post('admin/start-tagging')
  async startTagging() {
    return this.cardTagging.startBulkTagging();
  }

  @Get('admin/tagging-status/:jobId')
  async getTaggingStatus(@Param('jobId') jobId: string) {
    return this.cardTagging.getJobStatus(jobId);
  }

  @Post('admin/sync-combos')
  async syncCombos() {
    return this.comboDetection.syncFromSpellbook();
  }
}
