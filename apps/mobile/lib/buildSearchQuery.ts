import type { NumericFilterValue } from '~/components/filters/PowerToughnessFilter';
import type { ColorMode } from '~/components/filters/ColorFilter';

export interface AdvancedSearchFilters {
  name: string;
  colors: string[];
  colorMode: ColorMode;
  multicolor: boolean;
  colorless: boolean;
  rarities: string[];
  minMv?: number;
  maxMv?: number;
  cardTypes: string[];
  oracleTexts: string[];
  power?: NumericFilterValue;
  toughness?: NumericFilterValue;
  setCodes: string[];
}

export const EMPTY_ADVANCED_FILTERS: AdvancedSearchFilters = {
  name: '',
  colors: [],
  colorMode: 'color',
  multicolor: false,
  colorless: false,
  rarities: [],
  minMv: undefined,
  maxMv: undefined,
  cardTypes: [],
  oracleTexts: [],
  power: undefined,
  toughness: undefined,
  setCodes: [],
};

const COLOR_TO_ABBREV: Record<string, string> = {
  W: 'w',
  U: 'u',
  B: 'b',
  R: 'r',
  G: 'g',
};

/**
 * Build a Scryfall-syntax query string from structured advanced search filters.
 * Mirrors what the backend SearchParserService expects.
 */
export function buildSearchQuery(filters: AdvancedSearchFilters): string {
  const parts: string[] = [];

  // Card name (plain text, no prefix)
  if (filters.name.trim()) {
    parts.push(filters.name.trim());
  }

  // Colors: c:wub / ci:wub or c:m or c:c
  const colorPrefix = filters.colorMode === 'identity' ? 'ci' : 'c';
  if (filters.colorless) {
    parts.push(`${colorPrefix}:c`);
  } else if (filters.multicolor) {
    parts.push(`${colorPrefix}:m`);
  } else if (filters.colors.length > 0) {
    const abbrevs = filters.colors.map((c) => COLOR_TO_ABBREV[c] || c.toLowerCase()).join('');
    parts.push(`${colorPrefix}:${abbrevs}`);
  }

  // Card types: t:creature t:legendary
  for (const type of filters.cardTypes) {
    const val = type.trim();
    if (!val) continue;
    if (val.includes(' ')) {
      parts.push(`t:"${val}"`);
    } else {
      parts.push(`t:${val}`);
    }
  }

  // Oracle text: o:"draw a card" o:flying
  for (const text of filters.oracleTexts) {
    const val = text.trim();
    if (!val) continue;
    if (val.includes(' ')) {
      parts.push(`o:"${val}"`);
    } else {
      parts.push(`o:${val}`);
    }
  }

  // Mana value: mv>=X, mv<=Y
  if (filters.minMv !== undefined && filters.maxMv !== undefined) {
    if (filters.minMv === filters.maxMv) {
      parts.push(`mv:${filters.minMv}`);
    } else {
      parts.push(`mv>=${filters.minMv}`);
      parts.push(`mv<=${filters.maxMv}`);
    }
  } else if (filters.minMv !== undefined) {
    parts.push(`mv>=${filters.minMv}`);
  } else if (filters.maxMv !== undefined) {
    parts.push(`mv<=${filters.maxMv}`);
  }

  // Rarity: r:rare (multiple become separate tokens)
  for (const rarity of filters.rarities) {
    parts.push(`r:${rarity}`);
  }

  // Power: pow>=3
  if (filters.power?.value) {
    const op = filters.power.operator === '=' ? '' : filters.power.operator;
    parts.push(`pow:${op}${filters.power.value}`);
  }

  // Toughness: tou>=3
  if (filters.toughness?.value) {
    const op = filters.toughness.operator === '=' ? '' : filters.toughness.operator;
    parts.push(`tou:${op}${filters.toughness.value}`);
  }

  // Set codes: s:neo s:mkm
  for (const code of filters.setCodes) {
    parts.push(`s:${code}`);
  }

  return parts.join(' ');
}

