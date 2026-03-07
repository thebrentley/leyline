import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuantityToLinkedDeckCards1741400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add quantity: 1 to every link entry that doesn't already have one
    await queryRunner.query(`
      UPDATE collection_cards
      SET linked_deck_card = (
        SELECT jsonb_agg(
          CASE
            WHEN elem ? 'quantity' THEN elem
            ELSE elem || '{"quantity": 1}'::jsonb
          END
        )
        FROM jsonb_array_elements(linked_deck_card) AS elem
      )
      WHERE linked_deck_card IS NOT NULL
        AND jsonb_typeof(linked_deck_card) = 'array'
        AND jsonb_array_length(linked_deck_card) > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Strip the quantity key from every link entry
    await queryRunner.query(`
      UPDATE collection_cards
      SET linked_deck_card = (
        SELECT jsonb_agg(elem - 'quantity')
        FROM jsonb_array_elements(linked_deck_card) AS elem
      )
      WHERE linked_deck_card IS NOT NULL
        AND jsonb_typeof(linked_deck_card) = 'array'
        AND jsonb_array_length(linked_deck_card) > 0
    `);
  }
}
