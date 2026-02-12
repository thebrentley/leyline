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
import { User } from './user.entity';
import { PodMember } from './pod-member.entity';
import { PodInvite } from './pod-invite.entity';
import { PodEvent } from './pod-event.entity';
import { PodOfflineMember } from './pod-offline-member.entity';

@Entity('pods')
export class Pod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'cover_image', type: 'text', nullable: true })
  coverImage: string | null;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ name: 'invite_code', type: 'varchar', unique: true })
  inviteCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @OneToMany(() => PodMember, (member) => member.pod, { cascade: true })
  members: PodMember[];

  @OneToMany(() => PodInvite, (invite) => invite.pod, { cascade: true })
  invites: PodInvite[];

  @OneToMany(() => PodEvent, (event) => event.pod, { cascade: true })
  events: PodEvent[];

  @OneToMany(() => PodOfflineMember, (member) => member.pod, { cascade: true })
  offlineMembers: PodOfflineMember[];
}
