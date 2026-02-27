import type { DeckCard } from "~/lib/api";

// Color identity colors (background only)
export const MANA_COLORS: Record<string, string> = {
  W: "#F9FAF4",
  U: "#0E68AB",
  B: "#150B00",
  R: "#D3202A",
  G: "#00733E",
};

// Mana colors with text color for mana cost symbols
export const MANA_COLORS_WITH_TEXT: Record<string, { bg: string; text: string }> = {
  W: { bg: "#F9FAF4", text: "#211D15" },
  U: { bg: "#0E68AB", text: "#FFFFFF" },
  B: { bg: "#150B00", text: "#FFFFFF" },
  R: { bg: "#D3202A", text: "#FFFFFF" },
  G: { bg: "#00733E", text: "#FFFFFF" },
};

// Mana pool colors with text and border for pool display
export const MANA_POOL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  W: { bg: "#F9FAF4", text: "#1a1a1a", border: "#e2e8f0" },
  U: { bg: "#0E68AB", text: "#ffffff", border: "#0E68AB" },
  B: { bg: "#150B00", text: "#ffffff", border: "#4a4a4a" },
  R: { bg: "#D3202A", text: "#ffffff", border: "#D3202A" },
  G: { bg: "#00733E", text: "#ffffff", border: "#00733E" },
  C: { bg: "#9ca3af", text: "#1a1a1a", border: "#6b7280" },
};

// View mode options
export type ViewMode = "list" | "grid" | "stacks-text" | "stacks-cards";

export const VIEW_MODE_OPTIONS: {
  value: ViewMode;
  label: string;
  desktopOnly?: boolean;
}[] = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
  { value: "stacks-text", label: "Stacks (text)", desktopOnly: true },
  { value: "stacks-cards", label: "Stacks (cards)", desktopOnly: true },
];

// Group by options
export type GroupBy =
  | "category"
  | "cardType"
  | "color"
  | "cmc"
  | "rarity"
  | "colorTag";

export const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "cardType", label: "Card Type" },
  { value: "color", label: "Color" },
  { value: "cmc", label: "Mana Value" },
  { value: "rarity", label: "Rarity" },
  { value: "colorTag", label: "Color Tag" },
];

export const GROUP_COLORS: Record<GroupBy, Record<string, string>> = {
  category: {
    Commander: "#eab308",
    Mainboard: "#22c55e",
    Sideboard: "#f97316",
  },
  cardType: {
    Creature: "#22c55e",
    Instant: "#3b82f6",
    Sorcery: "#ef4444",
    Enchantment: "#a855f7",
    Artifact: "#78716c",
    Planeswalker: "#f97316",
    Land: "#84cc16",
    Battle: "#ec4899",
    Other: "#64748b",
  },
  color: {
    White: "#F9FAF4",
    Blue: "#0E68AB",
    Black: "#150B00",
    Red: "#D3202A",
    Green: "#00733E",
    Colorless: "#94a3b8",
    Multicolor: "#eab308",
  },
  cmc: {
    "0": "#e2e8f0",
    "1": "#bfdbfe",
    "2": "#93c5fd",
    "3": "#60a5fa",
    "4": "#3b82f6",
    "5": "#2563eb",
    "6": "#1d4ed8",
    "7+": "#1e40af",
  },
  rarity: {
    Common: "#1f2937",
    Uncommon: "#6b7280",
    Rare: "#eab308",
    Mythic: "#ea580c",
  },
  colorTag: {},
};

// Basic land names
export const BASIC_LAND_NAMES = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Plains",
  "Snow-Covered Island",
  "Snow-Covered Swamp",
  "Snow-Covered Mountain",
  "Snow-Covered Forest",
]);

// Helper to check if a card is a basic land
export function isBasicLand(cardName: string): boolean {
  return BASIC_LAND_NAMES.has(cardName);
}

// Basic land display info
export const BASIC_LAND_INFO: Record<
  string,
  { color: string; textColor: string; symbol: string; displayColor: string }
> = {
  Plains: {
    color: "#F9FAF4",
    textColor: "#000",
    symbol: "W",
    displayColor: "#FFF8DC",
  },
  Island: {
    color: "#0E68AB",
    textColor: "#fff",
    symbol: "U",
    displayColor: "#4A9FDF",
  },
  Swamp: {
    color: "#150B00",
    textColor: "#fff",
    symbol: "B",
    displayColor: "#8A7C64",
  },
  Mountain: {
    color: "#D3202A",
    textColor: "#fff",
    symbol: "R",
    displayColor: "#F87171",
  },
  Forest: {
    color: "#00733E",
    textColor: "#fff",
    symbol: "G",
    displayColor: "#4ADE80",
  },
  Wastes: {
    color: "#BFA98A",
    textColor: "#000",
    symbol: "C",
    displayColor: "#BFA98A",
  },
  "Snow-Covered Plains": {
    color: "#F9FAF4",
    textColor: "#000",
    symbol: "W",
    displayColor: "#FFF8DC",
  },
  "Snow-Covered Island": {
    color: "#0E68AB",
    textColor: "#fff",
    symbol: "U",
    displayColor: "#4A9FDF",
  },
  "Snow-Covered Swamp": {
    color: "#150B00",
    textColor: "#fff",
    symbol: "B",
    displayColor: "#8A7C64",
  },
  "Snow-Covered Mountain": {
    color: "#D3202A",
    textColor: "#fff",
    symbol: "R",
    displayColor: "#F87171",
  },
  "Snow-Covered Forest": {
    color: "#00733E",
    textColor: "#fff",
    symbol: "G",
    displayColor: "#4ADE80",
  },
};

// Standard land order for display
export const STANDARD_LAND_ORDER = ["Plains", "Island", "Swamp", "Mountain", "Forest"];

export interface CardSection {
  title: string;
  data: DeckCard[];
}
