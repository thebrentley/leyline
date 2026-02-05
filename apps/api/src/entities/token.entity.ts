import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Token entity for storing MTG token definitions
 * Tokens are created by spells and abilities during gameplay
 */
@Entity('tokens')
@Index(['name'])
export class Token {
  @PrimaryColumn({ name: 'token_id' })
  tokenId: string; // e.g., "food", "soldier-1-1-white", "beast-3-3-green"

  @Column()
  name: string; // e.g., "Food", "Soldier", "Beast"

  @Column({ name: 'type_line' })
  typeLine: string; // e.g., "Artifact — Food", "Creature — Soldier"

  @Column({ name: 'oracle_text', type: 'text', nullable: true })
  oracleText: string | null;

  @Column({ type: 'text', array: true, default: [] })
  colors: string[]; // W, U, B, R, G

  @Column({ name: 'color_identity', type: 'text', array: true, default: [] })
  colorIdentity: string[];

  @Column({ type: 'varchar', nullable: true })
  power: string | null; // For creature tokens

  @Column({ type: 'varchar', nullable: true })
  toughness: string | null; // For creature tokens

  @Column({ type: 'text', array: true, default: [] })
  keywords: string[]; // ["flying", "haste", "vigilance"]

  // Image URLs from Scryfall
  @Column({ name: 'image_normal', type: 'text', nullable: true })
  imageNormal: string | null;

  @Column({ name: 'image_small', type: 'text', nullable: true })
  imageSmall: string | null;

  @Column({ name: 'image_art_crop', type: 'text', nullable: true })
  imageArtCrop: string | null;

  @Column({ name: 'image_png', type: 'text', nullable: true })
  imagePng: string | null;

  // Scryfall reference for tokens that come from Scryfall
  @Column({ name: 'scryfall_id', type: 'varchar', nullable: true })
  scryfallId: string | null;

  @Column({ name: 'scryfall_oracle_id', type: 'varchar', nullable: true })
  scryfallOracleId: string | null;

  // Cards that can create this token
  @Column({ name: 'created_by', type: 'text', array: true, default: [] })
  createdBy: string[]; // Card names that create this token

  // Metadata
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
