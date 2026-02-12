import { Injectable } from '@nestjs/common';
import { DENSITY_FORMULAS } from '../constants/scoring-weights';

export interface CardForDensity {
  name: string;
  typeLine: string;
  manaCost: string | null;
  cmc: number | null;
  oracleText: string | null;
  power: string | null;
  toughness: string | null;
  tags: string[];
}

export interface DensityStats {
  averageCmc: number;
  medianCmc: number;
  curveDistribution: Record<number, number>;
  landCount: number;
  landRatio: number;
  rampDensity: number;
  drawDensity: number;
  removalDensity: number;
  interactionDensity: number;
  tutorCount: number;
  counterspellCount: number;
  creatureCount: number;
  averageCreaturePower: number;
  averageCreatureToughness: number;
  evasionCount: number;
  triggerCount: number;
  tokenGeneratorCount: number;
  counterTrackingCount: number;
  recursionCount: number;
}

export interface DensityResult {
  scores: { power: number; salt: number; fear: number; airtime: number };
  stats: DensityStats;
}

@Injectable()
export class DensityAnalysisService {
  analyzeDeck(cards: CardForDensity[]): DensityResult {
    const totalCards = cards.length;
    if (totalCards === 0) {
      return {
        scores: { power: 0, salt: 0, fear: 0, airtime: 0 },
        stats: this.emptyStats(),
      };
    }

    const stats = this.computeStats(cards, totalCards);
    const scores = this.computeScoresFromStats(stats);

    return { scores, stats };
  }

  private computeStats(cards: CardForDensity[], totalCards: number): DensityStats {
    const f = DENSITY_FORMULAS;

    // Mana curve
    const nonLandCmcs: number[] = [];
    const curveDistribution: Record<number, number> = {};
    let landCount = 0;

    // Functional counts
    let rampCount = 0;
    let drawCount = 0;
    let removalCount = 0;
    let counterspellCount = 0;
    let tutorCount = 0;

    // Creature stats
    let creatureCount = 0;
    let totalCreaturePower = 0;
    let totalCreatureToughness = 0;
    let evasionCount = 0;

    // Complexity
    let triggerCount = 0;
    let tokenGeneratorCount = 0;
    let counterTrackingCount = 0;
    let recursionCount = 0;

    const rampTags = new Set(['mana-rock', 'mana-dork', 'land-ramp', 'cost-reducer', 'ritual', 'mana-doubler']);
    const drawTags = new Set(['card-draw', 'impulse-draw', 'wheel']);
    const removalTags = new Set(['targeted-removal', 'board-wipe', 'board-wipe-asymmetric', 'artifact-removal', 'enchantment-removal', 'creature-removal', 'planeswalker-removal', 'exile-removal']);
    const counterTags = new Set(['counterspell-hard', 'counterspell-conditional', 'counterspell-free']);
    const tutorTags = new Set(['tutor-any', 'tutor-creature', 'tutor-artifact', 'tutor-land', 'tutor-instant-sorcery']);
    const tokenTags = new Set(['token-generator', 'token-on-death', 'token-on-etb', 'token-on-attack', 'token-mass']);
    const recursionTags = new Set(['recursive-creature', 'recursion-engine', 'reanimation']);

    for (const card of cards) {
      const isLand = card.typeLine.toLowerCase().includes('land');
      const isCreature = card.typeLine.toLowerCase().includes('creature');
      const tags = new Set(card.tags);

      if (isLand) {
        landCount++;
      } else if (card.cmc != null) {
        const cmc = Math.round(card.cmc);
        nonLandCmcs.push(cmc);
        curveDistribution[cmc] = (curveDistribution[cmc] || 0) + 1;
      }

      // Tag-based counts
      if (card.tags.some((t) => rampTags.has(t))) rampCount++;
      if (card.tags.some((t) => drawTags.has(t))) drawCount++;
      if (card.tags.some((t) => removalTags.has(t))) removalCount++;
      if (card.tags.some((t) => counterTags.has(t))) counterspellCount++;
      if (card.tags.some((t) => tutorTags.has(t))) tutorCount++;
      if (card.tags.some((t) => tokenTags.has(t))) tokenGeneratorCount++;
      if (card.tags.some((t) => recursionTags.has(t))) recursionCount++;

      // Creature stats
      if (isCreature) {
        creatureCount++;
        const p = parseFloat(card.power || '0');
        const t = parseFloat(card.toughness || '0');
        if (!isNaN(p)) totalCreaturePower += p;
        if (!isNaN(t)) totalCreatureToughness += t;
        if (tags.has('evasion-grant') || this.hasEvasionKeyword(card.oracleText)) {
          evasionCount++;
        }
      }

      // Complexity indicators
      if (tags.has('trigger-heavy') || tags.has('etb-trigger') || tags.has('death-trigger')) {
        triggerCount++;
      }
      if (tags.has('counter-manipulation')) counterTrackingCount++;
    }

    // Mana curve stats
    nonLandCmcs.sort((a, b) => a - b);
    const averageCmc = nonLandCmcs.length > 0
      ? nonLandCmcs.reduce((a, b) => a + b, 0) / nonLandCmcs.length
      : 0;
    const medianCmc = nonLandCmcs.length > 0
      ? nonLandCmcs[Math.floor(nonLandCmcs.length / 2)]
      : 0;

    const nonLandCount = totalCards - landCount;

    return {
      averageCmc,
      medianCmc,
      curveDistribution,
      landCount,
      landRatio: landCount / totalCards,
      rampDensity: nonLandCount > 0 ? rampCount / nonLandCount : 0,
      drawDensity: nonLandCount > 0 ? drawCount / nonLandCount : 0,
      removalDensity: nonLandCount > 0 ? removalCount / nonLandCount : 0,
      interactionDensity: nonLandCount > 0 ? (removalCount + counterspellCount) / nonLandCount : 0,
      tutorCount,
      counterspellCount,
      creatureCount,
      averageCreaturePower: creatureCount > 0 ? totalCreaturePower / creatureCount : 0,
      averageCreatureToughness: creatureCount > 0 ? totalCreatureToughness / creatureCount : 0,
      evasionCount,
      triggerCount,
      tokenGeneratorCount,
      counterTrackingCount,
      recursionCount,
    };
  }

