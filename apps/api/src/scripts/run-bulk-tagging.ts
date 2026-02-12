#!/usr/bin/env node
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CardTaggingService } from '../modules/deck-ranking/services/card-tagging.service';

/**
 * Standalone script to run bulk card tagging with live progress updates.
 *
 * Usage:
 *   npm run tag-cards
 *
 * Or directly:
 *   ts-node -r tsconfig-paths/register src/scripts/run-bulk-tagging.ts
 */

async function main() {
  console.log('\n🎴 MTG Card Tagging Pipeline\n');
  console.log('═'.repeat(60));

  // Bootstrap minimal NestJS application
  console.log('📦 Initializing NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'], // Reduce noise in console
  });

  try {
    const taggingService = app.get(CardTaggingService);

    console.log('✓ Context initialized\n');
    console.log('Starting bulk tagging...\n');

    const startTime = Date.now();
    let lastProgressUpdate = Date.now();

    await taggingService.runBulkTaggingSync({
      tagVersion: 1,
      batchSize: 25,
      onProgress: (processed, total, currentCard) => {
        // Throttle progress updates to every 100ms to avoid spam
        const now = Date.now();
        if (now - lastProgressUpdate < 100) return;
        lastProgressUpdate = now;

        const percent = ((processed / total) * 100).toFixed(1);
        const bar = createProgressBar(processed, total, 40);

        // Clear line and write progress
        process.stdout.write(`\r${bar} ${percent}% (${processed}/${total})`);
      },
      onBatchComplete: (batchNum, totalBatches) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n  ✓ Batch ${batchNum}/${totalBatches} complete (${elapsed}s elapsed)`);
      },
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n\n' + '═'.repeat(60));
    console.log(`✅ Bulk tagging complete in ${totalTime}s`);
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Tagging failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

function createProgressBar(current: number, total: number, width: number): string {
  const percent = current / total;
  const filled = Math.floor(percent * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
}

// Run the script
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
