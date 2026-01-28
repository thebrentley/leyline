/**
 * Scryfall Bulk Data Sync Script
 *
 * Downloads all cards from Scryfall's bulk data API and upserts them into the database.
 * Uses streaming JSON parsing to handle large files (2GB+).
 *
 * Usage:
 *   npm run sync:scryfall                    # Sync all cards (default_cards ~80k)
 *   npm run sync:scryfall -- --all           # Sync ALL printings (~300k cards)
 *   npm run sync:scryfall -- --oracle        # Sync unique oracle cards (~25k)
 *
 * Requires DATABASE_URL environment variable to be set.
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pipeline } from 'stream/promises';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { Card } from '../src/entities/card.entity';
import { DeckCard } from '../src/entities/deck-card.entity';
import { CollectionCard } from '../src/entities/collection-card.entity';
import { Deck } from '../src/entities/deck.entity';
import { User } from '../src/entities/user.entity';
import { ChatSession } from '../src/entities/chat-session.entity';
import { DeckVersion } from '../src/entities/deck-version.entity';

config();

const SCRYFALL_BULK_API = 'https://api.scryfall.com/bulk-data';
const BATCH_SIZE = 1000;

interface ScryfallBulkData {
  object: string;
  data: ScryfallBulkItem[];
}

interface ScryfallBulkItem {
  type: string;
  download_uri: string;
  updated_at: string;
  size: number;
  name: string;
}

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  collector_number: string;
  set_name: string;
  mana_cost?: string;
  cmc?: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity: string;
  image_uris?: {
    normal?: string;
    small?: string;
    art_crop?: string;
    png?: string;
  };
  prices?: {
    usd?: string;
    usd_foil?: string;
  };
  layout?: string;
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    power?: string;
    toughness?: string;
    image_uris?: {
      normal?: string;
      small?: string;
      art_crop?: string;
      png?: string;
    };
  }>;
  // Filtering fields
  games?: string[];
  digital?: boolean;
  set_type?: string;
  lang?: string;
}

type BulkDataType = 'default_cards' | 'all_cards' | 'oracle_cards';

function parseArgs(): BulkDataType {
  const args = process.argv.slice(2);
  if (args.includes('--all')) return 'all_cards';
  if (args.includes('--oracle')) return 'oracle_cards';
  return 'default_cards';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

async function getBulkDataUrl(type: BulkDataType): Promise<{ url: string; size: number }> {
  console.log(`Fetching bulk data manifest from Scryfall...`);
  const response = await axios.get<ScryfallBulkData>(SCRYFALL_BULK_API);
  const bulkItem = response.data.data.find((item) => item.type === type);

  if (!bulkItem) {
    throw new Error(`Bulk data type "${type}" not found`);
  }

  console.log(`Found ${bulkItem.name} (${formatBytes(bulkItem.size)})`);
  console.log(`Last updated: ${new Date(bulkItem.updated_at).toLocaleString()}`);

  return { url: bulkItem.download_uri, size: bulkItem.size };
}

async function downloadBulkData(url: string, expectedSize: number): Promise<string> {
  const tempFile = path.join(os.tmpdir(), `scryfall-bulk-${Date.now()}.json`);
  console.log(`\nDownloading to ${tempFile}...`);

  const response = await axios.get(url, {
    responseType: 'stream',
  });

  const writer = fs.createWriteStream(tempFile);
  let downloaded = 0;
  let lastProgress = 0;

  response.data.on('data', (chunk: Buffer) => {
    downloaded += chunk.length;
    const progress = Math.floor((downloaded / expectedSize) * 100);
    if (progress > lastProgress) {
      process.stdout.write(`\rDownloading: ${progress}% (${formatBytes(downloaded)})`);
      lastProgress = progress;
    }
  });

  response.data.pipe(writer);

  await new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  console.log('\nDownload complete!');
  return tempFile;
}

function shouldIncludeCard(card: ScryfallCard): boolean {
  // Filter out non-paper cards (digital only, etc.)
  return (
    card.games?.includes('paper') !== false && // Include if games is undefined or includes paper
    !card.digital &&
    card.set_type !== 'memorabilia' &&
    card.set_type !== 'token' &&
    card.lang === 'en' // English only
  );
}

function mapScryfallCard(card: ScryfallCard): Partial<Card> {
  // Handle double-faced cards - get data from faces if main card is missing it
  let imageNormal = card.image_uris?.normal ?? null;
  let imageSmall = card.image_uris?.small ?? null;
  let imageArtCrop = card.image_uris?.art_crop ?? null;
  let imagePng = card.image_uris?.png ?? null;
  let typeLine = card.type_line;
  let oracleText = card.oracle_text ?? null;
  let manaCost = card.mana_cost ?? null;

  // For double-faced cards, extract missing data from card faces
  if (card.card_faces && card.card_faces.length > 0) {
    const frontFace = card.card_faces[0];

    if (!imageNormal && frontFace.image_uris) {
      imageNormal = frontFace.image_uris.normal ?? null;
      imageSmall = frontFace.image_uris.small ?? null;
      imageArtCrop = frontFace.image_uris.art_crop ?? null;
      imagePng = frontFace.image_uris.png ?? null;
    }

    if (!typeLine && frontFace.type_line) {
      // Combine both faces' type lines for DFCs
      typeLine = card.card_faces.map((f) => f.type_line).filter(Boolean).join(' // ');
    }

    if (!oracleText && frontFace.oracle_text) {
      oracleText = frontFace.oracle_text;
    }

    if (!manaCost && frontFace.mana_cost) {
      manaCost = frontFace.mana_cost;
    }
  }

  return {
    scryfallId: card.id,
    name: card.name,
    setCode: card.set,
    collectorNumber: card.collector_number,
    setName: card.set_name,
    manaCost,
    cmc: card.cmc ?? null,
    typeLine: typeLine || 'Unknown',
    oracleText,
    colors: card.colors ?? [],
    colorIdentity: card.color_identity ?? [],
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    loyalty: card.loyalty ?? null,
    rarity: card.rarity || 'common',
    imageNormal,
    imageSmall,
    imageArtCrop,
    imagePng,
    priceUsd: card.prices?.usd ? parseFloat(card.prices.usd) : null,
    priceUsdFoil: card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null,
    layout: card.layout ?? null,
    cardFaces: card.card_faces ?? null,
    pricesUpdatedAt: new Date(),
  };
}

async function processBatch(
  cardRepository: ReturnType<DataSource['getRepository']>,
  batch: Partial<Card>[],
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  try {
    await cardRepository.upsert(batch, ['scryfallId']);
    success = batch.length;
  } catch {
    // If batch fails, try one by one
    for (const cardData of batch) {
      try {
        await cardRepository.upsert(cardData, ['scryfallId']);
        success++;
      } catch (innerErr) {
        errors++;
        if (errors <= 5) {
          console.error(`\nError upserting card ${cardData.name}: ${(innerErr as Error).message}`);
        }
      }
    }
  }

  return { success, errors };
}

async function streamAndSyncCards(
  dataSource: DataSource,
  tempFile: string,
): Promise<{ processed: number; skipped: number; errors: number }> {
  const cardRepository = dataSource.getRepository(Card);

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let totalRead = 0;
  const batch: Partial<Card>[] = [];

  console.log('\nStreaming and syncing cards...');

  const fileStream = fs.createReadStream(tempFile);
  const jsonParser = parser();
  const arrayStream = streamArray();

  arrayStream.on('data', async ({ value }: { value: ScryfallCard }) => {
    totalRead++;

    if (totalRead % 10000 === 0) {
      process.stdout.write(`\rRead: ${totalRead.toLocaleString()} | Synced: ${processed.toLocaleString()} | Skipped: ${skipped.toLocaleString()}`);
    }

    if (!shouldIncludeCard(value)) {
      skipped++;
      return;
    }

    batch.push(mapScryfallCard(value));

    if (batch.length >= BATCH_SIZE) {
      // Pause the stream while we process the batch
      arrayStream.pause();

      const batchToProcess = batch.splice(0, BATCH_SIZE);
      const result = await processBatch(cardRepository, batchToProcess);
      processed += result.success;
      errors += result.errors;

      arrayStream.resume();
    }
  });

  await pipeline(fileStream, jsonParser, arrayStream);

  // Process any remaining cards in the batch
  if (batch.length > 0) {
    const result = await processBatch(cardRepository, batch);
    processed += result.success;
    errors += result.errors;
  }

  console.log(`\rRead: ${totalRead.toLocaleString()} | Synced: ${processed.toLocaleString()} | Skipped: ${skipped.toLocaleString()}`);

  return { processed, skipped, errors };
}

async function main() {
  const startTime = Date.now();
  const bulkType = parseArgs();

  console.log('='.repeat(60));
  console.log('Scryfall Bulk Data Sync');
  console.log('='.repeat(60));
  console.log(`Bulk data type: ${bulkType}`);

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  // Initialize database connection
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Card, DeckCard, CollectionCard, Deck, User, ChatSession, DeckVersion],
    synchronize: false,
    logging: false,
  });

  let tempFile: string | null = null;

  try {
    console.log('\nConnecting to database...');
    await dataSource.initialize();
    console.log('Database connected!');

    // Get bulk data URL
    const { url, size } = await getBulkDataUrl(bulkType);

    // Download the file
    tempFile = await downloadBulkData(url, size);

    // Stream and sync
    const { processed, skipped, errors } = await streamAndSyncCards(dataSource, tempFile);

    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('Sync Complete!');
    console.log('='.repeat(60));
    console.log(`Total cards synced: ${processed.toLocaleString()}`);
    console.log(`Skipped (non-English/digital/tokens): ${skipped.toLocaleString()}`);
    console.log(`Errors: ${errors}`);
    console.log(`Duration: ${formatDuration(duration)}`);
    console.log(`Rate: ${Math.round(processed / (duration / 1000))} cards/second`);
  } catch (error) {
    console.error('\nSync failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log('\nCleaned up temp file');
    }

    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

main();
