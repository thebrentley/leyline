import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropWinnerNameFromGameResults1740300000000
  implements MigrationInterface
{
  name = 'DropWinnerNameFromGameResults1740300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pod_game_results"
      DROP COLUMN IF EXISTS "winner_name"
    `);

    await queryRunner.query(`
      ALTER TABLE "pod_game_results"
      ADD COLUMN IF NOT EXISTS "winner_offline_member_id" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pod_game_results"
      DROP COLUMN IF EXISTS "winner_offline_member_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "pod_game_results"
      ADD COLUMN "winner_name" varchar
    `);
  }
}
