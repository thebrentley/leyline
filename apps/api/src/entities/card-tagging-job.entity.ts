import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type TaggingJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

@Entity('card_tagging_jobs')
export class CardTaggingJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: TaggingJobStatus;

  @Column({ name: 'total_cards', type: 'int' })
  totalCards: number;

  @Column({ name: 'processed_cards', type: 'int', default: 0 })
  processedCards: number;

  @Column({ name: 'failed_cards', type: 'int', default: 0 })
  failedCards: number;

  @Column({ name: 'last_processed_name', type: 'varchar', nullable: true })
  lastProcessedName: string | null;

  @Column({ name: 'batch_size', type: 'int', default: 25 })
  batchSize: number;

  @Column({ name: 'tag_version', type: 'int', default: 1 })
  tagVersion: number;

  @Column({ name: 'error_log', type: 'jsonb', nullable: true })
  errorLog: Array<{ cardName: string; error: string; timestamp: string }> | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
