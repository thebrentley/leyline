import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPodVisibility1739300000000 implements MigrationInterface {
  name = "AddPodVisibility1739300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // No schema change needed - varchar column already supports 'pod' value
    // This migration documents the introduction of the 'pod' visibility option
    // Application code now supports: 'private', 'public', 'pod'
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert any 'pod' visibility decks to 'private'
    await queryRunner.query(
      `UPDATE "decks" SET "visibility" = 'private' WHERE "visibility" = 'pod'`,
    );
  }
}
