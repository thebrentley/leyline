import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSettingsTable1738200000000 implements MigrationInterface {
  name = 'CreateSettingsTable1738200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create settings table
    await queryRunner.query(`
      CREATE TABLE "settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "key" varchar NOT NULL,
        "value" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settings" PRIMARY KEY ("id")
      )
    `);

    // Create unique index on user_id + key
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_settings_user_id_key" ON "settings" ("user_id", "key")
    `);

    // Create foreign key to users
    await queryRunner.query(`
      ALTER TABLE "settings"
      ADD CONSTRAINT "FK_settings_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // Migrate existing archidekt data from users to settings
    // For each user with archidekt data, insert corresponding settings rows
    await queryRunner.query(`
      INSERT INTO "settings" ("user_id", "key", "value", "created_at", "updated_at")
      SELECT
        id as user_id,
        'archidekt_id' as key,
        archidekt_id::text as value,
        COALESCE(archidekt_connected_at, created_at) as created_at,
        COALESCE(archidekt_connected_at, updated_at) as updated_at
      FROM "users"
      WHERE archidekt_id IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "settings" ("user_id", "key", "value", "created_at", "updated_at")
      SELECT
        id as user_id,
        'archidekt_username' as key,
        archidekt_username as value,
        COALESCE(archidekt_connected_at, created_at) as created_at,
        COALESCE(archidekt_connected_at, updated_at) as updated_at
      FROM "users"
      WHERE archidekt_username IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "settings" ("user_id", "key", "value", "created_at", "updated_at")
      SELECT
        id as user_id,
        'archidekt_email' as key,
        archidekt_email as value,
        COALESCE(archidekt_connected_at, created_at) as created_at,
        COALESCE(archidekt_connected_at, updated_at) as updated_at
      FROM "users"
      WHERE archidekt_email IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "settings" ("user_id", "key", "value", "created_at", "updated_at")
      SELECT
        id as user_id,
        'archidekt_token' as key,
        archidekt_token as value,
        COALESCE(archidekt_connected_at, created_at) as created_at,
        COALESCE(archidekt_connected_at, updated_at) as updated_at
      FROM "users"
      WHERE archidekt_token IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "settings" ("user_id", "key", "value", "created_at", "updated_at")
      SELECT
        id as user_id,
        'archidekt_password' as key,
        archidekt_password as value,
        COALESCE(archidekt_connected_at, created_at) as created_at,
        COALESCE(archidekt_connected_at, updated_at) as updated_at
      FROM "users"
      WHERE archidekt_password IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "settings" ("user_id", "key", "value", "created_at", "updated_at")
      SELECT
        id as user_id,
        'archidekt_connected_at' as key,
        archidekt_connected_at::text as value,
        archidekt_connected_at as created_at,
        archidekt_connected_at as updated_at
      FROM "users"
      WHERE archidekt_connected_at IS NOT NULL
    `);

    // Drop the unique constraint on archidekt_id before dropping the column
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_archidekt_id"
    `);

    // Also try the default constraint name format
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_users_archidekt_id"
    `);

    // Drop archidekt columns from users table
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "archidekt_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "archidekt_username"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "archidekt_email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "archidekt_token"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "archidekt_password"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "archidekt_connected_at"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add archidekt columns to users table
    await queryRunner.query(`ALTER TABLE "users" ADD "archidekt_id" integer`);
    await queryRunner.query(`ALTER TABLE "users" ADD "archidekt_username" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "archidekt_email" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "archidekt_token" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "archidekt_password" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "archidekt_connected_at" timestamp`);

    // Migrate data back from settings to users
    await queryRunner.query(`
      UPDATE "users" u
      SET archidekt_id = s.value::integer
      FROM "settings" s
      WHERE s.user_id = u.id AND s.key = 'archidekt_id'
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET archidekt_username = s.value
      FROM "settings" s
      WHERE s.user_id = u.id AND s.key = 'archidekt_username'
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET archidekt_email = s.value
      FROM "settings" s
      WHERE s.user_id = u.id AND s.key = 'archidekt_email'
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET archidekt_token = s.value
      FROM "settings" s
      WHERE s.user_id = u.id AND s.key = 'archidekt_token'
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET archidekt_password = s.value
      FROM "settings" s
      WHERE s.user_id = u.id AND s.key = 'archidekt_password'
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET archidekt_connected_at = s.value::timestamp
      FROM "settings" s
      WHERE s.user_id = u.id AND s.key = 'archidekt_connected_at'
    `);

    // Add unique constraint back to archidekt_id
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_archidekt_id" ON "users" ("archidekt_id") WHERE archidekt_id IS NOT NULL
    `);

    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE "settings" DROP CONSTRAINT "FK_settings_user"
    `);

    // Drop index
    await queryRunner.query(`
      DROP INDEX "IDX_settings_user_id_key"
    `);

    // Drop settings table
    await queryRunner.query(`DROP TABLE "settings"`);
  }
}
