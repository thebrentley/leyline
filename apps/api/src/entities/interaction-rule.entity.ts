import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

export type InteractionType = 'synergy' | 'anti-synergy' | 'engine';

export interface AxisModifiers {
  power: number;
  salt: number;
  fear: number;
  airtime: number;
}

@Entity('interaction_rules')
@Index(['tagA', 'tagB'], { unique: true })
export class InteractionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tag_a', type: 'varchar' })
  tagA: string;

  @Column({ name: 'tag_b', type: 'varchar' })
  tagB: string;

  @Column({ type: 'jsonb' })
  modifiers: AxisModifiers;

  @Column({ name: 'interaction_type', type: 'varchar' })
  interactionType: InteractionType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
