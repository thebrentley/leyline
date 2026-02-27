import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetColumns1740500000000 implements MigrationInterface {
  name = 'AddPasswordResetColumns1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "reset_token" varchar UNIQUE,
        ADD COLUMN "reset_token_expires_at" timestamp
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_reset_token"
        ON "users" ("reset_token")
        WHERE "reset_token" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_reset_token"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "reset_token",
        DROP COLUMN IF EXISTS "reset_token_expires_at"
    `);
  }
}
