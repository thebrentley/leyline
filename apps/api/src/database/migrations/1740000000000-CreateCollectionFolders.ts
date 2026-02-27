import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCollectionFolders1740000000000 implements MigrationInterface {
  name = 'CreateCollectionFolders1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "collection_folders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_collection_folders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_collection_folders_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_collection_folders_user_name"
        ON "collection_folders" ("user_id", "name")
    `);

    await queryRunner.query(`
      ALTER TABLE "collection_cards"
        ADD COLUMN "folder_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "collection_cards"
        ADD CONSTRAINT "FK_collection_cards_folder"
          FOREIGN KEY ("folder_id")
          REFERENCES "collection_folders"("id")
          ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_collection_cards_folder_id"
        ON "collection_cards" ("folder_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_collection_cards_folder_id"`);
    await queryRunner.query(`ALTER TABLE "collection_cards" DROP CONSTRAINT "FK_collection_cards_folder"`);
    await queryRunner.query(`ALTER TABLE "collection_cards" DROP COLUMN "folder_id"`);
    await queryRunner.query(`DROP INDEX "IDX_collection_folders_user_name"`);
    await queryRunner.query(`DROP TABLE "collection_folders"`);
  }
}
