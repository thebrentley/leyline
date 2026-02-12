import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePodTables1739200000000 implements MigrationInterface {
  name = 'CreatePodTables1739200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // pods
    await queryRunner.query(`
      CREATE TABLE "pods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "description" text,
        "created_by_id" uuid,
        "invite_code" varchar NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pods" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pods_invite_code" UNIQUE ("invite_code"),
        CONSTRAINT "FK_pods_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // pod_members
    await queryRunner.query(`
      CREATE TABLE "pod_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pod_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" varchar NOT NULL DEFAULT 'member',
        "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pod_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pod_members_pod_user" UNIQUE ("pod_id", "user_id"),
        CONSTRAINT "FK_pod_members_pod" FOREIGN KEY ("pod_id") REFERENCES "pods"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pod_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pod_members_user_id" ON "pod_members" ("user_id")
    `);

    // pod_invites
    await queryRunner.query(`
      CREATE TABLE "pod_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pod_id" uuid NOT NULL,
        "inviter_id" uuid NOT NULL,
        "invitee_id" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pod_invites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pod_invites_pod_invitee" UNIQUE ("pod_id", "invitee_id"),
        CONSTRAINT "FK_pod_invites_pod" FOREIGN KEY ("pod_id") REFERENCES "pods"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pod_invites_inviter" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pod_invites_invitee" FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pod_invites_invitee" ON "pod_invites" ("invitee_id")
    `);

    // pod_events
    await queryRunner.query(`
      CREATE TABLE "pod_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pod_id" uuid NOT NULL,
        "created_by_id" uuid,
        "name" varchar NOT NULL,
        "description" text,
        "location" varchar,
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pod_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pod_events_pod" FOREIGN KEY ("pod_id") REFERENCES "pods"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pod_events_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pod_events_pod_id" ON "pod_events" ("pod_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pod_events_starts_at" ON "pod_events" ("starts_at")
    `);

    // event_rsvps
    await queryRunner.query(`
      CREATE TABLE "event_rsvps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" varchar NOT NULL,
        "comment" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_rsvps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_rsvps_event_user" UNIQUE ("event_id", "user_id"),
        CONSTRAINT "FK_event_rsvps_event" FOREIGN KEY ("event_id") REFERENCES "pod_events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_rsvps_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_rsvps"`);
    await queryRunner.query(`DROP INDEX "IDX_pod_events_starts_at"`);
    await queryRunner.query(`DROP INDEX "IDX_pod_events_pod_id"`);
    await queryRunner.query(`DROP TABLE "pod_events"`);
    await queryRunner.query(`DROP INDEX "IDX_pod_invites_invitee"`);
    await queryRunner.query(`DROP TABLE "pod_invites"`);
    await queryRunner.query(`DROP INDEX "IDX_pod_members_user_id"`);
    await queryRunner.query(`DROP TABLE "pod_members"`);
    await queryRunner.query(`DROP TABLE "pods"`);
  }
}
