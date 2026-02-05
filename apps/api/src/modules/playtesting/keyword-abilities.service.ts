import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type {
  FullPlaytestGameState,
  ExtendedGameCard,
  PlayerState,
  PlaytestEvent,
  StackItem,
  StackTarget,
  PlayerId,
} from '@decktutor/shared';

// =====================
// Keyword Handler Interface
// =====================

export interface DamageModification {
  amount: number;
  prevented: boolean;
  redirectTo?: string;
}

export interface KeywordHandler {
  /** Called to check if this keyword affects blocking legality */
  canBeBlockedBy?(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
    state: FullPlaytestGameState,
  ): boolean;

  /** Called to check if this creature can block */
  canBlock?(
    blocker: ExtendedGameCard,
    attacker: ExtendedGameCard,
    state: FullPlaytestGameState,
  ): boolean;

  /** Called to check if creature can attack */
  canAttack?(creature: ExtendedGameCard, state: FullPlaytestGameState): boolean;

  /** Called during damage calculation */
  modifyDamage?(
    damage: number,
    source: ExtendedGameCard,
    target: ExtendedGameCard | PlayerState,
    state: FullPlaytestGameState,
  ): DamageModification;

  /** Called when damage is dealt */
  onDamageDealt?(
    source: ExtendedGameCard,
    target: ExtendedGameCard | PlayerState,
    amount: number,
    state: FullPlaytestGameState,
  ): PlaytestEvent[];

  /** Called to check if creature taps when attacking */
  tapsWhenAttacking?(creature: ExtendedGameCard): boolean;

  /** Called to check targeting legality */
  canBeTargetedBy?(
    permanent: ExtendedGameCard,
    source: ExtendedGameCard | null,
    controller: PlayerId,
    state: FullPlaytestGameState,
  ): boolean;

  /** Called to check if can be destroyed */
  canBeDestroyed?(permanent: ExtendedGameCard, source: string): boolean;

  /** Called to check if this creature has summoning sickness immunity */
  hasSummoningSicknessImmunity?(creature: ExtendedGameCard): boolean;

  /** Called to get effective power modifier */
  getPowerModifier?(creature: ExtendedGameCard, state: FullPlaytestGameState): number;

  /** Called to get effective toughness modifier */
  getToughnessModifier?(creature: ExtendedGameCard, state: FullPlaytestGameState): number;

  /** Called to check minimum blockers required */
  getMinimumBlockers?(attacker: ExtendedGameCard, state: FullPlaytestGameState): number;
}

// =====================
// Keyword Handler Implementations
// =====================

class FlyingHandler implements KeywordHandler {
  canBeBlockedBy(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
  ): boolean {
    // Flying creatures can only be blocked by creatures with flying or reach
    return (
      blocker.keywords.includes('flying') || blocker.keywords.includes('reach')
    );
  }
}

class ReachHandler implements KeywordHandler {
  canBlock(
    blocker: ExtendedGameCard,
    attacker: ExtendedGameCard,
  ): boolean {
    // Reach allows blocking flyers
    return true;
  }
}

class FirstStrikeHandler implements KeywordHandler {
  // First strike is handled in combat damage calculation
}

class DoubleStrikeHandler implements KeywordHandler {
  // Double strike is handled in combat damage calculation
}

class DeathtouchHandler implements KeywordHandler {
  onDamageDealt(
    source: ExtendedGameCard,
    target: ExtendedGameCard | PlayerState,
    amount: number,
  ): PlaytestEvent[] {
    // Deathtouch is handled in combat damage processing
    return [];
  }
}

class LifelinkHandler implements KeywordHandler {
  onDamageDealt(
    source: ExtendedGameCard,
    target: ExtendedGameCard | PlayerState,
    amount: number,
  ): PlaytestEvent[] {
    // Lifelink is handled in combat damage processing
    return [];
  }
}

class TrampleHandler implements KeywordHandler {
  // Trample is handled in combat damage calculation
}

class VigilanceHandler implements KeywordHandler {
  tapsWhenAttacking(): boolean {
    return false;
  }
}

class MenaceHandler implements KeywordHandler {
  getMinimumBlockers(): number {
    return 2;
  }

