import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Deck } from './deck.entity';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedChanges?: DeckChange[];
}

interface DeckChange {
  id: string;
  action: 'add' | 'remove' | 'swap';
  cardName: string;
  targetCardName?: string;
  quantity: number;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
}

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'deck_id' })
  deckId: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb', default: [] })
  messages: ChatMessage[];

  @Column({ name: 'pending_changes', type: 'jsonb', default: [] })
  pendingChanges: DeckChange[];

  @Column({ name: 'commander_analysis', type: 'text', nullable: true })
  commanderAnalysis: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.chatSessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Deck, (deck) => deck.chatSessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck: Deck;
}
