import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeckScore, AxisScores, LayerScores } from '../../../entities/deck-score.entity';
import { DeckCard } from '../../../entities/deck-card.entity';
import { Deck } from '../../../entities/deck.entity';
import { CardTag } from '../../../entities/card-tag.entity';
import { CardTaggingService } from './card-tagging.service';
import { InteractionRuleService } from './interaction-rule.service';
import { ComboDetectionService } from './combo-detection.service';
import { CommanderContextService } from './commander-context.service';
import { DensityAnalysisService, CardForDensity } from './density-analysis.service';
import { GraphAnalysisService } from './graph-analysis.service';
import {
  LAYER_WEIGHTS,
  SCORE_RANGE,
  SCORE_VERSION,
  INTERACTION_RAW_CAP,
  COMBO_RAW_CAP,
} from '../constants/scoring-weights';

@Injectable()
export class ScoreComputationService {
  private readonly logger = new Logger(ScoreComputationService.name);

  constructor(
    @InjectRepository(DeckScore) private scoreRepo: Repository<DeckScore>,
    @InjectRepository(DeckCard) private deckCardRepo: Repository<DeckCard>,
    @InjectRepository(Deck) private deckRepo: Repository<Deck>,
    @InjectRepository(CardTag) private cardTagRepo: Repository<CardTag>,
    private cardTagging: CardTaggingService,
    private interactionRules: InteractionRuleService,
    private comboDetection: ComboDetectionService,
    private commanderContext: CommanderContextService,
    private densityAnalysis: DensityAnalysisService,
    private graphAnalysis: GraphAnalysisService,
  ) {}

