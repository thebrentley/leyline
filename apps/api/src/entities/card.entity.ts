import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { DeckCard } from './deck-card.entity';
import { CollectionCard } from './collection-card.entity';

@Entity('cards')
@Index(['name'])
@Index(['setCode', 'collectorNumber'], { unique: true })
export class Card {
  @PrimaryColumn()
  scryfallId: string;

  @Column()
  name: string;

  @Column()
  setCode: string;

  @Column()
  collectorNumber: string;

  @Column()
  setName: string;

  @Column({ type: 'varchar', nullable: true })
  manaCost: string | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  cmc: number | null;

  @Column()
  typeLine: string;

  @Column({ type: 'text', nullable: true })
  oracleText: string | null;

  @Column({ type: 'text', array: true, default: [] })
  colors: string[]; // W, U, B, R, G

  @Column({ type: 'text', array: true, default: [] })
  colorIdentity: string[];

  @Column({ type: 'varchar', nullable: true })
  power: string | null;

  @Column({ type: 'varchar', nullable: true })
  toughness: string | null;

  @Column({ type: 'varchar', nullable: true })
  loyalty: string | null;

  @Column()
  rarity: string; // common, uncommon, rare, mythic

  // Image URLs from Scryfall
  @Column({ type: 'text', nullable: true })
  imageNormal: string | null;

  @Column({ type: 'text', nullable: true })
  imageSmall: string | null;

  @Column({ type: 'text', nullable: true })
  imageArtCrop: string | null;

  @Column({ type: 'text', nullable: true })
  imagePng: string | null;

  // Prices (updated periodically)
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceUsd: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceUsdFoil: number | null;

  // For double-faced cards
  @Column({ type: 'varchar', nullable: true })
  layout: string | null; // normal, transform, modal_dfc, etc.

  @Column({ type: 'jsonb', nullable: true })
  cardFaces: object | null; // Store both faces for DFCs

  // Cache metadata
  @CreateDateColumn()
  fetchedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  pricesUpdatedAt: Date | null;

  // Relations
  @OneToMany(() => DeckCard, (dc) => dc.card)
  deckCards: DeckCard[];

  @OneToMany(() => CollectionCard, (cc) => cc.card)
  collectionCards: CollectionCard[];
}
