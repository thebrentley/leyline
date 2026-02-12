import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Pod } from './pod.entity';
import { User } from './user.entity';
import { EventOfflineRsvp } from './event-offline-rsvp.entity';

@Entity('pod_offline_members')
export class PodOfflineMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pod_id' })
  podId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'added_by_id' })
  addedById: string;

  @Column({ name: 'linked_user_id', nullable: true })
  linkedUserId: string | null;

  @Column({ name: 'linked_at', type: 'timestamp with time zone', nullable: true })
  linkedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Pod, (pod) => pod.offlineMembers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pod_id' })
  pod: Pod;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'added_by_id' })
  addedBy: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_user_id' })
  linkedUser: User | null;

  @OneToMany(() => EventOfflineRsvp, (rsvp) => rsvp.offlineMember, { cascade: true })
  rsvps: EventOfflineRsvp[];
}
