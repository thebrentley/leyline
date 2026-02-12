import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InteractionRule, AxisModifiers } from '../../../entities/interaction-rule.entity';
import { INTERACTION_RULES_SEED } from '../constants/interaction-rules-seed';

export interface TagInteractionResult {
  power: number;
  salt: number;
  fear: number;
  airtime: number;
  interactions: Array<{
    cardA: string;
    cardB: string;
    rule: string;
    modifiers: AxisModifiers;
  }>;
}

@Injectable()
export class InteractionRuleService implements OnModuleInit {
  private readonly logger = new Logger(InteractionRuleService.name);
  private rulesCache: InteractionRule[] | null = null;
  private tagIndex: Map<string, InteractionRule[]> = new Map();

  constructor(
    @InjectRepository(InteractionRule) private ruleRepo: Repository<InteractionRule>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedIfEmpty();
    await this.refreshCache();
  }

  async getActiveRules(): Promise<InteractionRule[]> {
    if (!this.rulesCache) {
      await this.refreshCache();
    }
    return this.rulesCache!;
  }

  async calculateTagInteractions(
    cardTags: Map<string, string[]>,
  ): Promise<TagInteractionResult> {
    if (!this.rulesCache) {
      await this.refreshCache();
    }

    const scores = { power: 0, salt: 0, fear: 0, airtime: 0 };
    const interactions: TagInteractionResult['interactions'] = [];
    const entries = Array.from(cardTags.entries());

    for (let i = 0; i < entries.length; i++) {
      const [cardA, tagsA] = entries[i];
      for (let j = i + 1; j < entries.length; j++) {
        const [cardB, tagsB] = entries[j];

        // Check each tag of cardA for matching rules with cardB's tags
        for (const tagA of tagsA) {
          const candidateRules = this.tagIndex.get(tagA) || [];
          for (const rule of candidateRules) {
            const otherTag = rule.tagA === tagA ? rule.tagB : rule.tagA;
            if (tagsB.includes(otherTag)) {
              scores.power += rule.modifiers.power;
              scores.salt += rule.modifiers.salt;
              scores.fear += rule.modifiers.fear;
              scores.airtime += rule.modifiers.airtime;
              interactions.push({
                cardA,
                cardB,
                rule: rule.description || `${rule.tagA} + ${rule.tagB}`,
                modifiers: rule.modifiers,
              });
            }
          }
        }
      }
    }

    return { ...scores, interactions };
  }

  private async refreshCache(): Promise<void> {
    this.rulesCache = await this.ruleRepo.find({ where: { isActive: true } });
    this.rebuildTagIndex();
    this.logger.log(`Loaded ${this.rulesCache.length} active interaction rules`);
  }

  private rebuildTagIndex(): void {
    this.tagIndex = new Map();
    for (const rule of this.rulesCache!) {
      if (!this.tagIndex.has(rule.tagA)) this.tagIndex.set(rule.tagA, []);
      this.tagIndex.get(rule.tagA)!.push(rule);
      // Also index by tagB for bidirectional lookup
      if (rule.tagA !== rule.tagB) {
        if (!this.tagIndex.has(rule.tagB)) this.tagIndex.set(rule.tagB, []);
        this.tagIndex.get(rule.tagB)!.push(rule);
      }
    }
  }

  private async seedIfEmpty(): Promise<void> {
    const count = await this.ruleRepo.count();
    if (count > 0) return;

    this.logger.log(`Seeding ${INTERACTION_RULES_SEED.length} interaction rules...`);
    for (const seed of INTERACTION_RULES_SEED) {
      await this.ruleRepo.upsert(
        {
          tagA: seed.tagA,
          tagB: seed.tagB,
          modifiers: seed.modifiers,
          interactionType: seed.interactionType,
          description: seed.description,
          isActive: true,
        },
        ['tagA', 'tagB'],
      );
    }
    this.logger.log('Interaction rules seeded');
  }
}
