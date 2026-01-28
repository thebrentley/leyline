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

  // Archidekt connection (optional, connected after registration)
  @Column({ name: 'archidekt_id', type: 'int', nullable: true, unique: true })
  archidektId: number | null;

  @Column({ name: 'archidekt_username', type: 'text', nullable: true })
  archidektUsername: string | null;

  @Column({ name: 'archidekt_email', type: 'text', nullable: true })
  archidektEmail: string | null; // Email used for Archidekt login

  @Column({ name: 'archidekt_token', type: 'text', nullable: true })
  archidektToken: string | null;

  @Column({ name: 'archidekt_password', type: 'text', nullable: true })
  archidektPassword: string | null; // TODO: encrypt this

  @Column({ name: 'archidekt_connected_at', type: 'timestamp', nullable: true })
  archidektConnectedAt: Date | null;

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

  // Helper to check if Archidekt is connected
  get isArchidektConnected(): boolean {
    return this.archidektId !== null && this.archidektToken !== null;
  }
}
