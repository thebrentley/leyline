import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Pod } from './pod.entity';
import { User } from './user.entity';

export type InviteStatus = 'pending' | 'accepted' | 'declined';

@Entity('pod_invites')
export class PodInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pod_id' })
  podId: string;

  @Column({ name: 'inviter_id' })
  inviterId: string;

  @Column({ name: 'invitee_id', nullable: true })
  inviteeId: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status: InviteStatus;

  @Column({ name: 'invite_token', type: 'varchar', nullable: true, unique: true })
  inviteToken: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamp', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ name: 'invitee_email', type: 'varchar', nullable: true })
  inviteeEmail: string | null;

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

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'invitee_id' })
  invitee: User;
}
