import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeckVisibility1739100000000 implements MigrationInterface {
  name = "AddDeckVisibility1739100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "decks" ADD COLUMN "visibility" varchar NOT NULL DEFAULT 'private'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_decks_visibility" ON "decks" ("visibility") WHERE "visibility" = 'public'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_decks_visibility"`);
    await queryRunner.query(`ALTER TABLE "decks" DROP COLUMN "visibility"`);
  }
}
