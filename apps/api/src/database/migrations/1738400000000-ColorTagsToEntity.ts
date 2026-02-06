import { MigrationInterface, QueryRunner } from 'typeorm';

export class ColorTagsToEntity1738400000000 implements MigrationInterface {
  name = 'ColorTagsToEntity1738400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Create the color_tags table
    await queryRunner.query(`
      CREATE TABLE "color_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "deck_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "color" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_color_tags" PRIMARY KEY ("id")
      )
    `);

    // Step 2: Create unique index on (deck_id, name)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_color_tags_deck_name" ON "color_tags" ("deck_id", "name")
    `);

    // Step 3: Add foreign key from color_tags to decks
    await queryRunner.query(`
      ALTER TABLE "color_tags"
      ADD CONSTRAINT "FK_color_tags_deck"
      FOREIGN KEY ("deck_id") REFERENCES "decks"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Step 4: Migrate existing JSONB data into rows
    await queryRunner.query(`
      INSERT INTO "color_tags" ("deck_id", "name", "color")
      SELECT d.id, tag->>'name', tag->>'color'
      FROM "decks" d,
           jsonb_array_elements(d.color_tags) AS tag
      WHERE jsonb_array_length(d.color_tags) > 0
    `);

    // Step 5: Add color_tag_id column to deck_cards
    await queryRunner.query(`
      ALTER TABLE "deck_cards" ADD COLUMN "color_tag_id" uuid
    `);

    // Step 6: Add foreign key from deck_cards.color_tag_id to color_tags.id
    await queryRunner.query(`
      ALTER TABLE "deck_cards"
      ADD CONSTRAINT "FK_deck_cards_color_tag"
      FOREIGN KEY ("color_tag_id") REFERENCES "color_tags"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Step 7: Populate color_tag_id from the existing color_tag varchar column
    // The current color_tag column stores the hex color string.
    // Match it to the newly created color_tags rows by (deck_id, color).
    await queryRunner.query(`
      UPDATE "deck_cards" dc
      SET "color_tag_id" = ct.id
      FROM "color_tags" ct
      WHERE dc.deck_id = ct.deck_id
        AND dc.color_tag IS NOT NULL
        AND dc.color_tag = ct.color
    `);

    // Step 8: Drop the old color_tag VARCHAR column from deck_cards
    await queryRunner.query(`
      ALTER TABLE "deck_cards" DROP COLUMN "color_tag"
    `);

    // Step 9: Drop the old color_tags JSONB column from decks
    await queryRunner.query(`
      ALTER TABLE "decks" DROP COLUMN "color_tags"
    `);

    // Note: deck_versions.color_tags JSONB is left untouched.
    // Existing version snapshots keep their old format.
    // Application code handles both old and new formats when reading.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Re-add the color_tags JSONB column to decks
    await queryRunner.query(`
      ALTER TABLE "decks" ADD COLUMN "color_tags" jsonb NOT NULL DEFAULT '[]'
    `);

    // Step 2: Repopulate the JSONB from color_tags table rows
    await queryRunner.query(`
      UPDATE "decks" d
      SET "color_tags" = COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('name', ct.name, 'color', ct.color))
         FROM "color_tags" ct WHERE ct.deck_id = d.id),
        '[]'::jsonb
      )
    `);

    // Step 3: Re-add the color_tag VARCHAR column to deck_cards
    await queryRunner.query(`
      ALTER TABLE "deck_cards" ADD COLUMN "color_tag" character varying
    `);

    // Step 4: Repopulate from the FK
    await queryRunner.query(`
      UPDATE "deck_cards" dc
      SET "color_tag" = ct.color
      FROM "color_tags" ct
      WHERE dc.color_tag_id = ct.id
    `);

    // Step 5: Drop the FK and color_tag_id column
    await queryRunner.query(`
      ALTER TABLE "deck_cards" DROP CONSTRAINT "FK_deck_cards_color_tag"
    `);
    await queryRunner.query(`
      ALTER TABLE "deck_cards" DROP COLUMN "color_tag_id"
    `);

    // Step 6: Drop the color_tags table
    await queryRunner.query(`
      ALTER TABLE "color_tags" DROP CONSTRAINT "FK_color_tags_deck"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_color_tags_deck_name"
    `);
    await queryRunner.query(`
      DROP TABLE "color_tags"
    `);
  }
}
