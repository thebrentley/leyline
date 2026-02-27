import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOfflineMemberPhoneNumber1740800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'pod_offline_members',
      new TableColumn({
        name: 'phone_number',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('pod_offline_members', 'phone_number');
  }
}
