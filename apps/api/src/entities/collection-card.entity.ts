import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Card } from './card.entity';

export interface LinkedDeckCard {
  deckId: string;
  deckName: string;
}

@Entity('collection_cards')
@Index(['userId', 'scryfallId'], { unique: true })
export class CollectionCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'scryfall_id' })
  scryfallId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'foil_quantity', type: 'int', default: 0 })
  foilQuantity: number;

  // Original prices when card was first added to collection (never changes)
  @Column({ name: 'original_price_usd', type: 'decimal', precision: 10, scale: 2, nullable: true })
  originalPriceUsd: number | null;

  @Column({ name: 'original_price_usd_foil', type: 'decimal', precision: 10, scale: 2, nullable: true })
  originalPriceUsdFoil: number | null;

  @Column({ name: 'linked_deck_card', type: 'jsonb', nullable: true })
  linkedDeckCard: LinkedDeckCard | null;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.collection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Card, (card) => card.collectionCards, { eager: true })
  @JoinColumn({ name: 'scryfall_id', referencedColumnName: 'scryfallId' })
  card: Card;
}
