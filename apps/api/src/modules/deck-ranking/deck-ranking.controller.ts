import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { Deck } from '../../entities/deck.entity';
import { ScoreComputationService } from './services/score-computation.service';
import { CardTaggingService } from './services/card-tagging.service';
import { ComboDetectionService } from './services/combo-detection.service';

@Controller('deck-ranking')
@UseGuards(JwtAuthGuard)
export class DeckRankingController {
  constructor(
    @InjectRepository(Deck) private deckRepo: Repository<Deck>,
    private scoreComputation: ScoreComputationService,
    private cardTagging: CardTaggingService,
    private comboDetection: ComboDetectionService,
  ) {}

  private async verifyDeckOwnership(
    deckId: string,
    userId: string,
  ): Promise<void> {
    const deck = await this.deckRepo.findOne({
      where: { id: deckId, userId },
      select: ['id'],
    });
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }
  }

  @Get(':deckId/scores')
  async getScores(
    @Param('deckId') deckId: string,
    @CurrentUser() user: User,
  ) {
    await this.verifyDeckOwnership(deckId, user.id);
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
    await this.verifyDeckOwnership(deckId, user.id);
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

  // === Admin endpoints (requires ADMIN_EMAILS env var) ===

  @Post('admin/start-tagging')
  @UseGuards(AdminGuard)
  async startTagging() {
    return this.cardTagging.startBulkTagging();
  }

  @Get('admin/tagging-status/:jobId')
  @UseGuards(AdminGuard)
  async getTaggingStatus(@Param('jobId') jobId: string) {
    return this.cardTagging.getJobStatus(jobId);
  }

  @Post('admin/sync-combos')
  @UseGuards(AdminGuard)
  async syncCombos() {
    return this.comboDetection.syncFromSpellbook();
  }
}
