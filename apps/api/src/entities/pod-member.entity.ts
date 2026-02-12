import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pod } from './pod.entity';
import { User } from './user.entity';

export type PodRole = 'owner' | 'admin' | 'member';

@Entity('pod_members')
@Index(['podId', 'userId'], { unique: true })
export class PodMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pod_id' })
  podId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', default: 'member' })
  role: PodRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @ManyToOne(() => Pod, (pod) => pod.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pod_id' })
  pod: Pod;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
