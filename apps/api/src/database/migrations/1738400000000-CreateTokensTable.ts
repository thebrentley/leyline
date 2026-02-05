import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTokensTable1738400000000 implements MigrationInterface {
  name = 'CreateTokensTable1738400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tokens table
    await queryRunner.query(`
      CREATE TABLE "tokens" (
        "token_id" varchar NOT NULL,
        "name" varchar NOT NULL,
        "type_line" varchar NOT NULL,
        "oracle_text" text,
        "colors" text array NOT NULL DEFAULT '{}',
        "color_identity" text array NOT NULL DEFAULT '{}',
        "power" varchar,
        "toughness" varchar,
        "keywords" text array NOT NULL DEFAULT '{}',
        "image_normal" text,
        "image_small" text,
        "image_art_crop" text,
        "image_png" text,
        "scryfall_id" varchar,
        "scryfall_oracle_id" varchar,
        "created_by" text array NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tokens" PRIMARY KEY ("token_id")
      )
    `);

    // Create index on token name for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_tokens_name" ON "tokens" ("name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX "IDX_tokens_name"
    `);

    // Drop tokens table
    await queryRunner.query(`DROP TABLE "tokens"`);
  }
}
