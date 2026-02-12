import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import * as crypto from 'crypto';
import { CardTag, BaselineScores } from '../../../entities/card-tag.entity';
import { CardTaggingJob } from '../../../entities/card-tagging-job.entity';
import { Card } from '../../../entities/card.entity';
import { TAG_TAXONOMY, ALL_TAGS } from '../constants/tag-taxonomy';

interface CardForTagging {
  name: string;
  oracleText: string | null;
  typeLine: string;
  manaCost: string | null;
  power: string | null;
  toughness: string | null;
}

interface LLMTagResult {
  name: string;
  tags: string[];
  baseline: BaselineScores;
}

@Injectable()
export class CardTaggingService {
  private readonly logger = new Logger(CardTaggingService.name);
  private anthropic: Anthropic | null = null;
  private isRunning = false;

  constructor(
    @InjectRepository(CardTag) private cardTagRepo: Repository<CardTag>,
    @InjectRepository(Card) private cardRepo: Repository<Card>,
    @InjectRepository(CardTaggingJob) private jobRepo: Repository<CardTaggingJob>,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  async startBulkTagging(options?: {
    tagVersion?: number;
    batchSize?: number;
  }): Promise<CardTaggingJob> {
    if (this.isRunning) {
      throw new Error('A tagging job is already running');
    }

    const tagVersion = options?.tagVersion ?? 1;
    const batchSize = options?.batchSize ?? 25;

    const untaggedCards = await this.getUntaggedCards(null, tagVersion);
    const totalCards = untaggedCards.length;

    if (totalCards === 0) {
      throw new Error('No untagged cards found');
    }

    const job = this.jobRepo.create({
      status: 'pending',
      totalCards,
      batchSize,
      tagVersion,
    });
    const savedJob = await this.jobRepo.save(job);

    // Run async — don't await
    this.runTaggingJob(savedJob.id).catch((err) => {
      this.logger.error(`Tagging job ${savedJob.id} failed: ${err.message}`);
    });

    return savedJob;
  }

  async resumeJob(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
    if (job.status !== 'paused' && job.status !== 'failed') {
      throw new Error(`Cannot resume job with status ${job.status}`);
    }

    job.status = 'running';
    await this.jobRepo.save(job);

    this.runTaggingJob(jobId).catch((err) => {
      this.logger.error(`Tagging job ${jobId} failed on resume: ${err.message}`);
    });
  }

  async pauseJob(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
    if (job.status !== 'running') {
      throw new Error(`Cannot pause job with status ${job.status}`);
    }
    job.status = 'paused';
    await this.jobRepo.save(job);
    this.isRunning = false;
  }

  async getJobStatus(jobId: string): Promise<CardTaggingJob> {
    return this.jobRepo.findOneOrFail({ where: { id: jobId } });
  }

  async tagSingleCard(card: CardForTagging): Promise<CardTag> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const results = await this.tagBatch([card]);
    const result = results.get(card.name);

    if (!result) {
      throw new Error(`Failed to tag card: ${card.name}`);
    }

    const hash = this.hashOracleText(card.oracleText);
    const existing = await this.cardTagRepo.findOne({ where: { cardName: card.name } });

    if (existing) {
      existing.tags = result.tags;
      existing.powerBaseline = result.baseline;
      existing.oracleTextHash = hash;
      existing.taggedAt = new Date();
      return this.cardTagRepo.save(existing);
    }

    const cardTag = this.cardTagRepo.create({
      cardName: card.name,
      tags: result.tags,
      powerBaseline: result.baseline,
      oracleTextHash: hash,
      taggedAt: new Date(),
    });
    return this.cardTagRepo.save(cardTag);
  }

  async getTagsForCards(cardNames: string[]): Promise<Map<string, CardTag>> {
    if (cardNames.length === 0) return new Map();

    const tags = await this.cardTagRepo
      .createQueryBuilder('ct')
      .where('ct.card_name IN (:...names)', { names: cardNames })
      .getMany();

    const map = new Map<string, CardTag>();
    for (const tag of tags) {
      map.set(tag.cardName, tag);
    }
    return map;
  }

  needsRetagging(existing: CardTag, currentOracleText: string | null): boolean {
    const currentHash = this.hashOracleText(currentOracleText);
    return existing.oracleTextHash !== currentHash;
  }