  private computeScoresFromStats(stats: DensityStats): { power: number; salt: number; fear: number; airtime: number } {
    const f = DENSITY_FORMULAS;

    // === Power ===
    let power = 0;
    power += Math.min(stats.rampDensity * f.rampDensityMultiplier, f.rampDensityCap);
    power += Math.min(stats.drawDensity * f.drawDensityMultiplier, f.drawDensityCap);
    for (const threshold of f.curveEfficiencyThresholds) {
      if (stats.averageCmc <= threshold.maxCmc) {
        power += threshold.bonus;
        break;
      }
    }
    power += Math.min(stats.tutorCount * f.tutorBonusPerTutor, f.tutorBonusCap);

    // === Salt ===
    let salt = 0;
    if (stats.interactionDensity > f.interactionDensityThreshold) {
      salt += Math.min(
        (stats.interactionDensity - f.interactionDensityThreshold) * f.interactionDensityMultiplier,
        f.interactionDensityCap,
      );
    }
    if (stats.counterspellCount > f.counterspellHeavyThreshold) {
      salt += f.counterspellHeavyBonus;
    }

    // === Fear ===
    let fear = 0;
    if (stats.averageCreaturePower > f.avgPowerThreshold) {
      fear += Math.min(
        (stats.averageCreaturePower - f.avgPowerThreshold) * f.avgPowerBonusPerPoint,
        f.avgPowerBonusCap,
      );
    }
    if (stats.creatureCount > 0 && stats.evasionCount / stats.creatureCount > f.evasionRatioThreshold) {
      fear += f.evasionRatioBonus;
    }
    fear += Math.min(stats.tokenGeneratorCount * f.tokenGeneratorMultiplier, f.tokenGeneratorCap);

    // === Airtime ===
    let airtime = 0;
    airtime += Math.min(stats.triggerCount * f.triggerMultiplier, f.triggerCap);
    airtime += Math.min(stats.tokenGeneratorCount * f.tokenAirtimeMultiplier, f.tokenAirtimeCap);
    airtime += Math.min(stats.counterTrackingCount * f.counterTrackingMultiplier, f.counterTrackingCap);
    airtime += Math.min(stats.recursionCount * f.recursionMultiplier, f.recursionCap);

    return { power, salt, fear, airtime };
  }

  private hasEvasionKeyword(oracleText: string | null): boolean {
    if (!oracleText) return false;
    const text = oracleText.toLowerCase();
    return (
      text.includes('flying') ||
      text.includes('trample') ||
      text.includes('menace') ||
      text.includes('unblockable') ||
      text.includes("can't be blocked") ||
      text.includes('shadow') ||
      text.includes('fear') ||
      text.includes('intimidate')
    );
  }

  private emptyStats(): DensityStats {
    return {
      averageCmc: 0,
      medianCmc: 0,
      curveDistribution: {},
      landCount: 0,
      landRatio: 0,
      rampDensity: 0,
      drawDensity: 0,
      removalDensity: 0,
      interactionDensity: 0,
      tutorCount: 0,
      counterspellCount: 0,
      creatureCount: 0,
      averageCreaturePower: 0,
      averageCreatureToughness: 0,
      evasionCount: 0,
      triggerCount: 0,
      tokenGeneratorCount: 0,
      counterTrackingCount: 0,
      recursionCount: 0,
    };
  }
}
