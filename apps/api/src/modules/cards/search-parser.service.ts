import { Injectable } from '@nestjs/common';
import {
  SearchCriteria,
  COLOR_ABBREVIATIONS,
  RARITY_VALUES,
  NON_PLAYABLE_LAYOUTS,
  ComparisonOperator,
  ColorOperator,
} from './dto/search-criteria.dto';

/**
 * Service to parse Scryfall-style search syntax into structured SearchCriteria
 * Supports keywords like c:, t:, o:, mv:, r:, s: with operators
 */
@Injectable()
export class SearchParserService {
  /**
   * Parse a Scryfall-syntax query string into SearchCriteria
   * Example: "c:r t:dragon mv>=4 r:rare"
   */
  parse(query: string): SearchCriteria {
    console.log('[SearchParser] Parsing query:', query);

    if (!query || query.trim() === '') {
      return {
        excludeLayouts: NON_PLAYABLE_LAYOUTS,
        rawQuery: query,
      };
    }

    const criteria: SearchCriteria = {
      excludeLayouts: NON_PLAYABLE_LAYOUTS,
      rawQuery: query,
    };

    // Tokenize query respecting quoted strings
    const tokens = this.tokenize(query);

    // Track non-keyword text for name search
    const nameTokens: string[] = [];

    for (const token of tokens) {
      // Check if token contains a keyword prefix
      const colonIndex = token.indexOf(':');

      if (colonIndex > 0) {
        const keyword = token.substring(0, colonIndex).toLowerCase();
        const value = token.substring(colonIndex + 1);

        switch (keyword) {
          case 'c':
          case 'color':
          case 'ci':
          case 'id':
          case 'identity':
            this.parseColor(value, criteria);
            break;

          case 't':
          case 'type':
            criteria.typeLine = criteria.typeLine || [];
            criteria.typeLine.push(value.replace(/"/g, ''));
            break;

          case 'o':
          case 'oracle':
            criteria.oracleText = criteria.oracleText || [];
            criteria.oracleText.push(value.replace(/"/g, '')); // Remove quotes
            break;

          case 'mv':
          case 'cmc':
          case 'manavalue':
            this.parseNumeric(value, 'cmc', criteria);
            break;

          case 'r':
          case 'rarity':
            this.parseRarity(value, criteria);
            break;

          case 's':
          case 'e':
          case 'set':
          case 'edition':
            this.parseSet(value, criteria);
            break;

          case 'pow':
          case 'power':
            this.parseNumeric(value, 'power', criteria);
            break;

          case 'tou':
          case 'toughness':
            this.parseNumeric(value, 'toughness', criteria);
            break;

          case 'loy':
          case 'loyalty':
            this.parseNumeric(value, 'loyalty', criteria);
            break;

          case 'usd':
            this.parseNumeric(value, 'priceUsd', criteria);
            break;

          case 'cn':
          case 'number':
            criteria.collectorNumber = value;
            break;

          default:
            // Unknown keyword, treat as name search
            nameTokens.push(token);
            break;
        }
      } else if (token.startsWith('is:')) {
        // Handle is: prefix (layout types, special flags)
        const value = token.substring(3).toLowerCase();
        this.parseIsKeyword(value, criteria);
      } else {
        // No keyword prefix, treat as name search
        nameTokens.push(token);
      }
    }

    // Combine name tokens into name search
    if (nameTokens.length > 0) {
      criteria.name = nameTokens.join(' ').replace(/"/g, '');
    }

    console.log('[SearchParser] Parsed criteria:', JSON.stringify(criteria, null, 2));
    return criteria;
  }

  /**
   * Tokenize query string respecting quoted strings
   * Example: 'c:r "draw a card" mv>=3' => ['c:r', '"draw a card"', 'mv>=3']
   */
  private tokenize(query: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ' ' && !inQuotes) {
        if (current.trim()) {
          tokens.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      tokens.push(current.trim());
    }

    return tokens;
  }

  /**
   * Parse color syntax: c:w, c:wu, c:wubgr, c>=2, c:m (multicolor), c:c (colorless)
   */
  private parseColor(value: string, criteria: SearchCriteria): void {
    console.log('[SearchParser] Parsing color value:', value);

    // Check for operator prefix (>=, <=, >, <, =, !=)
    const operatorMatch = value.match(/^(>=|<=|>|<|!=|=|:)?(.+)$/);
    const operator = (operatorMatch?.[1] || ':') as ColorOperator;
    const colorValue = operatorMatch?.[2] || value;

    console.log('[SearchParser] Color operator:', operator, 'colorValue:', colorValue);

    // Handle special cases: multicolor (m) and colorless (c)
    if (colorValue.toLowerCase() === 'm') {
      criteria.colorIdentity = {
        values: [],
        operator: ':',
        isMulticolor: true,
      };
      return;
    }

    if (colorValue.toLowerCase() === 'c') {
      criteria.colorIdentity = {
        values: [],
        operator: ':',
        isColorless: true,
      };
      return;
    }

    // Handle numeric color count: c>=2, c=3
    if (/^\d+$/.test(colorValue)) {
      const count = parseInt(colorValue, 10);
      // This will be handled in query builder by checking array length
      criteria.colorIdentity = {
        values: [],
        operator,
        isMulticolor: count >= 2,
      };
      return;
    }

    // Parse color abbreviations: w, wu, wubgr, red, blue, etc.
    const colors = this.parseColorAbbreviations(colorValue);

    if (colors.length > 0) {
      criteria.colorIdentity = {
        values: colors,
        operator,
      };
    }
  }

  /**
   * Parse color abbreviations into array of color codes
   * Examples: "w" => ["W"], "wu" => ["W", "U"], "red" => ["R"]
   */
  private parseColorAbbreviations(value: string): string[] {
    const lowerValue = value.toLowerCase();
    const colors: string[] = [];

    // Check for full color names
    const colorNames: Record<string, string> = {
      white: 'W',
      blue: 'U',
      black: 'B',
      red: 'R',
      green: 'G',
      colorless: 'C',
    };

    if (colorNames[lowerValue]) {
      return [colorNames[lowerValue]];
    }

    // Parse abbreviations character by character
    for (const char of lowerValue) {
      const color = COLOR_ABBREVIATIONS[char];
      if (color && color !== 'M' && color !== 'C') {
        if (!colors.includes(color)) {
          colors.push(color);
        }
      }
    }

    return colors.sort(); // Canonical WUBRG order
  }

  /**
   * Parse numeric comparison: mv>=3, pow<=5, usd<10
   */
  private parseNumeric(
    value: string,
    field: 'cmc' | 'power' | 'toughness' | 'loyalty' | 'priceUsd',
    criteria: SearchCriteria,
  ): void {
    // Extract operator and numeric value
    const match = value.match(/^(>=|<=|>|<|!=|=)?(.+)$/);
    const operator = (match?.[1] || '=') as ComparisonOperator;
    const numValue = match?.[2] || value;

    // Try to parse as number
    const parsed = parseFloat(numValue);
    if (!isNaN(parsed)) {
      criteria[field] = { value: parsed, operator };
    } else if (field === 'power' || field === 'toughness') {
      // Power/toughness can be strings like '*', 'X', '1+*'
      criteria[field] = { value: numValue, operator };
    }
  }

  /**
   * Parse rarity: r:rare, r:mythic
   */
  private parseRarity(value: string, criteria: SearchCriteria): void {
    const lowerValue = value.toLowerCase();

    // Check if it's a valid rarity
    if (RARITY_VALUES.includes(lowerValue as any)) {
      criteria.rarity = criteria.rarity || [];
      if (!criteria.rarity.includes(lowerValue)) {
        criteria.rarity.push(lowerValue);
      }
    }
  }

  /**
   * Parse set code: s:neo, s:mkm
   */
  private parseSet(value: string, criteria: SearchCriteria): void {
    const lowerValue = value.toLowerCase();
    criteria.setCode = criteria.setCode || [];
    if (!criteria.setCode.includes(lowerValue)) {
      criteria.setCode.push(lowerValue);
    }
  }

  /**
   * Parse is: keywords like is:transform, is:mdfc, is:modal
   */
  private parseIsKeyword(value: string, criteria: SearchCriteria): void {
    const layoutMappings: Record<string, string> = {
      transform: 'transform',
      tdfc: 'transform',
      mdfc: 'modal_dfc',
      modal: 'modal_dfc',
      split: 'split',
      flip: 'flip',
      leveler: 'leveler',
      saga: 'saga',
      adventure: 'adventure',
      normal: 'normal',
    };

    const layout = layoutMappings[value];
    if (layout) {
      criteria.layout = criteria.layout || [];
      if (!criteria.layout.includes(layout)) {
        criteria.layout.push(layout);
      }
    }
  }
}
