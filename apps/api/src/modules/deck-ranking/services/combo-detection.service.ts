import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComboEntry } from '../../../entities/combo-entry.entity';

export interface DetectedComboResult {
  entry: ComboEntry;
  presentCards: string[];
  missingCards: string[];
  completeness: number; // 0-1
}

export interface ComboScores {
  power: number;
  salt: number;
  fear: number;
  airtime: number;
  combos: DetectedComboResult[];
}

@Injectable()
export class ComboDetectionService {
  private readonly logger = new Logger(ComboDetectionService.name);

  constructor(
    @InjectRepository(ComboEntry) private comboRepo: Repository<ComboEntry>,
  ) {}

  /**
   * Sync combos from Commander Spellbook API.
   * https://backend.commanderspellbook.com/
   */
  async syncFromSpellbook(): Promise<{ added: number; updated: number }> {
    let added = 0;
    let updated = 0;
    const PAGE_SIZE = 100;

    try {
      let url: string | null =
        `https://backend.commanderspellbook.com/variants/?limit=${PAGE_SIZE}`;

      while (url) {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Spellbook API returned ${response.status}`);
        }

        const data = (await response.json()) as any;
        const variants: any[] = data.results || [];
        url = data.next || null;

        // Batch-collect entries to save in bulk
        const entriesToSave: Partial<ComboEntry>[] = [];

        for (const variant of variants) {
          try {
            const cardNames: string[] = (variant.uses || [])
              .map((u: any) => u.card?.name)
              .filter(Boolean);

            if (cardNames.length < 2) continue;

            const isGameWinning = (variant.produces || []).some(
              (p: any) =>
                p.feature?.name?.toLowerCase().includes('win') ||
                p.feature?.name?.toLowerCase().includes('infinite'),
            );

            const resultTags = (variant.produces || [])
              .map((p: any) => p.feature?.name)
              .filter(Boolean)
              .map((name: string) => name.toLowerCase().replace(/\s+/g, '-'));

            const colorIdentity = variant.identity
              ? variant.identity.split('')
              : [];

            const requiresCommander = (variant.uses || []).some(
              (u: any) => u.mustBeCommander === true,
            );

            entriesToSave.push({
              spellbookId: String(variant.id),
              cardNames,
              pieceCount: cardNames.length,
              isGameWinning,
              requiresCommander,
              colorIdentity,
              description: variant.description || null,
              resultTags,
              lastSyncedAt: new Date(),
            });
          } catch (err) {
            this.logger.warn(
              `Failed to process combo ${variant.id}: ${err.message}`,
            );
          }
        }

        // Upsert batch by spellbookId
        if (entriesToSave.length > 0) {
          const result = await this.comboRepo
            .createQueryBuilder()
            .insert()
            .into(ComboEntry)
            .values(entriesToSave)
            .orUpdate(
              [
                'card_names',
                'piece_count',
                'is_game_winning',
                'requires_commander',
                'color_identity',
                'description',
                'result_tags',
                'last_synced_at',
              ],
              ['spellbook_id'],
            )
            .execute();

          // Count new vs updated based on what was actually inserted
          const affected = result.identifiers.length;
          added += affected;
        }

        this.logger.log(
          `Spellbook sync progress: processed ${added} combos so far...`,
        );

        // Rate-limit: wait between pages to avoid getting blocked
        if (url) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } catch (err) {
      this.logger.error(`Spellbook sync failed: ${err.message}`);
      throw err;
    }

    this.logger.log(
      `Spellbook sync complete: ${added} combos synced`,
    );
    return { added, updated };
  }

  /**
   * Detect combos present in a deck.
   */
  async detectCombos(
    cardNames: string[],
    commanderNames: string[],
    tutorCount: number,
  ): Promise<ComboScores> {
    const cardNameSet = new Set(cardNames.map((n) => n.toLowerCase()));
    const commanderNameSet = new Set(commanderNames.map((n) => n.toLowerCase()));

    // Get all combos and check which ones are present in the deck
    const allCombos = await this.comboRepo.find();
    const detectedCombos: DetectedComboResult[] = [];

    for (const combo of allCombos) {
      const presentCards: string[] = [];
      const missingCards: string[] = [];

      for (const comboCard of combo.cardNames) {
        const lower = comboCard.toLowerCase();
        if (cardNameSet.has(lower) || commanderNameSet.has(lower)) {
          presentCards.push(comboCard);
        } else {
          missingCards.push(comboCard);
        }
      }

      // Skip if commander is required but not in command zone
      if (combo.requiresCommander) {
        const hasCommanderPiece = combo.cardNames.some((c) =>
          commanderNameSet.has(c.toLowerCase()),
        );
        if (!hasCommanderPiece) continue;
      }

      const completeness = presentCards.length / combo.pieceCount;

      // Only include combos that are at least 50% assembled or fully present
      if (completeness >= 0.5) {
        detectedCombos.push({
          entry: combo,
          presentCards,
          missingCards,
          completeness,
        });
      }
    }

    // Score the detected combos
    const scores = { power: 0, salt: 0, fear: 0, airtime: 0 };

    for (const detected of detectedCombos) {
      const combo = detected.entry;
      const isComplete = detected.completeness === 1;
      const tutorMultiplier = Math.min(1.0 + tutorCount * 0.1, 2.0);
      const piecePenalty = 1.0 - (1.0 / combo.pieceCount) * 0.3;

      if (isComplete) {
        // Full combo present
        const basePower = combo.isGameWinning ? 30 : 15;
        const baseSalt = combo.isGameWinning ? 20 : 5;
        const baseFear = combo.isGameWinning ? 15 : 5;
        const baseAirtime = combo.pieceCount >= 3 ? 15 : 5;

        scores.power += basePower * tutorMultiplier * piecePenalty;
        scores.salt += baseSalt * tutorMultiplier * piecePenalty;
        scores.fear += baseFear * tutorMultiplier * piecePenalty;
        scores.airtime += baseAirtime;
      } else {
        // Near-miss: only contributes to fear (the deck COULD combo)
        const nearMissFear = combo.isGameWinning ? 8 : 3;
        scores.fear += nearMissFear * detected.completeness;
      }
    }

    return { ...scores, combos: detectedCombos };
  }
}
