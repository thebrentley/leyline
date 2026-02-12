import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPodCoverImage1739800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'pods',
      new TableColumn({
        name: 'cover_image',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('pods', 'cover_image');
  }
}
