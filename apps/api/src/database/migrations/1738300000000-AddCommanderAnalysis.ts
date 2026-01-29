import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommanderAnalysis1738300000000 implements MigrationInterface {
  name = 'AddCommanderAnalysis1738300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add commander_analysis column to chat_sessions table
    await queryRunner.query(`
      ALTER TABLE "chat_sessions"
      ADD COLUMN "commander_analysis" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove commander_analysis column
    await queryRunner.query(`
      ALTER TABLE "chat_sessions"
      DROP COLUMN "commander_analysis"
    `);
  }
}
