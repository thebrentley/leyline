import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropOfflineMemberPhoneNumber1741000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('pod_offline_members', 'phone_number');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pod_offline_members" ADD "phone_number" varchar`,
    );
  }
}
