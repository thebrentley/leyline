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

  @Column({ name: 'deck_id' })
  deckId: string;

  @Column({ name: 'scryfall_id' })
  scryfallId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'color_tag', type: 'varchar', nullable: true })
  colorTag: string | null;

  @Column({ type: 'text', array: true, default: [] })
  categories: string[]; // mainboard, sideboard, commander

  @Column({ name: 'is_commander', type: 'boolean', default: false })
  isCommander: boolean;

  @ManyToOne(() => Deck, (deck) => deck.cards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck: Deck;

  @ManyToOne(() => Card, (card) => card.deckCards, { eager: true })
  @JoinColumn({ name: 'scryfall_id', referencedColumnName: 'scryfallId' })
  card: Card;
}
