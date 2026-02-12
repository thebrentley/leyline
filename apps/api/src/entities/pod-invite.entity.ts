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
import { Pod } from './pod.entity';
import { User } from './user.entity';

export type InviteStatus = 'pending' | 'accepted' | 'declined';

@Entity('pod_invites')
@Index(['podId', 'inviteeId'], { unique: true })
export class PodInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pod_id' })
  podId: string;

  @Column({ name: 'inviter_id' })
  inviterId: string;

  @Column({ name: 'invitee_id' })
  inviteeId: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: InviteStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Pod, (pod) => pod.invites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pod_id' })
  pod: Pod;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inviter_id' })
  inviter: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitee_id' })
  invitee: User;
}
