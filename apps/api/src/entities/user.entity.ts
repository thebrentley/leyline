import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Deck } from './deck.entity';
import { CollectionCard } from './collection-card.entity';
import { ChatSession } from './chat-session.entity';
import { Setting } from './setting.entity';
import { PodMember } from './pod-member.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Local authentication
  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  @Column({ name: 'display_name', type: 'varchar', nullable: true })
  displayName: string | null;

  @Column({ name: 'profile_picture', type: 'text', nullable: true })
  profilePicture: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Deck, (deck) => deck.user)
  decks: Deck[];

  @OneToMany(() => CollectionCard, (card) => card.user)
  collection: CollectionCard[];

  @OneToMany(() => ChatSession, (session) => session.user)
  chatSessions: ChatSession[];

  @OneToMany(() => Setting, (setting) => setting.user)
  settings: Setting[];

  @OneToMany(() => PodMember, (member) => member.user)
  podMemberships: PodMember[];
}
