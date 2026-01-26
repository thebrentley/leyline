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

export interface ColorTag {
  name: string;
  color: string;
}

export type DeckSyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

@Entity('decks')
export class Deck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  archidektId: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  format: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'varchar', default: 'pending' })
  syncStatus: DeckSyncStatus;

  @Column({ type: 'text', nullable: true })
  syncError: string | null;

  @Column({ type: 'jsonb', default: [] })
  colorTags: ColorTag[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.decks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => DeckCard, (card) => card.deck, { cascade: true })
  cards: DeckCard[];

  @OneToMany(() => ChatSession, (session) => session.deck)
  chatSessions: ChatSession[];
}
