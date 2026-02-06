import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Deck } from './deck.entity';

export interface VersionColorTag {
  id: string;
  name: string;
  color: string;
}

export interface VersionCard {
  name: string;
  scryfallId: string;
  quantity: number;
  // New format: { id, name, color } object; old format: string (hex) or null
  colorTag: VersionColorTag | string | null;
  isCommander: boolean;
  categories: string[];
}

@Entity('deck_versions')
export class DeckVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'deck_id' })
  deckId: string;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'change_type', type: 'varchar' })
  changeType: 'sync' | 'manual' | 'advisor' | 'revert';

  @Column({ type: 'jsonb' })
  cards: VersionCard[];

  @Column({ name: 'color_tags', type: 'jsonb', default: [] })
  colorTags: VersionColorTag[];

  @Column({ name: 'card_count', type: 'int' })
  cardCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Deck, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck: Deck;
}
