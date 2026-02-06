import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { DeckCard } from './deck-card.entity';
import { ChatSession } from './chat-session.entity';
import { ColorTag } from './color-tag.entity';

export type DeckSyncStatus = 'waiting' | 'syncing' | 'synced' | 'error';

@Entity('decks')
export class Deck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'archidekt_id', type: 'int', nullable: true })
  archidektId: number | null;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  format: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'last_synced_at', type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'sync_status', type: 'varchar', default: 'waiting' })
  syncStatus: DeckSyncStatus;

  @Column({ name: 'sync_error', type: 'text', nullable: true })
  syncError: string | null;

  @OneToMany(() => ColorTag, (tag) => tag.deck, { cascade: true })
  colorTags: ColorTag[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.decks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => DeckCard, (card) => card.deck, { cascade: true })
  cards: DeckCard[];

  @OneToMany(() => ChatSession, (session) => session.deck)
  chatSessions: ChatSession[];
}
