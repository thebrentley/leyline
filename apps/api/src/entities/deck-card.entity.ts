import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Deck } from './deck.entity';
import { Card } from './card.entity';

@Entity('deck_cards')
@Index(['deckId', 'scryfallId'], { unique: true })
export class DeckCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  deckId: string;

  @Column()
  scryfallId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  colorTag: string | null;

  @Column({ type: 'text', array: true, default: [] })
  categories: string[]; // mainboard, sideboard, commander

  @Column({ type: 'boolean', default: false })
  isCommander: boolean;

  @ManyToOne(() => Deck, (deck) => deck.cards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deckId' })
  deck: Deck;

  @ManyToOne(() => Card, (card) => card.deckCards, { eager: true })
  @JoinColumn({ name: 'scryfallId', referencedColumnName: 'scryfallId' })
  card: Card;
}
