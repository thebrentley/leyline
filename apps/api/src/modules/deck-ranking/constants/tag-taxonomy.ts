/**
 * Mechanical tag taxonomy for MTG cards.
 * Tags describe what a card DOES mechanically, not what it IS.
 * Used by the LLM tagging pipeline and interaction rule engine.
 */

export const TAG_TAXONOMY = {
  // === Removal ===
  'targeted-removal': 'Removes a specific permanent (destroy, exile, bounce)',
  'board-wipe': 'Destroys/exiles all or most creatures/permanents',
  'board-wipe-asymmetric': 'Board wipe that spares your own permanents',
  'artifact-removal': 'Specifically removes artifacts',
  'enchantment-removal': 'Specifically removes enchantments',
  'creature-removal': 'Specifically removes creatures',
  'planeswalker-removal': 'Specifically removes planeswalkers',
  'exile-removal': 'Removes by exiling (no graveyard trigger)',
  'land-destruction': 'Destroys lands (single target or mass)',

  // === Counterspells ===
  'counterspell-hard': 'Unconditional counterspell (Counterspell, Force of Will)',
  'counterspell-conditional': 'Conditional counter (Negate, Spell Pierce)',
  'counterspell-free': 'Can be cast for free (Force of Will, Fierce Guardianship)',

  // === Ramp & Mana ===
  'mana-rock': 'Artifact that produces mana',
  'mana-dork': 'Creature that produces mana',
  'land-ramp': 'Puts extra lands onto the battlefield',
  'cost-reducer': 'Reduces spell costs',
  'ritual': 'One-shot mana burst (Dark Ritual, Cabal Ritual)',
  'mana-doubler': 'Doubles mana production (Nyxbloom Ancient, Mana Reflection)',

  // === Card Advantage ===
  'card-draw': 'Draws cards (repeatable or significant one-shot)',
  'cantrip': 'Draws exactly one card as minor bonus',
  'tutor-any': 'Searches library for any card',
  'tutor-creature': 'Searches library for a creature',
  'tutor-artifact': 'Searches library for an artifact',
  'tutor-land': 'Searches library for a land',
  'tutor-instant-sorcery': 'Searches library for an instant or sorcery',
  'impulse-draw': 'Exile-and-cast card advantage',
  'wheel': 'Everyone discards hand and draws new cards',

  // === Token Production ===
  'token-generator': 'Creates creature tokens',
  'token-on-death': 'Creates tokens when something dies',
  'token-on-etb': 'Creates tokens on entering the battlefield',
  'token-on-attack': 'Creates tokens when attacking',
  'token-mass': 'Creates many tokens at once',

  // === Sacrifice & Aristocrats ===
  'sacrifice-outlet-free': 'Can sacrifice permanents for free',
  'sacrifice-outlet-paid': 'Can sacrifice permanents for a cost',
  'death-trigger': 'Triggers when a creature dies',
  'blood-artist-effect': 'Drains life when creatures die',
  'recursive-creature': 'Can return itself from graveyard to battlefield',

  // === Combat ===
  'evasion-grant': 'Grants flying, trample, unblockable, etc.',
  'anthem': 'Buffs all your creatures (+1/+1 or similar)',
  'extra-combat': 'Grants additional combat phases',
  'double-strike-grant': 'Grants double strike',
  'voltron-enabler': 'Equipment/Aura that significantly buffs one creature',
  'combat-trick': 'Instant-speed combat modifier',

  // === Stax & Tax ===
  'stax-symmetrical': 'Restricts all players equally (Winter Orb, Static Orb)',
  'stax-asymmetrical': 'Restricts opponents more than you (Drannith Magistrate)',
  'tax-effect': 'Makes opponents pay more (Rhystic Study, Smothering Tithe)',
  'resource-denial': 'Denies resources beyond direct destruction',

  // === Graveyard ===
  'graveyard-hate': 'Exiles or prevents graveyard use',
  'self-mill': 'Puts cards from your library into your graveyard',
  'reanimation': 'Returns creatures from graveyard to battlefield',
  'recursion-engine': 'Repeatedly returns cards from graveyard',

  // === Blink & ETB ===
  'etb-trigger': 'Has a significant enter-the-battlefield effect',
  'blink-enabler': 'Exiles and returns permanents (flicker)',
  'panharmonicon-effect': 'Doubles ETB triggers',

  // === Combo ===
  'infinite-combo-piece': 'Part of a known infinite combo',
  'storm-enabler': 'Enables or benefits from casting many spells',
  'untap-combo': 'Untaps permanents (enables combo loops)',
  'copy-effect': 'Copies spells or permanents',
  'mana-sink': 'Can use unlimited mana productively',

  // === Protection ===
  'hexproof-shroud': 'Grants hexproof or shroud',
  'indestructible-grant': 'Grants indestructible',
  'protection-grant': 'Grants protection from colors/types',
  'phase-out': 'Phases out permanents for protection',

  // === Extra Turns ===
  'extra-turn': 'Grants additional turns',

  // === Theft & Control ===
  'steal-permanent': 'Takes control of opponents permanents',
  'steal-spell': 'Takes control of spells on the stack',
  'mind-control': 'Ongoing control of opponent creature',
  'forced-sacrifice': 'Forces opponents to sacrifice',
  'forced-discard': 'Forces opponents to discard',

  // === Big Mana / Eldrazi ===
  'annihilator': 'Forces opponents to sacrifice permanents when attacking (Annihilator)',
  'big-mana-payoff': 'Expensive spell (6+ mana) that provides enormous impact when cast',
  'cast-trigger': 'Triggers significant effect when cast, not on ETB (Eldrazi titans, etc.)',

  // === Complexity/Airtime ===
  'trigger-heavy': 'Has multiple or frequent triggers',
  'counter-manipulation': 'Adds/removes/moves counters',
  'cascade-effect': 'Cascades or chains multiple spells',
  'top-of-library': 'Manipulates top of library (Sensei\'s Divining Top)',

  // === Passive/Low Impact ===
  'basic-land': 'A basic land',
  'utility-land': 'Land with a useful ability',
  'mana-fixer': 'Fixes mana colors without ramping',
  'vanilla-creature': 'Creature with no abilities',
} as const;

export type CardMechanicalTag = keyof typeof TAG_TAXONOMY;

export const ALL_TAGS = Object.keys(TAG_TAXONOMY) as CardMechanicalTag[];
