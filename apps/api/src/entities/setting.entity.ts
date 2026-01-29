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
import { User } from './user.entity';

@Entity('settings')
@Index(['userId', 'key'], { unique: true })
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar' })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

// Setting keys for Archidekt connection
export const SETTING_KEYS = {
  ARCHIDEKT_ID: 'archidekt_id',
  ARCHIDEKT_USERNAME: 'archidekt_username',
  ARCHIDEKT_EMAIL: 'archidekt_email',
  ARCHIDEKT_TOKEN: 'archidekt_token',
  ARCHIDEKT_PASSWORD: 'archidekt_password',
  ARCHIDEKT_CONNECTED_AT: 'archidekt_connected_at',
} as const;
