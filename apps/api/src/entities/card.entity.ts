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
  @PrimaryColumn({ name: 'scryfall_id' })
  scryfallId: string;

  @Column()
  name: string;

  @Column({ name: 'set_code' })
  setCode: string;

  @Column({ name: 'collector_number' })
  collectorNumber: string;

  @Column({ name: 'set_name' })
  setName: string;

  @Column({ name: 'mana_cost', type: 'varchar', nullable: true })
  manaCost: string | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  cmc: number | null;

  @Column({ name: 'type_line' })
  typeLine: string;

  @Column({ name: 'oracle_text', type: 'text', nullable: true })
  oracleText: string | null;

  @Column({ type: 'text', array: true, default: [] })
  colors: string[]; // W, U, B, R, G

  @Column({ name: 'color_identity', type: 'text', array: true, default: [] })
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
  @Column({ name: 'image_normal', type: 'text', nullable: true })
  imageNormal: string | null;

  @Column({ name: 'image_small', type: 'text', nullable: true })
  imageSmall: string | null;

  @Column({ name: 'image_art_crop', type: 'text', nullable: true })
  imageArtCrop: string | null;

  @Column({ name: 'image_png', type: 'text', nullable: true })
  imagePng: string | null;

  // Prices (updated periodically)
  @Column({ name: 'price_usd', type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceUsd: number | null;

  @Column({ name: 'price_usd_foil', type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceUsdFoil: number | null;

  // For double-faced cards
  @Column({ type: 'varchar', nullable: true })
  layout: string | null; // normal, transform, modal_dfc, etc.

  @Column({ name: 'card_faces', type: 'jsonb', nullable: true })
  cardFaces: object | null; // Store both faces for DFCs

  // Cache metadata
  @CreateDateColumn({ name: 'fetched_at' })
  fetchedAt: Date;

  @Column({ name: 'prices_updated_at', type: 'timestamp', nullable: true })
  pricesUpdatedAt: Date | null;

  // Relations
  @OneToMany(() => DeckCard, (dc) => dc.card)
  deckCards: DeckCard[];

  @OneToMany(() => CollectionCard, (cc) => cc.card)
  collectionCards: CollectionCard[];
}
