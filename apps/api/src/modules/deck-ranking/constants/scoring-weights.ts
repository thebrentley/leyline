/**
 * Scoring weights and normalization constants for the deck ranking system.
 */

/** How much each layer contributes to the final score (must sum to 1.0 excluding commander) */
export const LAYER_WEIGHTS = {
  cardBaseline: 0.40,
  tagInteraction: 0.15,
  combos: 0.10,
  density: 0.20,
  graph: 0.15,
} as const;

/** Commander context is a multiplier (not additive), applied after weighted sum */
export const COMMANDER_MULTIPLIER_RANGE = {
  min: 0.85,
  max: 1.20,
} as const;

/** Synergy ratio thresholds → commander multiplier for power axis */
export const COMMANDER_SYNERGY_THRESHOLDS = [
  { maxRatio: 0.20, multiplier: 0.85 },  // Unfocused deck
  { maxRatio: 0.40, multiplier: 1.00 },  // Average
  { maxRatio: 0.60, multiplier: 1.10 },  // Focused
  { maxRatio: 1.00, multiplier: 1.20 },  // Highly tuned
] as const;

/** Commander reputation baseline threshold for salt/fear multiplier boost */
export const COMMANDER_REPUTATION_THRESHOLD = 60; // baseline score 0-100
export const COMMANDER_REPUTATION_MULTIPLIER = 1.15;

/** Maximum raw score from interaction rules before normalization */
export const INTERACTION_RAW_CAP = 100;

/** Maximum raw score from combo detection before normalization */
export const COMBO_RAW_CAP = 100;

/** Density analysis scoring formulas produce raw scores on 0-100 scale */
export const DENSITY_FORMULAS = {
  // Power
  rampDensityMultiplier: 150,     // rampDensity * this, capped at 20
  rampDensityCap: 20,
  drawDensityMultiplier: 120,     // drawDensity * this, capped at 15
  drawDensityCap: 15,
  curveEfficiencyThresholds: [    // avgCmc → power bonus
    { maxCmc: 2.5, bonus: 15 },
    { maxCmc: 3.0, bonus: 10 },
    { maxCmc: 3.5, bonus: 5 },
  ] as const,
  tutorBonusPerTutor: 3,         // per tutor card, capped
  tutorBonusCap: 15,

  // Salt
  interactionDensityThreshold: 0.15,
  interactionDensityMultiplier: 200,
  interactionDensityCap: 20,
  counterspellHeavyThreshold: 8,
  counterspellHeavyBonus: 10,

  // Fear
  avgPowerThreshold: 4,
  avgPowerBonusPerPoint: 5,       // per point above threshold, capped at 20
  avgPowerBonusCap: 20,
  evasionRatioThreshold: 0.4,
  evasionRatioBonus: 10,
  tokenGeneratorMultiplier: 2,    // per token generator, capped at 15
  tokenGeneratorCap: 15,

  // Airtime
  triggerMultiplier: 1,           // per trigger card, capped at 20
  triggerCap: 20,
  tokenAirtimeMultiplier: 1.5,
  tokenAirtimeCap: 15,
  counterTrackingMultiplier: 1.5,
  counterTrackingCap: 10,
  recursionMultiplier: 2,
  recursionCap: 10,
} as const;

/** Graph analysis scoring constants */
export const GRAPH_SCORING = {
  densityMultiplier: 50,          // graph_density * this, capped at 20
  densityCap: 20,
  hubCentralityThreshold: 0.1,
  hubHighCentralityThreshold: 0.2,
  hubBonus: 10,
  hubHighBonus: 15,
  focusedClusterBonus: 5,         // 2-3 clusters
  veryFocusedClusterBonus: 10,    // 1 large cluster
  engineClusterMinSize: 4,
  engineClusterAirtimeBonus: 10,
  engineClusterCap: 20,
  clusterEdgeMinWeight: 4,        // min edge weight for label propagation clustering
  clusterOverlapMinEdges: 2,      // min strong edges into a cluster for overlap membership
} as const;

/** Final score is clamped to this range */
export const SCORE_RANGE = { min: 0, max: 100 } as const;

/** Current scoring algorithm version — bump to trigger re-scoring all decks */
export const SCORE_VERSION = 1;
