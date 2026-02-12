import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PodEvent } from './pod-event.entity';
import { PodOfflineMember } from './pod-offline-member.entity';
import { User } from './user.entity';
import { RsvpStatus } from './event-rsvp.entity';

@Entity('event_offline_rsvps')
@Index(['eventId', 'offlineMemberId'], { unique: true })
export class EventOfflineRsvp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @Column({ name: 'offline_member_id' })
  offlineMemberId: string;

  @Column({ type: 'varchar' })
  status: RsvpStatus;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'set_by_id' })
  setById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => PodEvent, (event) => event.offlineRsvps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: PodEvent;

  @ManyToOne(() => PodOfflineMember, (member) => member.rsvps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offline_member_id' })
  offlineMember: PodOfflineMember;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'set_by_id' })
  setBy: User;
}