  async runBulkTaggingSync(options?: {
    tagVersion?: number;
    batchSize?: number;
    onProgress?: (processed: number, total: number, currentCard: string) => void;
    onBatchComplete?: (batchNum: number, totalBatches: number) => void;
  }): Promise<void> {
    if (this.isRunning) {
      throw new Error('A tagging job is already running');
    }

    const tagVersion = options?.tagVersion ?? 1;
    const batchSize = options?.batchSize ?? 25;

    this.isRunning = true;

    try {
      let allCards = await this.getUntaggedCards(null, tagVersion);
      const totalCards = allCards.length;

      if (totalCards === 0) {
        throw new Error('No untagged cards found');
      }

      const totalBatches = Math.ceil(totalCards / batchSize);
      let processed = 0;
      let batchNum = 0;

      while (allCards.length > 0) {
        batchNum++;
        const batch = allCards.slice(0, batchSize);

        try {
          const results = await this.tagBatch(batch);

          for (const card of batch) {
            const result = results.get(card.name);
            if (result) {
              await this.cardTagRepo.upsert(
                {
                  cardName: card.name,
                  tags: result.tags,
                  powerBaseline: result.baseline,
                  oracleTextHash: this.hashOracleText(card.oracleText),
                  taggedAt: new Date(),
                  tagVersion,
                },
                ['cardName'],
              );
            }
            processed++;
            options?.onProgress?.(processed, totalCards, card.name);
          }

          options?.onBatchComplete?.(batchNum, totalBatches);
        } catch (err) {
          this.logger.error(`Batch ${batchNum} failed: ${err.message}`);
          // Continue with next batch despite error
          processed += batch.length;
        }

        // Rate limit
        await this.sleep(500);

        // Get next batch
        const lastCard = batch[batch.length - 1];
        allCards = await this.getUntaggedCards(lastCard.name, tagVersion);
      }

      this.logger.log(`Bulk tagging complete: ${processed}/${totalCards} cards tagged`);
    } finally {
      this.isRunning = false;
    }
  }

  private async runTaggingJob(jobId: string): Promise<void> {
    this.isRunning = true;

    try {
      const job = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
      job.status = 'running';
      job.startedAt = new Date();
      await this.jobRepo.save(job);

      let cards = await this.getUntaggedCards(job.lastProcessedName, job.tagVersion);

      while (cards.length > 0) {
        // Check if paused
        const currentJob = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
        if (currentJob.status === 'paused') {
          this.logger.log(`Job ${jobId} paused at ${currentJob.processedCards}/${currentJob.totalCards}`);
          break;
        }

        const batch = cards.slice(0, job.batchSize);

        try {
          const results = await this.tagBatch(batch);

          for (const card of batch) {
            const result = results.get(card.name);
            if (result) {
              await this.cardTagRepo.upsert(
                {
                  cardName: card.name,
                  tags: result.tags,
                  powerBaseline: result.baseline,
                  oracleTextHash: this.hashOracleText(card.oracleText),
                  taggedAt: new Date(),
                  tagVersion: job.tagVersion,
                },
                ['cardName'],
              );
            } else {
              // Card failed in the batch response
              await this.logJobError(jobId, card.name, 'Missing from LLM response');
            }
          }

          // Update job progress
          const lastCard = batch[batch.length - 1];
          await this.jobRepo.update(jobId, {
            processedCards: () => `processed_cards + ${batch.length}`,
            lastProcessedName: lastCard.name,
          });
        } catch (err) {
          // Log batch error, continue with next batch
          for (const card of batch) {
            await this.logJobError(jobId, card.name, err.message);
          }
          await this.jobRepo.update(jobId, {
            failedCards: () => `failed_cards + ${batch.length}`,
            lastProcessedName: batch[batch.length - 1].name,
          });
        }

        // Rate limit
        await this.sleep(500);

        // Get next batch
        const updatedJob = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
        cards = await this.getUntaggedCards(updatedJob.lastProcessedName, job.tagVersion);
      }

      // Mark complete
      const finalJob = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
      if (finalJob.status === 'running') {
        finalJob.status = 'completed';
        finalJob.completedAt = new Date();
        await this.jobRepo.save(finalJob);
      }
    } catch (err) {
      this.logger.error(`Job ${jobId} fatal error: ${err.message}`);
      await this.jobRepo.update(jobId, { status: 'failed' });
    } finally {
      this.isRunning = false;
    }
  }

