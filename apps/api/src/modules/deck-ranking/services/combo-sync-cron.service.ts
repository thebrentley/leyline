import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from '../../../entities/app-config.entity';
import { ComboEntry } from '../../../entities/combo-entry.entity';

const PAGE_SIZE = 100;
const PAGES_PER_RUN = 50; // 50 pages × 100 = 5000 combos per run
const DELAY_BETWEEN_PAGES_MS = 500;

@Injectable()
export class ComboSyncCronService {
  private readonly logger = new Logger(ComboSyncCronService.name);
  private running = false;

  constructor(
    @InjectRepository(AppConfig) private configRepo: Repository<AppConfig>,
    @InjectRepository(ComboEntry) private comboRepo: Repository<ComboEntry>,
  ) {}

  @Cron('0 */10 * * * *') // every 10 minutes
  async handleCron() {
    if (this.running) {
      this.logger.warn('Combo sync already running, skipping');
      return;
    }

    const enabled = await this.getConfig('combo_sync_enabled');
    if (enabled !== 'true') return;

    this.running = true;
    try {
      await this.syncBatch();
    } catch (err) {
      this.logger.error(`Combo sync cron failed: ${err.message}`);
    } finally {
      this.running = false;
    }
  }

  private async syncBatch(): Promise<void> {
    let offset = parseInt(
      (await this.getConfig('combo_sync_offset')) || '0',
      10,
    );

    let totalProcessed = 0;

    for (let page = 0; page < PAGES_PER_RUN; page++) {
      const url = `https://backend.commanderspellbook.com/variants/?limit=${PAGE_SIZE}&offset=${offset}`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        this.logger.error(
          `Spellbook API returned ${response.status} at offset ${offset}`,
        );
        break;
      }

      const data = (await response.json()) as any;
      const variants: any[] = data.results || [];

      if (variants.length === 0) {
        // Reached the end — wrap around to the beginning
        this.logger.log('Reached end of Spellbook data, resetting to offset 0');
        await this.setConfig('combo_sync_offset', '0');
        return;
      }

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

      if (entriesToSave.length > 0) {
        await this.comboRepo
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
      }

      totalProcessed += variants.length;
      offset += PAGE_SIZE;

      // Save progress after each page
      await this.setConfig('combo_sync_offset', String(offset));

      if (page < PAGES_PER_RUN - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS));
      }
    }

    this.logger.log(
      `Combo sync batch done: ${totalProcessed} variants processed, next offset: ${offset}`,
    );
  }

  private async getConfig(key: string): Promise<string | null> {
    const row = await this.configRepo.findOne({ where: { key } });
    return row?.value ?? null;
  }

  private async setConfig(key: string, value: string): Promise<void> {
    await this.configRepo.upsert({ key, value }, ['key']);
  }
}
