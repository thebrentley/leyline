import { DataSource } from "typeorm";
import { config } from "dotenv";
import { SnakeNamingStrategy } from "./snake-naming.strategy";
import {
  InitialSchema1769481839420,
  CamelToSnakeCase1769532303427,
  MakeArchidektIdNullable1738095600000,
  CreateSettingsTable1738200000000,
  AddCommanderAnalysis1738300000000,
  CreateTokensTable1738400000000,
  ColorTagsToEntity1738400000000,
  CreateDeckRankingTables1739000000000,
  AddDeckVisibility1739100000000,
  CreatePodTables1739200000000,
  AddPodVisibility1739300000000,
  CreateOfflineMemberTables1739400000000,
  AddProfilePicture1739500000000,
  AddEventStatus1739600000000,
  AddOwnerRole1739700000000,
  AddPodCoverImage1739800000000,
} from "./migrations";

config();

// All migrations in chronological order
export const migrations = [
  InitialSchema1769481839420,
  CamelToSnakeCase1769532303427,
  MakeArchidektIdNullable1738095600000,
  CreateSettingsTable1738200000000,
  AddCommanderAnalysis1738300000000,
  CreateTokensTable1738400000000,
  ColorTagsToEntity1738400000000,
  CreateDeckRankingTables1739000000000,
  AddDeckVisibility1739100000000,
  CreatePodTables1739200000000,
  AddPodVisibility1739300000000,
  CreateOfflineMemberTables1739400000000,
  AddProfilePicture1739500000000,
  AddEventStatus1739600000000,
  AddOwnerRole1739700000000,
  AddPodCoverImage1739800000000,
];

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: ["src/entities/*.entity.ts"],
  migrations,
  migrationsRun: true, // Auto-run pending migrations on startup
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
  // IMPORTANT: Only enable this AFTER running the CamelToSnakeCase migration!
  // namingStrategy: new SnakeNamingStrategy(),
});
