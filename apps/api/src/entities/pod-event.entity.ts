import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Pod } from './pod.entity';
import { User } from './user.entity';
import { EventRsvp } from './event-rsvp.entity';
import { EventOfflineRsvp } from './event-offline-rsvp.entity';

export type EventStatus = 'upcoming' | 'completed';

@Entity('pod_events')
export class PodEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pod_id' })
  podId: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ name: 'starts_at', type: 'timestamp with time zone' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamp with time zone', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'varchar', default: 'upcoming' })
  status: EventStatus;

  @Column({ name: 'reminder_sent', type: 'boolean', default: false })
  reminderSent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Pod, (pod) => pod.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pod_id' })
  pod: Pod;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @OneToMany(() => EventRsvp, (rsvp) => rsvp.event, { cascade: true })
  rsvps: EventRsvp[];

  @OneToMany(() => EventOfflineRsvp, (rsvp) => rsvp.event, { cascade: true })
  offlineRsvps: EventOfflineRsvp[];
}
