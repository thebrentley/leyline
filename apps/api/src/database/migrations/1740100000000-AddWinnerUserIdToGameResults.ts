import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWinnerUserIdToGameResults1740100000000
  implements MigrationInterface
{
  name = 'AddWinnerUserIdToGameResults1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pod_game_results"
      ADD COLUMN IF NOT EXISTS "winner_user_id" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pod_game_results"
      DROP COLUMN IF EXISTS "winner_user_id"
    `);
  }
}