/**
 * Parse a Scryfall-syntax query string back into structured advanced search filters.
 * Best-effort: handles the common cases to populate the UI from an existing query.
 */
export function parseQueryToFilters(query: string): AdvancedSearchFilters {
  const filters: AdvancedSearchFilters = { ...EMPTY_ADVANCED_FILTERS, colors: [], rarities: [], cardTypes: [], oracleTexts: [], setCodes: [] };

  if (!query.trim()) return filters;

  // Tokenize respecting quoted strings
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  const nameTokens: string[] = [];

  for (const token of tokens) {
    const colonIdx = token.indexOf(':');

    if (colonIdx > 0) {
      const keyword = token.substring(0, colonIdx).toLowerCase();
      const value = token.substring(colonIdx + 1);

      switch (keyword) {
        case 'c':
        case 'color':
        case 'ci':
        case 'id':
        case 'identity': {
          if (keyword === 'ci' || keyword === 'id' || keyword === 'identity') {
            filters.colorMode = 'identity';
          }
          const colorVal = value.toLowerCase();
          if (colorVal === 'm') {
            filters.multicolor = true;
          } else if (colorVal === 'c') {
            filters.colorless = true;
          } else {
            const colorMap: Record<string, string> = { w: 'W', u: 'U', b: 'B', r: 'R', g: 'G' };
            for (const char of colorVal) {
              if (colorMap[char] && !filters.colors.includes(colorMap[char])) {
                filters.colors.push(colorMap[char]);
              }
            }
          }
          break;
        }
        case 't':
        case 'type': {
          const typeVal = value.replace(/"/g, '');
          if (typeVal && !filters.cardTypes.includes(typeVal)) {
            filters.cardTypes.push(typeVal);
          }
          break;
        }
        case 'o':
        case 'oracle': {
          const oText = value.replace(/"/g, '');
          if (oText && !filters.oracleTexts.includes(oText)) {
            filters.oracleTexts.push(oText);
          }
          break;
        }
        case 'r':
        case 'rarity':
          if (!filters.rarities.includes(value.toLowerCase())) {
            filters.rarities.push(value.toLowerCase());
          }
          break;
        case 's':
        case 'e':
        case 'set':
        case 'edition': {
          const code = value.toLowerCase();
          if (!filters.setCodes.includes(code)) {
            filters.setCodes.push(code);
          }
          break;
        }
        case 'pow':
        case 'power': {
          const powMatch = value.match(/^(>=|<=|>|<)?(.+)$/);
          if (powMatch) {
            filters.power = {
              operator: (powMatch[1] || '=') as any,
              value: powMatch[2],
            };
          }
          break;
        }
        case 'tou':
        case 'toughness': {
          const touMatch = value.match(/^(>=|<=|>|<)?(.+)$/);
          if (touMatch) {
            filters.toughness = {
              operator: (touMatch[1] || '=') as any,
              value: touMatch[2],
            };
          }
          break;
        }
        default:
          nameTokens.push(token);
          break;
      }
    } else {
      // Handle mv>=, mv<=, etc. (no colon, uses comparison operators)
      const mvMatch = token.match(/^(mv|cmc|manavalue)(>=|<=|>|<|=)?(\d+)$/i);
      if (mvMatch) {
        const op = mvMatch[2] || '=';
        const num = parseInt(mvMatch[3], 10);
        if (op === '>=' || op === '>') {
          filters.minMv = num;
        } else if (op === '<=' || op === '<') {
          filters.maxMv = num;
        } else {
          filters.minMv = num;
          filters.maxMv = num;
        }
      } else {
        nameTokens.push(token);
      }
    }
  }

  if (nameTokens.length > 0) {
    filters.name = nameTokens.join(' ').replace(/"/g, '');
  }

  return filters;
}
