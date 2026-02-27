import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardTag } from '../../../entities/card-tag.entity';
import { InteractionRule } from '../../../entities/interaction-rule.entity';
import {
  COMMANDER_SYNERGY_THRESHOLDS,
  COMMANDER_REPUTATION_THRESHOLD,
  COMMANDER_REPUTATION_MULTIPLIER,
} from '../constants/scoring-weights';

export interface CommanderModifiers {
  multipliers: { power: number; salt: number; fear: number; airtime: number };
  commanderSynergyCount: number;
  synergyRatio: number;
  archetype: string;
}

interface CommanderInfo {
  name: string;
  tags: string[];
  baseline: { power: number; salt: number; fear: number; airtime: number } | null;
}

@Injectable()
export class CommanderContextService {
  constructor(
    @InjectRepository(CardTag) private cardTagRepo: Repository<CardTag>,
    @InjectRepository(InteractionRule) private ruleRepo: Repository<InteractionRule>,
  ) {}

  async calculateCommanderModifiers(
    commanderNames: string[],
    deckCardTags: Map<string, string[]>,
    activeRules: InteractionRule[],
  ): Promise<CommanderModifiers> {
    if (commanderNames.length === 0) {
      return {
        multipliers: { power: 1, salt: 1, fear: 1, airtime: 1 },
        commanderSynergyCount: 0,
        synergyRatio: 0,
        archetype: 'unknown',
      };
    }

    // Get commander tags
    const commanderTags = await this.cardTagRepo
      .createQueryBuilder('ct')
      .where('ct.card_name IN (:...names)', { names: commanderNames })
      .getMany();

    const commanders: CommanderInfo[] = commanderTags.map((ct) => ({
      name: ct.cardName,
      tags: ct.tags,
      baseline: ct.powerBaseline,
    }));

    // Union all commander tags (for partners)
    const allCommanderTags = new Set<string>();
    for (const cmd of commanders) {
      for (const tag of cmd.tags) {
        allCommanderTags.add(tag);
      }
    }

    // Build rule lookup from commander tags
    const commanderTagsArr = Array.from(allCommanderTags);
    const ruleTagIndex = new Map<string, Set<string>>();
    for (const rule of activeRules) {
      if (commanderTagsArr.includes(rule.tagA)) {
        if (!ruleTagIndex.has(rule.tagA)) ruleTagIndex.set(rule.tagA, new Set());
        ruleTagIndex.get(rule.tagA)!.add(rule.tagB);
      }
      if (commanderTagsArr.includes(rule.tagB)) {
        if (!ruleTagIndex.has(rule.tagB)) ruleTagIndex.set(rule.tagB, new Set());
        ruleTagIndex.get(rule.tagB)!.add(rule.tagA);
      }
    }

    // Count how many deck cards synergize with the commander
    let synergyCount = 0;
    const totalCards = deckCardTags.size;

    for (const [, cardTags] of deckCardTags) {
      let synergizes = false;
      for (const tag of cardTags) {
        // Does this card's tag appear as a partner tag for any commander tag?
        for (const [, synTags] of ruleTagIndex) {
          if (synTags.has(tag)) {
            synergizes = true;
            break;
          }
        }
        if (synergizes) break;
      }
      if (synergizes) synergyCount++;
    }

    const synergyRatio = totalCards > 0 ? synergyCount / totalCards : 0;

    // Map synergy ratio to power multiplier
    let powerMultiplier = 1.0;
    for (const threshold of COMMANDER_SYNERGY_THRESHOLDS) {
      if (synergyRatio <= threshold.maxRatio) {
        powerMultiplier = threshold.multiplier;
        break;
      }
    }

    // Commander reputation boosts for salt and fear
    let saltMultiplier = 1.0;
    let fearMultiplier = 1.0;
    let airtimeMultiplier = 1.0;

    for (const cmd of commanders) {
      if (cmd.baseline) {
        if (cmd.baseline.salt >= COMMANDER_REPUTATION_THRESHOLD) {
          saltMultiplier = Math.max(saltMultiplier, COMMANDER_REPUTATION_MULTIPLIER);
        }
        if (cmd.baseline.fear >= COMMANDER_REPUTATION_THRESHOLD) {
          fearMultiplier = Math.max(fearMultiplier, COMMANDER_REPUTATION_MULTIPLIER);
        }
        if (cmd.baseline.airtime >= COMMANDER_REPUTATION_THRESHOLD) {
          airtimeMultiplier = Math.max(airtimeMultiplier, COMMANDER_REPUTATION_MULTIPLIER);
        }
      }
    }

    // Detect archetype from commander tags
    const archetype = this.detectArchetype(commanderTagsArr);

    return {
      multipliers: {
        power: powerMultiplier,
        salt: saltMultiplier,
        fear: fearMultiplier,
        airtime: airtimeMultiplier,
      },
      commanderSynergyCount: synergyCount,
      synergyRatio,
      archetype,
    };
  }

  private detectArchetype(tags: string[]): string {
    const tagSet = new Set(tags);

    if (tagSet.has('sacrifice-outlet-free') || tagSet.has('death-trigger') || tagSet.has('blood-artist-effect')) {
      return 'aristocrats';
    }
    if (tagSet.has('voltron-enabler') || tagSet.has('double-strike-grant') || tagSet.has('evasion-grant')) {
      return 'voltron';
    }
    if (tagSet.has('storm-enabler') || tagSet.has('cost-reducer')) {
      return 'spellslinger';
    }
    if (tagSet.has('token-generator') || tagSet.has('token-mass') || tagSet.has('anthem')) {
      return 'tokens';
    }
    if (tagSet.has('stax-symmetrical') || tagSet.has('stax-asymmetrical') || tagSet.has('tax-effect')) {
      return 'stax';
    }
    if (tagSet.has('blink-enabler') || tagSet.has('panharmonicon-effect')) {
      return 'blink';
    }
    if (tagSet.has('reanimation') || tagSet.has('self-mill') || tagSet.has('recursion-engine')) {
      return 'graveyard';
    }
    if (tagSet.has('card-draw') || tagSet.has('counterspell-hard')) {
      return 'control';
    }
    if (tagSet.has('land-ramp') || tagSet.has('mana-doubler')) {
      return 'ramp';
    }
    if (tagSet.has('annihilator') || tagSet.has('big-mana-payoff') || tagSet.has('cast-trigger')) {
      return 'eldrazi-ramp';
    }

    return 'midrange';
  }
}
