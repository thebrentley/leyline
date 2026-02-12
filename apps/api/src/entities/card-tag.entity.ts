import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface BaselineScores {
  power: number;
  salt: number;
  fear: number;
  airtime: number;
}

@Entity('card_tags')
@Index(['cardName'], { unique: true })
export class CardTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'card_name', type: 'varchar' })
  cardName: string;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @Column({ name: 'power_baseline', type: 'jsonb', nullable: true })
  powerBaseline: BaselineScores | null;

  @Column({ name: 'tag_version', type: 'int', default: 1 })
  tagVersion: number;

  @Column({ name: 'tagged_at', type: 'timestamp' })
  taggedAt: Date;

  @Column({ name: 'oracle_text_hash', type: 'varchar', nullable: true })
  oracleTextHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