  canBeBlockedBy(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
    state: FullPlaytestGameState,
  ): boolean {
    // Menace requires at least 2 blockers - this is checked at block validation
    return true;
  }
}

class HasteHandler implements KeywordHandler {
  hasSummoningSicknessImmunity(): boolean {
    return true;
  }
}

class DefenderHandler implements KeywordHandler {
  canAttack(): boolean {
    return false;
  }
}

class HexproofHandler implements KeywordHandler {
  canBeTargetedBy(
    permanent: ExtendedGameCard,
    source: ExtendedGameCard | null,
    controller: PlayerId,
  ): boolean {
    // Can't be targeted by opponents
    return controller === permanent.controller;
  }
}

class ShroudHandler implements KeywordHandler {
  canBeTargetedBy(): boolean {
    // Can't be targeted by anyone
    return false;
  }
}

class IndestructibleHandler implements KeywordHandler {
  canBeDestroyed(): boolean {
    return false;
  }
}

class ProtectionHandler implements KeywordHandler {
  // Protection is complex - handled separately with quality checks
  canBeBlockedBy(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
  ): boolean {
    // Check if blocker has a quality that attacker has protection from
    const protections = attacker.keywords.filter((k) =>
      k.startsWith('protection from'),
    );

    for (const protection of protections) {
      const quality = protection.replace('protection from ', '').toLowerCase();

      // Check color protection
      if (
        ['white', 'blue', 'black', 'red', 'green'].includes(quality) &&
        this.hasColor(blocker, quality)
      ) {
        return false;
      }

      // Check type protection
      if (blocker.typeLine?.toLowerCase().includes(quality)) {
        return false;
      }
    }

    return true;
  }

  canBeTargetedBy(
    permanent: ExtendedGameCard,
    source: ExtendedGameCard | null,
  ): boolean {
    if (!source) return true;

    const protections = permanent.keywords.filter((k) =>
      k.startsWith('protection from'),
    );

    for (const protection of protections) {
      const quality = protection.replace('protection from ', '').toLowerCase();

      if (
        ['white', 'blue', 'black', 'red', 'green'].includes(quality) &&
        this.hasColor(source, quality)
      ) {
        return false;
      }

      if (source.typeLine?.toLowerCase().includes(quality)) {
        return false;
      }
    }

    return true;
  }

  private hasColor(card: ExtendedGameCard, color: string): boolean {
    const colorMap: Record<string, string> = {
      white: 'W',
      blue: 'U',
      black: 'B',
      red: 'R',
      green: 'G',
    };
    return card.colors.includes(colorMap[color] || '');
  }
}

class WardHandler implements KeywordHandler {
  // Ward requires additional cost to target - this would trigger on targeting
  canBeTargetedBy(
    permanent: ExtendedGameCard,
    source: ExtendedGameCard | null,
    controller: PlayerId,
  ): boolean {
    // Ward doesn't prevent targeting, it requires payment
    // This would be handled by requiring the targeting player to pay the ward cost
    return true;
  }
}

class ShadowHandler implements KeywordHandler {
  canBeBlockedBy(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
  ): boolean {
    return blocker.keywords.includes('shadow');
  }

  canBlock(
    blocker: ExtendedGameCard,
    attacker: ExtendedGameCard,
  ): boolean {
    return attacker.keywords.includes('shadow');
  }
}

class HorsemanshipHandler implements KeywordHandler {
  canBeBlockedBy(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
  ): boolean {
    return blocker.keywords.includes('horsemanship');
  }
}

class SkulkHandler implements KeywordHandler {
  canBeBlockedBy(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
  ): boolean {
    const attackerPower = parseInt(attacker.power || '0', 10);
    const blockerPower = parseInt(blocker.power || '0', 10);
    return blockerPower <= attackerPower;
  }
}

class FearHandler implements KeywordHandler {
  canBeBlockedBy(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
  ): boolean {
    return (
      blocker.typeLine?.includes('Artifact') ||
      blocker.colors.includes('B')
    );
  }
}

class IntimidateHandler implements KeywordHandler {
  canBeBlockedBy(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
  ): boolean {
    // Can only be blocked by artifact creatures or creatures that share a color
    if (blocker.typeLine?.includes('Artifact')) return true;
    return attacker.colors.some((c) => blocker.colors.includes(c));
  }
}

