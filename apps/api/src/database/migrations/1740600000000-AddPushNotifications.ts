import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushNotifications1740600000000 implements MigrationInterface {
  name = 'AddPushNotifications1740600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "device_push_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token" varchar NOT NULL,
        "platform" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_push_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_device_push_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_device_push_tokens_user_token"
        ON "device_push_tokens" ("user_id", "token")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_device_push_tokens_user_id"
        ON "device_push_tokens" ("user_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "pod_events"
        ADD COLUMN "reminder_sent" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pod_events" DROP COLUMN IF EXISTS "reminder_sent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_device_push_tokens_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_device_push_tokens_user_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_push_tokens"`);
  }
}
