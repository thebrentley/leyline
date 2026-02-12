import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOfflineMemberTables1739400000000 implements MigrationInterface {
  name = 'CreateOfflineMemberTables1739400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // pod_offline_members
    await queryRunner.query(`
      CREATE TABLE "pod_offline_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pod_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "email" varchar,
        "notes" text,
        "added_by_id" uuid NOT NULL,
        "linked_user_id" uuid,
        "linked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pod_offline_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pod_offline_members_pod" FOREIGN KEY ("pod_id") REFERENCES "pods"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pod_offline_members_added_by" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pod_offline_members_linked_user" FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pod_offline_members_pod_id" ON "pod_offline_members" ("pod_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pod_offline_members_email" ON "pod_offline_members" ("email")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pod_offline_members_linked_user_id" ON "pod_offline_members" ("linked_user_id")
    `);

    // event_offline_rsvps
    await queryRunner.query(`
      CREATE TABLE "event_offline_rsvps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "offline_member_id" uuid NOT NULL,
        "status" varchar NOT NULL,
        "comment" text,
        "set_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_offline_rsvps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_offline_rsvps_event_member" UNIQUE ("event_id", "offline_member_id"),
        CONSTRAINT "FK_event_offline_rsvps_event" FOREIGN KEY ("event_id") REFERENCES "pod_events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_offline_rsvps_offline_member" FOREIGN KEY ("offline_member_id") REFERENCES "pod_offline_members"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_offline_rsvps_set_by" FOREIGN KEY ("set_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_event_offline_rsvps_event_id" ON "event_offline_rsvps" ("event_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_event_offline_rsvps_offline_member_id" ON "event_offline_rsvps" ("offline_member_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_event_offline_rsvps_offline_member_id"`);
    await queryRunner.query(`DROP INDEX "IDX_event_offline_rsvps_event_id"`);
    await queryRunner.query(`DROP TABLE "event_offline_rsvps"`);
    await queryRunner.query(`DROP INDEX "IDX_pod_offline_members_linked_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_pod_offline_members_email"`);
    await queryRunner.query(`DROP INDEX "IDX_pod_offline_members_pod_id"`);
    await queryRunner.query(`DROP TABLE "pod_offline_members"`);
  }
}
