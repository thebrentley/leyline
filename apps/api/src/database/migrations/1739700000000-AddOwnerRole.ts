import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOwnerRole1739700000000 implements MigrationInterface {
  name = 'AddOwnerRole1739700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update pod creator memberships to owner role
    // Find pod creators by matching pod.created_by_id with pod_members.user_id
    await queryRunner.query(`
      UPDATE "pod_members" pm
      SET "role" = 'owner'
      FROM "pods" p
      WHERE pm.pod_id = p.id
        AND pm.user_id = p.created_by_id
        AND pm.role = 'admin'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert owner roles back to admin
    await queryRunner.query(`
      UPDATE "pod_members"
      SET "role" = 'admin'
      WHERE "role" = 'owner'
    `);
  }
}