class InfectHandler implements KeywordHandler {
  modifyDamage(
    damage: number,
    source: ExtendedGameCard,
    target: ExtendedGameCard | PlayerState,
  ): DamageModification {
    // Infect causes -1/-1 counters instead of damage to creatures
    // And poison counters instead of damage to players
    // This is handled in combat damage processing
    return { amount: damage, prevented: false };
  }
}

class WitherHandler implements KeywordHandler {
  modifyDamage(
    damage: number,
    source: ExtendedGameCard,
    target: ExtendedGameCard | PlayerState,
  ): DamageModification {
    // Wither causes -1/-1 counters instead of damage to creatures
    return { amount: damage, prevented: false };
  }
}

class ToxicHandler implements KeywordHandler {
  onDamageDealt(
    source: ExtendedGameCard,
    target: ExtendedGameCard | PlayerState,
    amount: number,
    state: FullPlaytestGameState,
  ): PlaytestEvent[] {
    // Toxic N gives N poison counters when dealing combat damage to a player
    // This is handled in combat damage processing
    return [];
  }
}

class PoisonousHandler implements KeywordHandler {
  onDamageDealt(
    source: ExtendedGameCard,
    target: ExtendedGameCard | PlayerState,
    amount: number,
    state: FullPlaytestGameState,
  ): PlaytestEvent[] {
    // Poisonous N gives N poison counters when dealing combat damage to a player
    return [];
  }
}

class FlashHandler implements KeywordHandler {
  // Flash allows casting at instant speed - handled in available actions
}

class UnblockableHandler implements KeywordHandler {
  canBeBlockedBy(): boolean {
    return false;
  }
}

// =====================
// Keyword Abilities Service
// =====================

@Injectable()
export class KeywordAbilitiesService {
  private keywordHandlers: Map<string, KeywordHandler> = new Map();

  constructor() {
    this.registerAllKeywords();
  }

  private registerAllKeywords(): void {
    // Combat keywords
    this.register('flying', new FlyingHandler());
    this.register('first strike', new FirstStrikeHandler());
    this.register('double strike', new DoubleStrikeHandler());
    this.register('deathtouch', new DeathtouchHandler());
    this.register('lifelink', new LifelinkHandler());
    this.register('trample', new TrampleHandler());
    this.register('vigilance', new VigilanceHandler());
    this.register('menace', new MenaceHandler());
    this.register('reach', new ReachHandler());
    this.register('haste', new HasteHandler());
    this.register('defender', new DefenderHandler());

    // Protection keywords
    this.register('hexproof', new HexproofHandler());
    this.register('shroud', new ShroudHandler());
    this.register('indestructible', new IndestructibleHandler());
    this.register('protection', new ProtectionHandler());
    this.register('ward', new WardHandler());

    // Evasion keywords
    this.register('shadow', new ShadowHandler());
    this.register('horsemanship', new HorsemanshipHandler());
    this.register('skulk', new SkulkHandler());
    this.register('fear', new FearHandler());
    this.register('intimidate', new IntimidateHandler());

    // Damage modification
    this.register('infect', new InfectHandler());
    this.register('wither', new WitherHandler());
    this.register('toxic', new ToxicHandler());
    this.register('poisonous', new PoisonousHandler());

    // Timing
    this.register('flash', new FlashHandler());

    // Unblockable
    this.register("can't be blocked", new UnblockableHandler());
  }

  private register(keyword: string, handler: KeywordHandler): void {
    this.keywordHandlers.set(keyword.toLowerCase(), handler);
  }

  // =====================
  // Keyword Parsing
  // =====================

