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

  @Column()
  userId: string;

  @Column()
  scryfallId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  foilQuantity: number;

  // Original prices when card was first added to collection (never changes)
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  originalPriceUsd: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  originalPriceUsdFoil: number | null;

  @Column({ type: 'jsonb', nullable: true })
  linkedDeckCard: LinkedDeckCard | null;

  @CreateDateColumn()
  addedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.collection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Card, (card) => card.collectionCards, { eager: true })
  @JoinColumn({ name: 'scryfallId', referencedColumnName: 'scryfallId' })
  card: Card;
}
