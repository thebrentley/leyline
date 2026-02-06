import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { SnakeNamingStrategy } from './snake-naming.strategy';
import {
  InitialSchema1769481839420,
  CamelToSnakeCase1769532303427,
  MakeArchidektIdNullable1738095600000,
  CreateSettingsTable1738200000000,
  AddCommanderAnalysis1738300000000,
  ColorTagsToEntity1738400000000,
} from './migrations';

config();

// All migrations in chronological order
export const migrations = [
  InitialSchema1769481839420,
  CamelToSnakeCase1769532303427,
  MakeArchidektIdNullable1738095600000,
  CreateSettingsTable1738200000000,
  AddCommanderAnalysis1738300000000,
  ColorTagsToEntity1738400000000,
];

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/entities/*.entity.ts'],
  migrations,
  migrationsRun: true, // Auto-run pending migrations on startup
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  // IMPORTANT: Only enable this AFTER running the CamelToSnakeCase migration!
  // namingStrategy: new SnakeNamingStrategy(),
});
