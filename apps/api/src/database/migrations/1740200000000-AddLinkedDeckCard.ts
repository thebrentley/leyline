import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkedDeckCard1740200000000 implements MigrationInterface {
  name = 'AddLinkedDeckCard1740200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "collection_cards"
        ADD COLUMN IF NOT EXISTS "linked_deck_card" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "collection_cards"
        DROP COLUMN "linked_deck_card"
    `);
  }
}
