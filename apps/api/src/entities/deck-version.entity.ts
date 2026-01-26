import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Deck } from './deck.entity';

export interface VersionCard {
  name: string;
  scryfallId: string;
  quantity: number;
  colorTag: string | null;
  isCommander: boolean;
  categories: string[];
}

@Entity('deck_versions')
export class DeckVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  deckId: string;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'varchar' })
  changeType: 'sync' | 'manual' | 'advisor' | 'revert';

  @Column({ type: 'jsonb' })
  cards: VersionCard[];

  @Column({ type: 'jsonb', default: [] })
  colorTags: Array<{ name: string; color: string }>;

  @Column({ type: 'int' })
  cardCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Deck, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deckId' })
  deck: Deck;
}
