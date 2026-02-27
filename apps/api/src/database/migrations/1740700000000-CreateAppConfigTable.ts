import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppConfigTable1740700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_config" (
        "key" varchar PRIMARY KEY,
        "value" text,
        "updated_at" TIMESTAMP DEFAULT now()
      );
    `);

    // Seed combo sync config
    await queryRunner.query(`
      INSERT INTO "app_config" ("key", "value") VALUES
        ('combo_sync_enabled', 'false'),
        ('combo_sync_offset', '0');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_config";`);
  }
}