  /**
   * Parse keywords from a card's oracle text
   */
  parseKeywords(oracleText: string | null, typeLine: string | null): string[] {
    const keywords: string[] = [];
    if (!oracleText) return keywords;

    const text = oracleText.toLowerCase();

    // Evergreen keywords (check for exact matches at start of text or after newlines)
    const evergreenKeywords = [
      'flying',
      'first strike',
      'double strike',
      'deathtouch',
      'lifelink',
      'trample',
      'vigilance',
      'menace',
      'reach',
      'haste',
      'defender',
      'hexproof',
      'indestructible',
      'flash',
      'prowess',
      'ward',
    ];

    for (const keyword of evergreenKeywords) {
      // Check if keyword appears at start of a line or the whole text
      const regex = new RegExp(`(^|\\n)${keyword}(\\s|,|$)`, 'i');
      if (regex.test(text)) {
        keywords.push(keyword);
      }
    }

    // Protection (with quality)
    const protectionMatches = text.match(/protection from \w+/g);
    if (protectionMatches) {
      keywords.push(...protectionMatches);
    }

    // Ward (with cost)
    const wardMatch = text.match(/ward \{[^}]+\}/);
    if (wardMatch) {
      keywords.push('ward');
    }

    // Toxic (with number)
    const toxicMatch = text.match(/toxic \d+/);
    if (toxicMatch) {
      keywords.push('toxic');
    }

    // Check for unblockable text
    if (text.includes("can't be blocked")) {
      keywords.push("can't be blocked");
    }

    // Shadow
    if (text.includes('shadow')) {
      keywords.push('shadow');
    }

    // Fear
    if (/^fear\b/m.test(text)) {
      keywords.push('fear');
    }

    // Intimidate
    if (/^intimidate\b/m.test(text)) {
      keywords.push('intimidate');
    }

    // Infect
    if (/^infect\b/m.test(text)) {
      keywords.push('infect');
    }

