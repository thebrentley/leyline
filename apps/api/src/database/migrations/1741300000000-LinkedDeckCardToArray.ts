import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkedDeckCardToArray1741300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert existing singular objects to single-element arrays
    await queryRunner.query(`
      UPDATE collection_cards
      SET linked_deck_card = jsonb_build_array(linked_deck_card)
      WHERE linked_deck_card IS NOT NULL
        AND jsonb_typeof(linked_deck_card) = 'object'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Convert arrays back to singular objects (takes first element)
    await queryRunner.query(`
      UPDATE collection_cards
      SET linked_deck_card = linked_deck_card->0
      WHERE linked_deck_card IS NOT NULL
        AND jsonb_typeof(linked_deck_card) = 'array'
        AND jsonb_array_length(linked_deck_card) > 0
    `);

    // Set empty arrays to null
    await queryRunner.query(`
      UPDATE collection_cards
      SET linked_deck_card = NULL
      WHERE linked_deck_card IS NOT NULL
        AND jsonb_typeof(linked_deck_card) = 'array'
        AND jsonb_array_length(linked_deck_card) = 0
    `);
  }
}
