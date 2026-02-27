import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSystemFlagToEventChat1741100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'event_chat_messages',
      new TableColumn({
        name: 'is_system',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('event_chat_messages', 'is_system');
  }
}
