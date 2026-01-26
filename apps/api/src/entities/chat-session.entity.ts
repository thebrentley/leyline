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

  @Column()
  userId: string;

  @Column()
  deckId: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb', default: [] })
  messages: ChatMessage[];

  @Column({ type: 'jsonb', default: [] })
  pendingChanges: DeckChange[];

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.chatSessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Deck, (deck) => deck.chatSessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deckId' })
  deck: Deck;
}
