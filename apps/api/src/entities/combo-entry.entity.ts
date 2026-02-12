import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('combo_entries')
export class ComboEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'spellbook_id', type: 'varchar', nullable: true, unique: true })
  spellbookId: string | null;

  @Column({ name: 'card_names', type: 'text', array: true })
  cardNames: string[];

  @Column({ name: 'piece_count', type: 'int' })
  pieceCount: number;

  @Column({ name: 'is_game_winning', type: 'boolean', default: false })
  isGameWinning: boolean;

  @Column({ name: 'requires_commander', type: 'boolean', default: false })
  requiresCommander: boolean;

  @Column({ name: 'color_identity', type: 'text', array: true, default: [] })
  colorIdentity: string[];

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'result_tags', type: 'text', array: true, default: [] })
  resultTags: string[];

  @Column({ name: 'last_synced_at', type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
