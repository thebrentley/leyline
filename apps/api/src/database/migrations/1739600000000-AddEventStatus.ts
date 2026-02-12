import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventStatus1739600000000 implements MigrationInterface {
  name = 'AddEventStatus1739600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pod_events"
      ADD COLUMN "status" varchar NOT NULL DEFAULT 'upcoming'
    `);

    // Mark existing past events as completed
    await queryRunner.query(`
      UPDATE "pod_events"
      SET "status" = 'completed'
      WHERE (
        "ends_at" IS NOT NULL AND "ends_at" < NOW()
      ) OR (
        "ends_at" IS NULL AND "starts_at" < NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pod_events" DROP COLUMN "status"
    `);
  }
}
