import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeArchidektIdNullable1738095600000 implements MigrationInterface {
    name = 'MakeArchidektIdNullable1738095600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Make archidekt_id nullable to support manually created decks
        await queryRunner.query(`ALTER TABLE "decks" ALTER COLUMN "archidekt_id" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert: make archidekt_id NOT NULL again
        await queryRunner.query(`ALTER TABLE "decks" ALTER COLUMN "archidekt_id" SET NOT NULL`);
    }
}
