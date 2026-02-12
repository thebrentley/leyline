import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Deck } from './deck.entity';

export interface AxisScores {
  power: number;
  salt: number;
  fear: number;
  airtime: number;
}

export interface LayerScores {
  cardBaseline: AxisScores;
  tagInteraction: AxisScores;
  combos: AxisScores;
  commander: AxisScores;
  density: AxisScores;
  graph: AxisScores;
}

export interface NotableCards {
  highPower: string[];
  highSalt: string[];
  highFear: string[];
  highAirtime: string[];
  synergyHubs: string[];
  comboCards: string[];
}

export interface DetectedCombo {
  cardNames: string[];
  isGameWinning: boolean;
  pieceCount: number;
  description: string;
}

export interface DetectedEngine {
  cards: string[];
  description: string;
}

@Entity('deck_scores')
@Index(['deckId'], { unique: true })
export class DeckScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'deck_id', type: 'uuid' })
  deckId: string;

  @Column({ type: 'int' })
  power: number;

  @Column({ type: 'int' })
  salt: number;

  @Column({ type: 'int' })
  fear: number;

  @Column({ type: 'int' })
  airtime: number;

  @Column({ name: 'layer_scores', type: 'jsonb' })
  layerScores: LayerScores;

  @Column({ name: 'notable_cards', type: 'jsonb', nullable: true })
  notableCards: NotableCards | null;

  @Column({ name: 'detected_combos', type: 'jsonb', nullable: true })
  detectedCombos: DetectedCombo[] | null;

  @Column({ name: 'detected_engines', type: 'jsonb', nullable: true })
  detectedEngines: DetectedEngine[] | null;

  @Column({ name: 'card_count_at_scoring', type: 'int' })
  cardCountAtScoring: number;

  @Column({ name: 'score_version', type: 'int', default: 1 })
  scoreVersion: number;

  @Column({ name: 'computed_at', type: 'timestamp' })
  computedAt: Date;

  @ManyToOne(() => Deck, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck: Deck;
}
