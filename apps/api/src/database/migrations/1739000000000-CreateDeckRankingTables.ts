import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeckRankingTables1739000000000 implements MigrationInterface {
  name = 'CreateDeckRankingTables1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // card_tags — LLM-assigned mechanical tags + baseline scores per card name
    await queryRunner.query(`
      CREATE TABLE "card_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "card_name" varchar NOT NULL,
        "tags" text array NOT NULL DEFAULT '{}',
        "power_baseline" jsonb,
        "tag_version" int NOT NULL DEFAULT 1,
        "tagged_at" TIMESTAMP NOT NULL,
        "oracle_text_hash" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_card_tags" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_card_tags_card_name" UNIQUE ("card_name")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_card_tags_card_name" ON "card_tags" ("card_name")
    `);

    // interaction_rules — Tag pair synergy rules
    await queryRunner.query(`
      CREATE TABLE "interaction_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tag_a" varchar NOT NULL,
        "tag_b" varchar NOT NULL,
        "modifiers" jsonb NOT NULL,
        "interaction_type" varchar NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_interaction_rules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_interaction_rules_tag_pair" UNIQUE ("tag_a", "tag_b")
      )
    `);

    // combo_entries — Known combos from Commander Spellbook
    await queryRunner.query(`
      CREATE TABLE "combo_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spellbook_id" varchar,
        "card_names" text array NOT NULL,
        "piece_count" int NOT NULL,
        "is_game_winning" boolean NOT NULL DEFAULT false,
        "requires_commander" boolean NOT NULL DEFAULT false,
        "color_identity" text array NOT NULL DEFAULT '{}',
        "description" text,
        "result_tags" text array NOT NULL DEFAULT '{}',
        "last_synced_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_combo_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_combo_entries_spellbook_id" UNIQUE ("spellbook_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_combo_entries_card_names" ON "combo_entries" USING GIN ("card_names")
    `);

    // deck_scores — Cached final scores per deck
    await queryRunner.query(`
      CREATE TABLE "deck_scores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "deck_id" uuid NOT NULL,
        "power" int NOT NULL,
        "salt" int NOT NULL,
        "fear" int NOT NULL,
        "airtime" int NOT NULL,
        "layer_scores" jsonb NOT NULL,
        "notable_cards" jsonb,
        "detected_combos" jsonb,
        "detected_engines" jsonb,
        "card_count_at_scoring" int NOT NULL,
        "score_version" int NOT NULL DEFAULT 1,
        "computed_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_deck_scores" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_deck_scores_deck_id" UNIQUE ("deck_id"),
        CONSTRAINT "FK_deck_scores_deck" FOREIGN KEY ("deck_id") REFERENCES "decks"("id") ON DELETE CASCADE
      )
    `);

    // card_tagging_jobs — Bulk tagging pipeline tracking
    await queryRunner.query(`
      CREATE TABLE "card_tagging_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "status" varchar NOT NULL DEFAULT 'pending',
        "total_cards" int NOT NULL,
        "processed_cards" int NOT NULL DEFAULT 0,
        "failed_cards" int NOT NULL DEFAULT 0,
        "last_processed_name" varchar,
        "batch_size" int NOT NULL DEFAULT 25,
        "tag_version" int NOT NULL DEFAULT 1,
        "error_log" jsonb,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "card_tagging_jobs"`);
    await queryRunner.query(`DROP TABLE "deck_scores"`);
    await queryRunner.query(`DROP INDEX "IDX_combo_entries_card_names"`);
    await queryRunner.query(`DROP TABLE "combo_entries"`);
    await queryRunner.query(`DROP TABLE "interaction_rules"`);
    await queryRunner.query(`DROP INDEX "IDX_card_tags_card_name"`);
    await queryRunner.query(`DROP TABLE "card_tags"`);
  }
}
