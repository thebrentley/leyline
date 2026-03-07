import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanOrphanedLinkedDeckCards1741200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Null out linkedDeckCard on collection cards where the referenced deck no longer exists
    await queryRunner.query(`
      UPDATE collection_cards
      SET linked_deck_card = NULL
      WHERE linked_deck_card IS NOT NULL
        AND (linked_deck_card->>'deckId') NOT IN (
          SELECT id::text FROM decks
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Cannot restore orphaned links - they pointed to deleted decks
  }
}
