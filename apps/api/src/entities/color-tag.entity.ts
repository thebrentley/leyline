import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Deck } from './deck.entity';
import { DeckCard } from './deck-card.entity';

@Entity('color_tags')
@Index(['deckId', 'name'], { unique: true })
export class ColorTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'deck_id' })
  deckId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  color: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Deck, (deck) => deck.colorTags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck: Deck;

  @OneToMany(() => DeckCard, (card) => card.colorTagEntity)
  cards: DeckCard[];
}
