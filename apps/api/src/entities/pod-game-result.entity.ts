import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PodEvent } from './pod-event.entity';
import { User } from './user.entity';

@Entity('pod_game_results')
export class PodGameResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pod_event_id' })
  podEventId: string;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @Column({ name: 'started_at', type: 'timestamp with time zone' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamp with time zone' })
  endedAt: Date;

  @Column({ name: 'winner_user_id', nullable: true })
  winnerUserId: string | null;

  @Column({ type: 'jsonb' })
  players: Array<{
    userId: string | null;
    deckName: string | null;
    deckId: string | null;
    finalLife: number;
    finalPoison: number;
    finalCommanderTax: number;
    commanderDamage: { [playerId: number]: number };
    deathOrder: number | null;
    isWinner: boolean;
  }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => PodEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pod_event_id' })
  podEvent: PodEvent;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;
}
