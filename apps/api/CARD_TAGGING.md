# Card Tagging Guide

## Overview

The card tagging system uses Claude AI to automatically tag all MTG cards in your database with mechanical tags (e.g., "removal", "ramp", "tokens") and baseline power scores. These tags power the deck ranking system.

## Running Bulk Tagging

### Using npm script (recommended):

```bash
cd monorepo/apps/api
npm run tag-cards
```

### Direct execution:

```bash
cd monorepo/apps/api
ts-node -r tsconfig-paths/register src/scripts/run-bulk-tagging.ts
```

## What Happens

1. **Initialization**: The script loads all untagged cards from your database
2. **Batching**: Cards are processed in batches of 25 (to optimize API calls)
3. **LLM Tagging**: Each batch is sent to Claude Sonnet for analysis
4. **Progress Updates**: Live progress bar shows current status
5. **Storage**: Tags and baseline scores are saved to the `card_tags` table

## Expected Output

```
🎴 MTG Card Tagging Pipeline

════════════════════════════════════════════════════════════
📦 Initializing NestJS context...
✓ Context initialized

Starting bulk tagging...

[████████████████████████████████████████] 100.0% (2500/2500)
  ✓ Batch 100/100 complete (1234.5s elapsed)

════════════════════════════════════════════════════════════
✅ Bulk tagging complete in 1234.5s
════════════════════════════════════════════════════════════
```

## Performance Estimates

- **Cards per batch**: 25
- **API call rate**: ~1 every 500ms (rate limited)
- **Time per batch**: ~2-3 seconds (including API call + database save)
- **Total time for 25,000 cards**: ~2-4 hours
- **Cost estimate**: $5-8 (using Claude Sonnet)

## Resume Capability

The script is **crash-safe**:
- If interrupted (Ctrl+C, network error, API timeout), you can simply re-run it
- The script automatically skips already-tagged cards
- Uses alphabetical ordering to track progress
- No duplicate tagging will occur

## New Cards

When new cards are added to your database (via Scryfall sync):
- They are **NOT** automatically tagged
- Instead, they are **lazy-tagged** when first encountered during deck scoring
- This happens transparently in the background
- To force immediate tagging of new cards, re-run `npm run tag-cards`

## Configuration

You can modify tagging behavior in the script or via the service:

```typescript
await taggingService.runBulkTaggingSync({
  tagVersion: 1,         // Increment to re-tag all cards with updated taxonomy
  batchSize: 25,         // Cards per API call (25 is optimal)
  onProgress: ...,       // Progress callback
  onBatchComplete: ...,  // Batch completion callback
});
```

## Tag Taxonomy

All tags come from: [`src/modules/deck-ranking/constants/tag-taxonomy.ts`](./src/modules/deck-ranking/constants/tag-taxonomy.ts)

Currently includes ~70 tags across categories:
- Removal (targeted, board-wipes, exile)
- Ramp (lands, mana rocks, dorks)
- Card advantage (draw, tutors, recursion)
- Combat (evasion, buffs, protection)
- Tokens & sacrifice
- Stax & control
- Graveyard interaction
- Combos & game-winners

## Re-tagging Cards

If you update the tag taxonomy or want to re-score all cards:

1. Increment `tagVersion` in the script (e.g., from 1 to 2)
2. Re-run `npm run tag-cards`
3. All cards with `tag_version < 2` will be re-tagged

## Troubleshooting

### "Anthropic API key not configured"
- Ensure `ANTHROPIC_API_KEY` is set in your `.env.local`
- Get an API key at: https://console.anthropic.com/

### "A tagging job is already running"
- The service prevents concurrent tagging to avoid rate limits
- Wait for the current run to complete, or restart the API server to reset the lock

### API Rate Limits
- The script includes automatic 500ms delays between batches
- If you hit rate limits, the script will log errors but continue with next batch
- Failed cards are logged but don't stop the entire process

### Out of Memory
- If processing a huge database (>100k cards), consider increasing Node's memory:
  ```bash
  NODE_OPTIONS="--max-old-space-size=4096" npm run tag-cards
  ```

## Database Schema

Tags are stored in the `card_tags` table:

```sql
CREATE TABLE card_tags (
  id UUID PRIMARY KEY,
  card_name VARCHAR UNIQUE,
  tags TEXT[],                    -- Array of tag strings
  power_baseline JSONB,           -- { power, salt, fear, airtime }
  oracle_text_hash VARCHAR,       -- MD5 of oracle text
  tag_version INTEGER,            -- For re-tagging detection
  tagged_at TIMESTAMP
);
```

## API Endpoints

The tagging system also exposes REST endpoints for web-based triggering:

```
POST /deck-ranking/admin/start-tagging    # Start async job
GET  /deck-ranking/admin/tagging-status/:jobId
```

However, the **standalone script is recommended** for initial bulk tagging because:
- Live progress feedback
- Runs synchronously (no polling required)
- Easier to debug
- Better for long-running jobs
