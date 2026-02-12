import { InteractionType } from '../../../entities/interaction-rule.entity';

/**
 * Seed data for interaction rules between card mechanical tags.
 * Each rule defines how two tags interact and the axis modifiers they produce.
 *
 * Modifiers are on a 0-100 raw scale per interaction pair found.
 * They get summed across all matching pairs and normalized during scoring.
 */

interface RuleSeed {
  tagA: string;
  tagB: string;
  modifiers: { power: number; salt: number; fear: number; airtime: number };
  interactionType: InteractionType;
  description: string;
}

export const INTERACTION_RULES_SEED: RuleSeed[] = [
  // === Aristocrats / Sacrifice Engines ===
  {
    tagA: 'token-generator', tagB: 'sacrifice-outlet-free',
    modifiers: { power: 4, salt: 1, fear: 2, airtime: 2 },
    interactionType: 'engine',
    description: 'Tokens provide free fodder for sacrifice outlets',
  },
  {
    tagA: 'sacrifice-outlet-free', tagB: 'death-trigger',
    modifiers: { power: 4, salt: 1, fear: 2, airtime: 2 },
    interactionType: 'engine',
    description: 'Free sacrifice + death trigger creates a repeatable value engine',
  },
  {
    tagA: 'sacrifice-outlet-free', tagB: 'blood-artist-effect',
    modifiers: { power: 5, salt: 2, fear: 2, airtime: 2 },
    interactionType: 'engine',
    description: 'Sacrifice outlet + drain effect is a classic aristocrats wincon',
  },
  {
    tagA: 'token-generator', tagB: 'blood-artist-effect',
    modifiers: { power: 3, salt: 1, fear: 1, airtime: 1 },
    interactionType: 'synergy',
    description: 'Tokens dying trigger drain effects',
  },
  {
    tagA: 'recursive-creature', tagB: 'sacrifice-outlet-free',
    modifiers: { power: 4, salt: 1, fear: 1, airtime: 3 },
    interactionType: 'engine',
    description: 'Recursive creature + sac outlet = infinite loop potential',
  },
  {
    tagA: 'death-trigger', tagB: 'blood-artist-effect',
    modifiers: { power: 3, salt: 1, fear: 1, airtime: 1 },
    interactionType: 'synergy',
    description: 'Death triggers compound with drain effects',
  },

  // === Token + Combat ===
  {
    tagA: 'token-generator', tagB: 'anthem',
    modifiers: { power: 2, salt: 0, fear: 4, airtime: 0 },
    interactionType: 'synergy',
    description: 'Tokens become much scarier with anthem effects',
  },
  {
    tagA: 'token-mass', tagB: 'anthem',
    modifiers: { power: 3, salt: 0, fear: 5, airtime: 0 },
    interactionType: 'synergy',
    description: 'Mass token production + anthems = overwhelming board',
  },
  {
    tagA: 'token-generator', tagB: 'extra-combat',
    modifiers: { power: 3, salt: 0, fear: 4, airtime: 1 },
    interactionType: 'synergy',
    description: 'Tokens that attack multiple times per turn',
  },

  // === Blink / ETB Engines ===
  {
    tagA: 'blink-enabler', tagB: 'etb-trigger',
    modifiers: { power: 3, salt: 0, fear: 2, airtime: 2 },
    interactionType: 'engine',
    description: 'Blink + ETB creates repeatable value',
  },
  {
    tagA: 'panharmonicon-effect', tagB: 'etb-trigger',
    modifiers: { power: 3, salt: 0, fear: 2, airtime: 3 },
    interactionType: 'engine',
    description: 'Doubled ETB triggers generate massive value and complexity',
  },
  {
    tagA: 'panharmonicon-effect', tagB: 'token-on-etb',
    modifiers: { power: 3, salt: 0, fear: 3, airtime: 2 },
    interactionType: 'engine',
    description: 'Doubled token ETBs create overwhelming boards',
  },

  // === Stax + Tax (Salt engines) ===
  {
    tagA: 'stax-symmetrical', tagB: 'mana-rock',
    modifiers: { power: 3, salt: 2, fear: 1, airtime: 0 },
    interactionType: 'synergy',
    description: 'Rocks break symmetry of stax pieces',
  },
  {
    tagA: 'stax-symmetrical', tagB: 'mana-dork',
    modifiers: { power: 2, salt: 2, fear: 1, airtime: 0 },
    interactionType: 'synergy',
    description: 'Dorks break symmetry of stax pieces',
  },
  {
    tagA: 'stax-asymmetrical', tagB: 'stax-asymmetrical',
    modifiers: { power: 2, salt: 4, fear: 1, airtime: 0 },
    interactionType: 'synergy',
    description: 'Stacking asymmetric stax is deeply frustrating',
  },
  {
    tagA: 'tax-effect', tagB: 'tax-effect',
    modifiers: { power: 1, salt: 4, fear: 0, airtime: 0 },
    interactionType: 'synergy',
    description: 'Multiple tax effects compound into oppressive gameplay',
  },
  {
    tagA: 'stax-symmetrical', tagB: 'stax-symmetrical',
    modifiers: { power: 2, salt: 5, fear: 1, airtime: 0 },
    interactionType: 'synergy',
    description: 'Multiple stax locks create salt exponentially',
  },
  {
    tagA: 'resource-denial', tagB: 'land-destruction',
    modifiers: { power: 2, salt: 5, fear: 2, airtime: 0 },
    interactionType: 'synergy',
    description: 'Land destruction + resource denial locks players out',
  },

  // === Combo Enablers ===
  {
    tagA: 'tutor-any', tagB: 'infinite-combo-piece',
    modifiers: { power: 4, salt: 2, fear: 1, airtime: 1 },
    interactionType: 'synergy',
    description: 'Tutors finding combo pieces dramatically increases consistency',
  },
  {
    tagA: 'untap-combo', tagB: 'mana-dork',
    modifiers: { power: 3, salt: 0, fear: 1, airtime: 2 },
    interactionType: 'synergy',
    description: 'Untap effects + mana creatures enable infinite mana',
  },
  {
    tagA: 'untap-combo', tagB: 'mana-doubler',
    modifiers: { power: 4, salt: 0, fear: 1, airtime: 2 },
    interactionType: 'synergy',
    description: 'Untap + mana doubler = explosive mana generation',
  },
  {
    tagA: 'copy-effect', tagB: 'etb-trigger',
    modifiers: { power: 2, salt: 0, fear: 2, airtime: 2 },
    interactionType: 'synergy',
    description: 'Copying ETB creatures multiplies value',
  },
  {
    tagA: 'infinite-combo-piece', tagB: 'infinite-combo-piece',
    modifiers: { power: 5, salt: 2, fear: 2, airtime: 3 },
    interactionType: 'synergy',
    description: 'Multiple combo pieces increase chances of assembling a combo',
  },
  {
    tagA: 'mana-sink', tagB: 'mana-doubler',
    modifiers: { power: 3, salt: 0, fear: 2, airtime: 1 },
    interactionType: 'synergy',
    description: 'Mana sinks convert excess mana into winning',
  },

  // === Storm / Spellslinger ===
  {
    tagA: 'storm-enabler', tagB: 'cost-reducer',
    modifiers: { power: 4, salt: 1, fear: 1, airtime: 4 },
    interactionType: 'engine',
    description: 'Cost reduction enables storm chains',
  },
  {
    tagA: 'storm-enabler', tagB: 'cantrip',
    modifiers: { power: 2, salt: 0, fear: 0, airtime: 3 },
    interactionType: 'synergy',
    description: 'Cantrips fuel storm count and airtime',
  },
  {
    tagA: 'storm-enabler', tagB: 'ritual',
    modifiers: { power: 3, salt: 0, fear: 1, airtime: 3 },
    interactionType: 'engine',
    description: 'Rituals enable explosive storm turns',
  },
  {
    tagA: 'cascade-effect', tagB: 'cost-reducer',
    modifiers: { power: 3, salt: 1, fear: 1, airtime: 4 },
    interactionType: 'engine',
    description: 'Cascade chains are powerful and time-consuming',
  },

  // === Graveyard Engines ===
  {
    tagA: 'reanimation', tagB: 'self-mill',
    modifiers: { power: 3, salt: 0, fear: 2, airtime: 1 },
    interactionType: 'engine',
    description: 'Self-mill fills the yard, reanimation cheats things into play',
  },
  {
    tagA: 'recursion-engine', tagB: 'etb-trigger',
    modifiers: { power: 3, salt: 0, fear: 1, airtime: 3 },
    interactionType: 'engine',
    description: 'Recurring ETB creatures generates endless value and triggers',
  },
  {
    tagA: 'graveyard-hate', tagB: 'graveyard-hate',
    modifiers: { power: 0, salt: 3, fear: 0, airtime: 0 },
    interactionType: 'synergy',
    description: 'Heavy graveyard hate is oppressive to GY strategies',
  },

  // === Theft & Control (Salt heavy) ===
  {
    tagA: 'steal-permanent', tagB: 'sacrifice-outlet-free',
    modifiers: { power: 3, salt: 4, fear: 2, airtime: 1 },
    interactionType: 'engine',
    description: 'Steal then sacrifice — the ultimate salt engine',
  },
  {
    tagA: 'steal-permanent', tagB: 'blink-enabler',
    modifiers: { power: 3, salt: 4, fear: 2, airtime: 1 },
    interactionType: 'engine',
    description: 'Blink stolen creatures to keep them permanently',
  },
  {
    tagA: 'mind-control', tagB: 'mind-control',
    modifiers: { power: 1, salt: 4, fear: 2, airtime: 0 },
    interactionType: 'synergy',
    description: 'Multiple theft effects are deeply frustrating',
  },
  {
    tagA: 'forced-sacrifice', tagB: 'forced-sacrifice',
    modifiers: { power: 1, salt: 3, fear: 1, airtime: 0 },
    interactionType: 'synergy',
    description: 'Repeated forced sacrifice grinds opponents down',
  },
  {
    tagA: 'forced-discard', tagB: 'forced-discard',
    modifiers: { power: 1, salt: 3, fear: 1, airtime: 0 },
    interactionType: 'synergy',
    description: 'Repeated discard empties hands and generates salt',
  },

  // === Extra Turns (Salt + Airtime) ===
  {
    tagA: 'extra-turn', tagB: 'extra-turn',
    modifiers: { power: 2, salt: 5, fear: 1, airtime: 5 },
    interactionType: 'synergy',
    description: 'Multiple extra turns = one player plays solitaire',
  },
  {
    tagA: 'extra-turn', tagB: 'tutor-any',
    modifiers: { power: 3, salt: 3, fear: 1, airtime: 2 },
    interactionType: 'synergy',
    description: 'Tutoring for extra turns is powerful and frustrating',
  },
  {
    tagA: 'extra-turn', tagB: 'recursion-engine',
    modifiers: { power: 3, salt: 4, fear: 1, airtime: 4 },
    interactionType: 'engine',
    description: 'Recurring extra turns is near-infinite solitaire',
  },

  // === Voltron ===
  {
    tagA: 'voltron-enabler', tagB: 'evasion-grant',
    modifiers: { power: 2, salt: 0, fear: 3, airtime: 0 },
    interactionType: 'synergy',
    description: 'Evasion on a voltron threat = unblockable commander damage',
  },
  {
    tagA: 'voltron-enabler', tagB: 'double-strike-grant',
    modifiers: { power: 3, salt: 0, fear: 4, airtime: 0 },
    interactionType: 'synergy',
    description: 'Double strike on voltron = one-shot kill potential',
  },
  {
    tagA: 'voltron-enabler', tagB: 'hexproof-shroud',
    modifiers: { power: 3, salt: 1, fear: 3, airtime: 0 },
    interactionType: 'synergy',
    description: 'Protected voltron threat is hard to answer',
  },
  {
    tagA: 'voltron-enabler', tagB: 'indestructible-grant',
    modifiers: { power: 2, salt: 1, fear: 3, airtime: 0 },
    interactionType: 'synergy',
    description: 'Indestructible voltron survives board wipes',
  },

  // === Ramp synergies ===
  {
    tagA: 'land-ramp', tagB: 'land-ramp',
    modifiers: { power: 2, salt: 0, fear: 1, airtime: 0 },
    interactionType: 'synergy',
    description: 'Heavy land ramp accelerates the game significantly',
  },
  {
    tagA: 'mana-rock', tagB: 'mana-rock',
    modifiers: { power: 2, salt: 0, fear: 0, airtime: 0 },
    interactionType: 'synergy',
    description: 'Artifact ramp density increases speed and consistency',
  },
  {
    tagA: 'cost-reducer', tagB: 'card-draw',
    modifiers: { power: 2, salt: 0, fear: 0, airtime: 1 },
    interactionType: 'synergy',
    description: 'Cheaper spells + draw = more spells per turn',
  },

  // === Card draw synergies ===
  {
    tagA: 'wheel', tagB: 'forced-discard',
    modifiers: { power: 2, salt: 3, fear: 1, airtime: 1 },
    interactionType: 'synergy',
    description: 'Wheels as discard engines generate salt',
  },
  {
    tagA: 'wheel', tagB: 'death-trigger',
    modifiers: { power: 2, salt: 1, fear: 1, airtime: 1 },
    interactionType: 'synergy',
    description: 'Wheel effects can trigger mass discard synergies',
  },

  // === Counterspell density ===
  {
    tagA: 'counterspell-hard', tagB: 'counterspell-hard',
    modifiers: { power: 1, salt: 3, fear: 0, airtime: 0 },
    interactionType: 'synergy',
    description: 'Heavy counter density is deeply frustrating to play against',
  },
  {
    tagA: 'counterspell-conditional', tagB: 'counterspell-conditional',
    modifiers: { power: 0, salt: 2, fear: 0, airtime: 0 },
    interactionType: 'synergy',
    description: 'Multiple conditional counters add up to denial',
  },
  {
    tagA: 'counterspell-free', tagB: 'counterspell-hard',
    modifiers: { power: 2, salt: 3, fear: 0, airtime: 0 },
    interactionType: 'synergy',
    description: 'Free counters + hard counters = always holding up interaction',
  },

  // === Board wipe synergies ===
  {
    tagA: 'board-wipe', tagB: 'recursive-creature',
    modifiers: { power: 2, salt: 1, fear: 1, airtime: 1 },
    interactionType: 'synergy',
    description: 'Wipe then rebuild with recursive creatures',
  },
  {
    tagA: 'board-wipe', tagB: 'indestructible-grant',
    modifiers: { power: 2, salt: 2, fear: 2, airtime: 0 },
    interactionType: 'synergy',
    description: 'One-sided board wipe via indestructible',
  },
  {
    tagA: 'board-wipe-asymmetric', tagB: 'token-generator',
    modifiers: { power: 3, salt: 2, fear: 2, airtime: 0 },
    interactionType: 'synergy',
    description: 'Asymmetric wipe + rebuild with tokens',
  },

  // === Anti-synergies ===
  {
    tagA: 'board-wipe', tagB: 'token-generator',
    modifiers: { power: -1, salt: 0, fear: -1, airtime: 0 },
    interactionType: 'anti-synergy',
    description: 'Board wipes destroy your own tokens',
  },
  {
    tagA: 'graveyard-hate', tagB: 'reanimation',
    modifiers: { power: -1, salt: 0, fear: 0, airtime: 0 },
    interactionType: 'anti-synergy',
    description: 'Graveyard hate conflicts with your own reanimation strategy',
  },

  // === Complexity/Airtime heavy ===
  {
    tagA: 'trigger-heavy', tagB: 'trigger-heavy',
    modifiers: { power: 1, salt: 0, fear: 0, airtime: 3 },
    interactionType: 'synergy',
    description: 'Multiple trigger-heavy cards compound game complexity',
  },
  {
    tagA: 'counter-manipulation', tagB: 'counter-manipulation',
    modifiers: { power: 1, salt: 0, fear: 0, airtime: 2 },
    interactionType: 'synergy',
    description: 'Lots of counter tracking slows gameplay',
  },
  {
    tagA: 'top-of-library', tagB: 'tutor-any',
    modifiers: { power: 2, salt: 1, fear: 0, airtime: 2 },
    interactionType: 'synergy',
    description: 'Library manipulation + tutors = lots of searching and shuffling',
  },
];
