#!/usr/bin/env ts-node

/**
 * Script to import token definitions from Scryfall
 *
 * Usage: npm run import-tokens
 *
 * This script fetches all token cards from Scryfall's API and imports them
 * into the tokens table for use during playtesting.
 */

import { AppDataSource } from '../database/data-source';
import { Token } from '../entities/token.entity';

interface ScryfallToken {
  id: string;
  oracle_id: string;
  name: string;
  type_line: string;
  oracle_text?: string;
  colors: string[];
  color_identity: string[];
  power?: string;
  toughness?: string;
  keywords: string[];
  image_uris?: {
    normal?: string;
    small?: string;
    art_crop?: string;
    png?: string;
  };
  layout: string;
}

interface ScryfallBulkData {
  object: string;
  type: string;
  download_uri: string;
  updated_at: string;
}

async function fetchTokens(): Promise<ScryfallToken[]> {
  console.log('Fetching token data from Scryfall...');

  // First, get the bulk data information
  const bulkDataResponse = await fetch('https://api.scryfall.com/bulk-data');
  const bulkData = await bulkDataResponse.json();

  // Find the default cards bulk data (contains all tokens)
  const defaultCards = bulkData.data.find(
    (item: ScryfallBulkData) => item.type === 'default_cards',
  );

  if (!defaultCards) {
    throw new Error('Could not find default cards bulk data from Scryfall');
  }

  console.log('Downloading bulk card data...');
  const cardsResponse = await fetch(defaultCards.download_uri);
  const allCards = await cardsResponse.json();

  // Filter for tokens only
  const tokens = allCards.filter((card: any) => card.layout === 'token');

  console.log(`Found ${tokens.length} tokens in Scryfall data`);

  return tokens;
}

function generateTokenId(token: ScryfallToken): string {
  // Generate a unique token ID based on name and attributes
  const namePart = token.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Add distinguishing features if present
  const features: string[] = [];

  if (token.power && token.toughness) {
    features.push(`${token.power}-${token.toughness}`);
  }

  if (token.colors.length > 0) {
    features.push(token.colors.sort().join('').toLowerCase());
  }

  // For tokens with same name but different P/T or colors
  const fullId =
    features.length > 0 ? `${namePart}-${features.join('-')}` : namePart;

  return fullId;
}

async function importTokens() {
  console.log('Initializing database connection...');
  await AppDataSource.initialize();

  try {
    const tokenRepository = AppDataSource.getRepository(Token);

    // Fetch tokens from Scryfall
    const scryfallTokens = await fetchTokens();

    console.log('Importing tokens into database...');

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const scryfallToken of scryfallTokens) {
      try {
        const tokenId = generateTokenId(scryfallToken);

        // Check if token already exists
        const existingToken = await tokenRepository.findOne({
          where: { tokenId },
        });

        const tokenData: Partial<Token> = {
          tokenId,
          name: scryfallToken.name,
          typeLine: scryfallToken.type_line,
          oracleText: scryfallToken.oracle_text || null,
          colors: scryfallToken.colors || [],
          colorIdentity: scryfallToken.color_identity || [],
          power: scryfallToken.power || null,
          toughness: scryfallToken.toughness || null,
          keywords: scryfallToken.keywords || [],
          imageNormal: scryfallToken.image_uris?.normal || null,
          imageSmall: scryfallToken.image_uris?.small || null,
          imageArtCrop: scryfallToken.image_uris?.art_crop || null,
          imagePng: scryfallToken.image_uris?.png || null,
          scryfallId: scryfallToken.id,
          scryfallOracleId: scryfallToken.oracle_id,
          createdBy: [], // Can be populated later by analyzing card oracle text
          updatedAt: new Date(),
        };

        if (existingToken) {
          // Update existing token
          await tokenRepository.update({ tokenId }, tokenData);
          updated++;
        } else {
          // Create new token
          const token = tokenRepository.create(tokenData);
          await tokenRepository.save(token);
          imported++;
        }

        // Log progress every 100 tokens
        if ((imported + updated + skipped) % 100 === 0) {
          console.log(
            `Progress: ${imported} imported, ${updated} updated, ${skipped} skipped`,
          );
        }
      } catch (error) {
        console.error(`Error processing token ${scryfallToken.name}:`, error);
        skipped++;
      }
    }

    console.log('\n=== Import Complete ===');
    console.log(`Total tokens processed: ${scryfallTokens.length}`);
    console.log(`Imported: ${imported}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);

    // Show some example tokens
    console.log('\n=== Sample Tokens ===');
    const sampleTokens = await tokenRepository.find({ take: 5 });
    for (const token of sampleTokens) {
      console.log(
        `- ${token.name} (${token.tokenId}) - ${token.typeLine}`,
      );
    }
  } catch (error) {
    console.error('Error during import:', error);
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}

// Run the import
if (require.main === module) {
  importTokens()
    .then(() => {
      console.log('\nToken import completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nToken import failed:', error);
      process.exit(1);
    });
}

export { importTokens };