  private async tagBatch(
    cards: CardForTagging[],
  ): Promise<Map<string, { tags: string[]; baseline: BaselineScores }>> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const cardList = cards
      .map(
        (c, i) =>
          `${i + 1}. Name: ${c.name} | Cost: ${c.manaCost || 'N/A'} | Type: ${c.typeLine} | P/T: ${c.power || '-'}/${c.toughness || '-'} | Text: ${c.oracleText || 'No text'}`,
      )
      .join('\n');

    const taxonomyList = Object.entries(TAG_TAXONOMY)
      .map(([tag, desc]) => `  - ${tag}: ${desc}`)
      .join('\n');

    const prompt = `You are a Magic: The Gathering card analyzer. For each card below, provide:
1. Mechanical tags from the taxonomy below (only use tags from this list)
2. Baseline scores on 4 axes (0-100 scale):
   - power: How efficiently this card contributes to winning. Vanilla creatures = 10-20. Sol Ring = 85. Mana Crypt = 95. Most cards = 30-60.
   - salt: How annoying this card is to play against. Basic land = 0. Counterspell = 45. Cyclonic Rift = 85. Armageddon = 95.
   - fear: How threatening this card's board presence is. Basic land = 0. Grave Titan = 65. Blightsteel Colossus = 90.
   - airtime: How much game time this card demands. Basic land = 0. Sensei's Divining Top = 70. Storm count spells = 80.

TAG TAXONOMY:
${taxonomyList}

Cards:
${cardList}

Respond ONLY with valid JSON (no markdown, no code fences):
{"cards":[{"name":"Card Name","tags":["tag1","tag2"],"baseline":{"power":50,"salt":20,"fear":30,"airtime":10}},]}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON — handle potential markdown code fences
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as { cards: LLMTagResult[] };

    const results = new Map<string, { tags: string[]; baseline: BaselineScores }>();
    for (const card of parsed.cards) {
      // Validate tags against taxonomy
      const validTags = card.tags.filter((t) => ALL_TAGS.includes(t as any));
      // Clamp baseline scores to 0-100
      const baseline: BaselineScores = {
        power: Math.max(0, Math.min(100, Math.round(card.baseline.power))),
        salt: Math.max(0, Math.min(100, Math.round(card.baseline.salt))),
        fear: Math.max(0, Math.min(100, Math.round(card.baseline.fear))),
        airtime: Math.max(0, Math.min(100, Math.round(card.baseline.airtime))),
      };
      results.set(card.name, { tags: validTags, baseline });
    }

    return results;
  }

  private async getUntaggedCards(
    afterName: string | null,
    tagVersion: number,
  ): Promise<CardForTagging[]> {
    // Get distinct card names from the cards table that either:
    // 1. Don't have a card_tag entry, or
    // 2. Have a card_tag entry with a lower tag_version
    const query = this.cardRepo
      .createQueryBuilder('c')
      .distinctOn(['c.name'])
      .select('c.name', 'name')
      .addSelect('c.oracle_text', 'oracleText')
      .addSelect('c.type_line', 'typeLine')
      .addSelect('c.mana_cost', 'manaCost')
      .addSelect('c.power', 'power')
      .addSelect('c.toughness', 'toughness')
      .leftJoin(CardTag, 'ct', 'ct.card_name = c.name')
      .where('(ct.id IS NULL OR ct.tag_version < :tagVersion)', { tagVersion })
      .orderBy('c.name', 'ASC');

    if (afterName) {
      query.andWhere('c.name > :afterName', { afterName });
    }

    query.limit(500); // Load ahead

    return query.getRawMany();
  }

  private async logJobError(
    jobId: string,
    cardName: string,
    error: string,
  ): Promise<void> {
    const job = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
    const errorLog = job.errorLog || [];
    errorLog.push({
      cardName,
      error,
      timestamp: new Date().toISOString(),
    });
    // Keep last 100 errors
    if (errorLog.length > 100) {
      errorLog.splice(0, errorLog.length - 100);
    }
    job.errorLog = errorLog;
    job.failedCards += 1;
    await this.jobRepo.save(job);
  }

  private hashOracleText(text: string | null): string | null {
    if (!text) return null;
    return crypto.createHash('md5').update(text).digest('hex');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
