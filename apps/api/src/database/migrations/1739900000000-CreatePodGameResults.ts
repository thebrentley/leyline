import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePodGameResults1739900000000 implements MigrationInterface {
  name = 'CreatePodGameResults1739900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pod_game_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pod_event_id" uuid NOT NULL,
        "created_by_id" uuid,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ended_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "winner_user_id" uuid,
        "players" jsonb NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pod_game_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pod_game_results_event" FOREIGN KEY ("pod_event_id") REFERENCES "pod_events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pod_game_results_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_pod_game_results_event_id" ON "pod_game_results" ("pod_event_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_pod_game_results_event_id"`);
    await queryRunner.query(`DROP TABLE "pod_game_results"`);
  }
}