  async computeScores(deckId: string): Promise<DeckScore> {
    // 1. Load deck cards with card data
    const deckCards = await this.deckCardRepo.find({
      where: { deckId },
      relations: ['card'],
    });

    if (deckCards.length === 0) {
      throw new Error('Deck has no cards');
    }

    // Separate commanders from the 99
    const commanders = deckCards.filter((dc) => dc.isCommander);
    const allCards = deckCards;

    // Get unique card names
    const uniqueNames = [...new Set(allCards.map((dc) => dc.card.name))];
    const commanderNames = commanders.map((dc) => dc.card.name);

    // 2. Load card tags for all cards
    const tagMap = await this.cardTagging.getTagsForCards(uniqueNames);

    // 3. Lazy-tag any untagged cards
    const untaggedCards = allCards.filter((dc) => !tagMap.has(dc.card.name));
    if (untaggedCards.length > 0) {
      this.logger.log(`Lazy-tagging ${untaggedCards.length} untagged cards for deck ${deckId}`);
      for (const dc of untaggedCards) {
        try {
          const tag = await this.cardTagging.tagSingleCard({
            name: dc.card.name,
            oracleText: dc.card.oracleText,
            typeLine: dc.card.typeLine,
            manaCost: dc.card.manaCost,
            power: dc.card.power,
            toughness: dc.card.toughness,
          });
          tagMap.set(dc.card.name, tag);
        } catch (err) {
          this.logger.warn(`Failed to tag card ${dc.card.name}: ${err.message}`);
        }
      }
    }

    // Build cardName → tags map for the scoring services
    const cardTagsMap = new Map<string, string[]>();
    for (const [name, tag] of tagMap) {
      cardTagsMap.set(name, tag.tags);
    }

    // 4. LAYER 1: Card Baselines (weighted average)
    const cardBaseline = this.computeCardBaseline(allCards, tagMap);

    // 5. LAYER 2: Tag Interactions
    const interactionResult = await this.interactionRules.calculateTagInteractions(cardTagsMap);
    // Normalize: divide by card count and cap
    const cardCount = uniqueNames.length;
    const tagInteraction: AxisScores = {
      power: Math.min((interactionResult.power / Math.max(cardCount * 0.5, 1)) * 10, INTERACTION_RAW_CAP),
      salt: Math.min((interactionResult.salt / Math.max(cardCount * 0.5, 1)) * 10, INTERACTION_RAW_CAP),
      fear: Math.min((interactionResult.fear / Math.max(cardCount * 0.5, 1)) * 10, INTERACTION_RAW_CAP),
      airtime: Math.min((interactionResult.airtime / Math.max(cardCount * 0.5, 1)) * 10, INTERACTION_RAW_CAP),
    };

    // 6. LAYER 3: Combo Detection
    const tutorTags = new Set(['tutor-any', 'tutor-creature', 'tutor-artifact', 'tutor-land', 'tutor-instant-sorcery']);
    let tutorCount = 0;
    for (const [, tags] of cardTagsMap) {
      if (tags.some((t) => tutorTags.has(t))) tutorCount++;
    }

    const comboResult = await this.comboDetection.detectCombos(
      uniqueNames,
      commanderNames,
      tutorCount,
    );
    const combos: AxisScores = {
      power: Math.min(comboResult.power, COMBO_RAW_CAP),
      salt: Math.min(comboResult.salt, COMBO_RAW_CAP),
      fear: Math.min(comboResult.fear, COMBO_RAW_CAP),
      airtime: Math.min(comboResult.airtime, COMBO_RAW_CAP),
    };

    // 7. LAYER 4: Commander Context (multiplier)
    const rules = await this.interactionRules.getActiveRules();
    const commanderResult = await this.commanderContext.calculateCommanderModifiers(
      commanderNames,
      cardTagsMap,
      rules,
    );
    const commanderScores: AxisScores = {
      power: commanderResult.multipliers.power * 100, // Store multiplier scaled to 100 for display
      salt: commanderResult.multipliers.salt * 100,
      fear: commanderResult.multipliers.fear * 100,
      airtime: commanderResult.multipliers.airtime * 100,
    };

    // 8. LAYER 5: Density Analysis
    const cardsForDensity: CardForDensity[] = allCards.map((dc) => ({
      name: dc.card.name,
      typeLine: dc.card.typeLine,
      manaCost: dc.card.manaCost,
      cmc: dc.card.cmc,
      oracleText: dc.card.oracleText,
      power: dc.card.power,
      toughness: dc.card.toughness,
      tags: cardTagsMap.get(dc.card.name) || [],
    }));
    const densityResult = this.densityAnalysis.analyzeDeck(cardsForDensity);

    // 9. LAYER 6: Graph Analysis
    const graphResult = this.graphAnalysis.analyzeGraph(cardTagsMap, rules);

    // 10. COMBINE: Weighted sum + commander multiplier
    const axes: (keyof AxisScores)[] = ['power', 'salt', 'fear', 'airtime'];
    const finalScores: AxisScores = { power: 0, salt: 0, fear: 0, airtime: 0 };

    for (const axis of axes) {
      const weighted =
        cardBaseline[axis] * LAYER_WEIGHTS.cardBaseline +
        tagInteraction[axis] * LAYER_WEIGHTS.tagInteraction +
        combos[axis] * LAYER_WEIGHTS.combos +
        densityResult.scores[axis] * LAYER_WEIGHTS.density +
        graphResult.scores[axis] * LAYER_WEIGHTS.graph;

      const modified = weighted * commanderResult.multipliers[axis];
      finalScores[axis] = Math.round(
        Math.max(SCORE_RANGE.min, Math.min(SCORE_RANGE.max, modified)),
      );
    }

    // 11. Build notable cards
    const notableCards = this.buildNotableCards(allCards, tagMap, graphResult);

    // 12. Build detected combos
    const detectedCombos = comboResult.combos
      .filter((c) => c.completeness === 1)
      .map((c) => ({
        cardNames: c.presentCards,
        isGameWinning: c.entry.isGameWinning,
        pieceCount: c.entry.pieceCount,
        description: c.entry.description || 'Unknown combo',
      }));

    // 13. Build detected engines
    const detectedEngines = graphResult.clusters
      .filter((c) => c.cards.length >= 3)
      .map((c) => ({
        cards: c.cards,
        description: c.theme,
      }));

    // 14. Save
    const layerScores: LayerScores = {
      cardBaseline,
      tagInteraction,
      combos,
      commander: commanderScores,
      density: densityResult.scores,
      graph: graphResult.scores,
    };

    const totalCardCount = allCards.reduce((sum, dc) => sum + dc.quantity, 0);

    const existing = await this.scoreRepo.findOne({ where: { deckId } });
    if (existing) {
      existing.power = finalScores.power;
      existing.salt = finalScores.salt;
      existing.fear = finalScores.fear;
      existing.airtime = finalScores.airtime;
      existing.layerScores = layerScores;
      existing.notableCards = notableCards;
      existing.detectedCombos = detectedCombos.length > 0 ? detectedCombos : null;
      existing.detectedEngines = detectedEngines.length > 0 ? detectedEngines : null;
      existing.cardCountAtScoring = totalCardCount;
      existing.scoreVersion = SCORE_VERSION;
      existing.computedAt = new Date();
      return this.scoreRepo.save(existing);
    }

    const deckScore = this.scoreRepo.create({
      deckId,
      ...finalScores,
      layerScores,
      notableCards,
      detectedCombos: detectedCombos.length > 0 ? detectedCombos : null,
      detectedEngines: detectedEngines.length > 0 ? detectedEngines : null,
      cardCountAtScoring: totalCardCount,
      scoreVersion: SCORE_VERSION,
      computedAt: new Date(),
    });
    return this.scoreRepo.save(deckScore);
  }

