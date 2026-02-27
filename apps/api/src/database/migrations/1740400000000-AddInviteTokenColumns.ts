import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInviteTokenColumns1740400000000 implements MigrationInterface {
  name = 'AddInviteTokenColumns1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make invitee_id nullable for email-only invites
    await queryRunner.query(`
      ALTER TABLE "pod_invites"
        ALTER COLUMN "invitee_id" DROP NOT NULL
    `);

    // Add new columns
    await queryRunner.query(`
      ALTER TABLE "pod_invites"
        ADD COLUMN "invite_token" varchar UNIQUE,
        ADD COLUMN "token_expires_at" timestamp,
        ADD COLUMN "invitee_email" varchar
    `);

    // Index for fast token lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_pod_invites_invite_token"
        ON "pod_invites" ("invite_token")
        WHERE "invite_token" IS NOT NULL
    `);

    // Partial unique index: one pending invite per email per pod
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_pod_invites_pod_email_pending"
        ON "pod_invites" ("pod_id", "invitee_email")
        WHERE "invitee_email" IS NOT NULL AND "status" = 'pending'
    `);

    // Drop the old unique index on (pod_id, invitee_id) since invitee_id is now nullable
    // and replace with a partial unique index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pod_invites_podId_inviteeId"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_pod_invites_pod_invitee_pending"
        ON "pod_invites" ("pod_id", "invitee_id")
        WHERE "invitee_id" IS NOT NULL AND "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pod_invites_pod_invitee_pending"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pod_invites_pod_email_pending"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pod_invites_invite_token"`);
    await queryRunner.query(`
      ALTER TABLE "pod_invites"
        DROP COLUMN IF EXISTS "invite_token",
        DROP COLUMN IF EXISTS "token_expires_at",
        DROP COLUMN IF EXISTS "invitee_email"
    `);
    await queryRunner.query(`
      ALTER TABLE "pod_invites"
        ALTER COLUMN "invitee_id" SET NOT NULL
    `);
    // Recreate original unique index
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_pod_invites_podId_inviteeId"
        ON "pod_invites" ("pod_id", "invitee_id")
    `);
  }
}