    // Wither
    if (/^wither\b/m.test(text)) {
      keywords.push('wither');
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  // =====================
  // Keyword Checks
  // =====================

  /**
   * Check if a card has a specific keyword
   */
  hasKeyword(card: ExtendedGameCard, keyword: string): boolean {
    return card.keywords.some(
      (k) => k.toLowerCase() === keyword.toLowerCase() || k.toLowerCase().startsWith(keyword.toLowerCase()),
    );
  }

  /**
   * Check if an attacker can be blocked by a specific blocker
   */
  canBeBlockedBy(
    attacker: ExtendedGameCard,
    blocker: ExtendedGameCard,
    state: FullPlaytestGameState,
  ): boolean {
    // Check each keyword on the attacker
    for (const keyword of attacker.keywords) {
      const handler = this.keywordHandlers.get(keyword.toLowerCase());
      if (handler?.canBeBlockedBy) {
        if (!handler.canBeBlockedBy(attacker, blocker, state)) {
          return false;
        }
      }

      // Handle protection keywords separately
      if (keyword.startsWith('protection from')) {
        const protectionHandler = this.keywordHandlers.get('protection');
        if (protectionHandler?.canBeBlockedBy) {
          if (!protectionHandler.canBeBlockedBy(attacker, blocker, state)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Check if a creature can block a specific attacker
   */
  canBlock(
    blocker: ExtendedGameCard,
    attacker: ExtendedGameCard,
    state: FullPlaytestGameState,
  ): boolean {
    for (const keyword of blocker.keywords) {
      const handler = this.keywordHandlers.get(keyword.toLowerCase());
      if (handler?.canBlock !== undefined) {
        if (!handler.canBlock(blocker, attacker, state)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if a creature can attack
   */
  canAttack(creature: ExtendedGameCard, state: FullPlaytestGameState): boolean {
    for (const keyword of creature.keywords) {
      const handler = this.keywordHandlers.get(keyword.toLowerCase());
      if (handler?.canAttack !== undefined) {
        if (!handler.canAttack(creature, state)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if a creature taps when attacking
   */
  tapsWhenAttacking(creature: ExtendedGameCard): boolean {
    for (const keyword of creature.keywords) {
      const handler = this.keywordHandlers.get(keyword.toLowerCase());
      if (handler?.tapsWhenAttacking !== undefined) {
        if (!handler.tapsWhenAttacking(creature)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if a permanent can be targeted
   */
  canBeTargetedBy(
    permanent: ExtendedGameCard,
    source: ExtendedGameCard | null,
    controller: PlayerId,
    state: FullPlaytestGameState,
  ): boolean {
    for (const keyword of permanent.keywords) {
      const handler = this.keywordHandlers.get(keyword.toLowerCase());
      if (handler?.canBeTargetedBy !== undefined) {
        if (!handler.canBeTargetedBy(permanent, source, controller, state)) {
          return false;
        }
      }

      // Handle protection keywords
      if (keyword.startsWith('protection from')) {
        const protectionHandler = this.keywordHandlers.get('protection');
        if (protectionHandler?.canBeTargetedBy) {
          if (!protectionHandler.canBeTargetedBy(permanent, source, controller, state)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Check if a permanent can be destroyed
   */
  canBeDestroyed(permanent: ExtendedGameCard, source: string): boolean {
    for (const keyword of permanent.keywords) {
      const handler = this.keywordHandlers.get(keyword.toLowerCase());
      if (handler?.canBeDestroyed !== undefined) {
        if (!handler.canBeDestroyed(permanent, source)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if a creature has summoning sickness immunity (haste)
   */
  hasSummoningSicknessImmunity(creature: ExtendedGameCard): boolean {
    for (const keyword of creature.keywords) {
      const handler = this.keywordHandlers.get(keyword.toLowerCase());
      if (handler?.hasSummoningSicknessImmunity) {
        if (handler.hasSummoningSicknessImmunity(creature)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get minimum blockers required for an attacker (menace)
   */
  getMinimumBlockers(attacker: ExtendedGameCard, state: FullPlaytestGameState): number {
    let minBlockers = 1;

    for (const keyword of attacker.keywords) {
      const handler = this.keywordHandlers.get(keyword.toLowerCase());
      if (handler?.getMinimumBlockers) {
        const required = handler.getMinimumBlockers(attacker, state);
        minBlockers = Math.max(minBlockers, required);
      }
    }

    return minBlockers;
  }

  /**
   * Check if attacker has first strike (or double strike)
   */
  hasFirstStrike(creature: ExtendedGameCard): boolean {
    return (
      creature.keywords.includes('first strike') ||
      creature.keywords.includes('double strike')
    );
  }

  /**
   * Check if attacker has only regular strike damage (not just first strike)
   */
  hasRegularStrikeDamage(creature: ExtendedGameCard): boolean {
    return (
      !creature.keywords.includes('first strike') ||
      creature.keywords.includes('double strike')
    );
  }

  // =====================
  // Triggered Abilities
  // =====================

  /**
   * Check for triggered abilities based on game state changes
   * Returns stack items to add for triggered abilities
   */
  checkTriggeredAbilities(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    // Triggered abilities would be detected by parsing oracle text
    // and checking for patterns like:
    // - "When ~ enters the battlefield"
    // - "Whenever ~ attacks"
    // - "When ~ dies"
    // - "At the beginning of your upkeep"

    // This is a placeholder - full implementation would parse oracle text
    // and track trigger conditions

    return events;
  }

  /**
   * Check for ETB triggers
   * Detects "When ~ enters the battlefield" triggers and parses their effects
   */
  checkETBTriggers(
    state: FullPlaytestGameState,
    cardId: string,
  ): StackItem[] {
    const triggers: StackItem[] = [];
    const card = state.cards[cardId];

    if (!card || !card.oracleText) return triggers;

    const text = card.oracleText.toLowerCase();

    // Check for "When ~ enters the battlefield" or "When ~ enters" patterns
    const etbPattern = /when .+ enters(?:\s+the\s+battlefield)?/i;
    if (etbPattern.test(text)) {
      // Extract the full trigger text including effect
      const effectMatch = text.match(/when .+ enters(?:\s+the\s+battlefield)?,?\s*(.+?)(?:\.|$)/i);
      if (effectMatch) {
        const fullTriggerText = effectMatch[0];
        const effectText = effectMatch[1];

        // Parse the effect to determine if we need targets
        const targets = this.parseETBTargets(effectText, state, card.controller);

        triggers.push({
          id: uuidv4(),
          type: 'ability',
          sourceCardId: cardId,
          controller: card.controller,
          targets,
          abilityText: fullTriggerText,
          abilityType: 'triggered',
        });
      }
    }

    return triggers;
  }

  /**
   * Parse ETB effect text to determine required targets
   * For effects like "deal damage to target opponent" or "target player gains life"
   */
  private parseETBTargets(
    effectText: string,
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): StackTarget[] {
    const targets: StackTarget[] = [];

    // Check for "target opponent" or "target player"
    if (effectText.includes('target opponent')) {
      // Auto-target the opponent
      const opponent = controller === 'player' ? 'opponent' : 'player';
      targets.push({ type: 'player', id: opponent });
    } else if (effectText.includes('target player')) {
      // For simplicity, auto-target the opponent (could be enhanced for player choice)
      const opponent = controller === 'player' ? 'opponent' : 'player';
      targets.push({ type: 'player', id: opponent });
    }

    return targets;
  }

  /**
   * Check for attack triggers
   */
  checkAttackTriggers(
    state: FullPlaytestGameState,
    attackerIds: string[],
  ): StackItem[] {
    const triggers: StackItem[] = [];

    for (const cardId of attackerIds) {
      const card = state.cards[cardId];
      if (!card || !card.oracleText) continue;

      const text = card.oracleText.toLowerCase();

      // Check for "Whenever ~ attacks" patterns
      const attackPattern = /whenever .+ attacks/;
      if (attackPattern.test(text)) {
        const effectMatch = text.match(/whenever .+ attacks,?\s*(.+?)(?:\.|$)/);
        if (effectMatch) {
          triggers.push({
            id: uuidv4(),
            type: 'ability',
            sourceCardId: cardId,
            controller: card.controller,
            targets: [],
            abilityText: effectMatch[0],
            abilityType: 'triggered',
          });
        }
      }
    }

    return triggers;
  }

  /**
   * Check for dies triggers
   */
  checkDiesTriggers(
    state: FullPlaytestGameState,
    cardId: string,
  ): StackItem[] {
    const triggers: StackItem[] = [];
    const card = state.cards[cardId];

    if (!card || !card.oracleText) return triggers;

    const text = card.oracleText.toLowerCase();

    // Check for "When ~ dies" patterns
    const diesPattern = /when .+ dies/;
    if (diesPattern.test(text)) {
      const effectMatch = text.match(/when .+ dies,?\s*(.+?)(?:\.|$)/);
      if (effectMatch) {
        triggers.push({
          id: uuidv4(),
          type: 'ability',
          sourceCardId: cardId,
          controller: card.controller,
          targets: [],
          abilityText: effectMatch[0],
          abilityType: 'triggered',
        });
      }
    }

    return triggers;
  }

  /**
   * Check for upkeep triggers
   */
  checkUpkeepTriggers(state: FullPlaytestGameState): StackItem[] {
    const triggers: StackItem[] = [];
    const activePlayer = state.activePlayer;

    for (const card of Object.values(state.cards)) {
      if (card.controller !== activePlayer || card.zone !== 'battlefield') continue;
      if (!card.oracleText) continue;

      const text = card.oracleText.toLowerCase();

      // Check for "At the beginning of your upkeep" patterns
      const upkeepPattern = /at the beginning of your upkeep/;
      if (upkeepPattern.test(text)) {
        const effectMatch = text.match(/at the beginning of your upkeep,?\s*(.+?)(?:\.|$)/);
        if (effectMatch) {
          triggers.push({
            id: uuidv4(),
            type: 'ability',
            sourceCardId: card.instanceId,
            controller: card.controller,
            targets: [],
            abilityText: effectMatch[0],
            abilityType: 'triggered',
          });
        }
      }
    }

    return triggers;
  }

  /**
   * Check for end step triggers
   */
  checkEndStepTriggers(state: FullPlaytestGameState): StackItem[] {
    const triggers: StackItem[] = [];
    const activePlayer = state.activePlayer;

    for (const card of Object.values(state.cards)) {
      if (card.controller !== activePlayer || card.zone !== 'battlefield') continue;
      if (!card.oracleText) continue;

      const text = card.oracleText.toLowerCase();

      // Check for "At the beginning of your end step" patterns
      const endStepPattern = /at the beginning of your end step/;
      if (endStepPattern.test(text)) {
        const effectMatch = text.match(/at the beginning of your end step,?\s*(.+?)(?:\.|$)/);
        if (effectMatch) {
          triggers.push({
            id: uuidv4(),
            type: 'ability',
            sourceCardId: card.instanceId,
            controller: card.controller,
            targets: [],
            abilityText: effectMatch[0],
            abilityType: 'triggered',
          });
        }
      }
    }

    return triggers;
  }
}