  async isStale(deckId: string): Promise<boolean> {
    const score = await this.scoreRepo.findOne({ where: { deckId } });
    if (!score) return true;
    if (score.scoreVersion < SCORE_VERSION) return true;

    const deck = await this.deckRepo.findOne({ where: { id: deckId } });
    if (!deck) return true;

    return deck.updatedAt > score.computedAt;
  }

  async getScores(deckId: string): Promise<DeckScore | null> {
    return this.scoreRepo.findOne({ where: { deckId } });
  }

  private computeCardBaseline(
    deckCards: DeckCard[],
    tagMap: Map<string, CardTag>,
  ): AxisScores {
    let totalPower = 0;
    let totalSalt = 0;
    let totalFear = 0;
    let totalAirtime = 0;
    let totalWeight = 0;

    for (const dc of deckCards) {
      const tag = tagMap.get(dc.card.name);
      if (!tag?.powerBaseline) continue;

      const weight = dc.quantity;
      totalPower += tag.powerBaseline.power * weight;
      totalSalt += tag.powerBaseline.salt * weight;
      totalFear += tag.powerBaseline.fear * weight;
      totalAirtime += tag.powerBaseline.airtime * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return { power: 0, salt: 0, fear: 0, airtime: 0 };
    }

    return {
      power: totalPower / totalWeight,
      salt: totalSalt / totalWeight,
      fear: totalFear / totalWeight,
      airtime: totalAirtime / totalWeight,
    };
  }

  private buildNotableCards(
    deckCards: DeckCard[],
    tagMap: Map<string, CardTag>,
    graphResult: any,
  ) {
    const scored = deckCards
      .map((dc) => ({
        name: dc.card.name,
        baseline: tagMap.get(dc.card.name)?.powerBaseline,
      }))
      .filter((c) => c.baseline);

    const topN = 5;
    const byPower = [...scored].sort((a, b) => (b.baseline?.power ?? 0) - (a.baseline?.power ?? 0));
    const bySalt = [...scored].sort((a, b) => (b.baseline?.salt ?? 0) - (a.baseline?.salt ?? 0));
    const byFear = [...scored].sort((a, b) => (b.baseline?.fear ?? 0) - (a.baseline?.fear ?? 0));
    const byAirtime = [...scored].sort((a, b) => (b.baseline?.airtime ?? 0) - (a.baseline?.airtime ?? 0));

    const hubNames = graphResult.hubs
      .slice(0, topN)
      .map((h: any) => h.cardName);

    const comboCards = new Set<string>();
    for (const [name, tag] of tagMap) {
      if (tag.tags.includes('infinite-combo-piece')) {
        comboCards.add(name);
      }
    }

    return {
      highPower: byPower.slice(0, topN).map((c) => c.name),
      highSalt: bySalt.slice(0, topN).map((c) => c.name),
      highFear: byFear.slice(0, topN).map((c) => c.name),
      highAirtime: byAirtime.slice(0, topN).map((c) => c.name),
      synergyHubs: hubNames,
      comboCards: Array.from(comboCards),
    };
  }
}
