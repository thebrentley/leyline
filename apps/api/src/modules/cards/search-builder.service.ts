import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { Card } from '../../entities/card.entity';
import { SearchCriteria } from './dto/search-criteria.dto';

/**
 * Service to build TypeORM queries from SearchCriteria
 * Converts structured search criteria into SQL WHERE clauses
 */
@Injectable()
export class SearchBuilderService {
  /**
   * Build a TypeORM query from SearchCriteria
   */
  buildQuery(
    queryBuilder: SelectQueryBuilder<Card>,
    criteria: SearchCriteria,
  ): SelectQueryBuilder<Card> {
    console.log('[SearchBuilder] Building query with criteria:', JSON.stringify(criteria, null, 2));

    // Exclude non-playable card types (tokens, emblems, etc.)
    if (criteria.excludeLayouts && criteria.excludeLayouts.length > 0) {
      queryBuilder.andWhere('card.layout NOT IN (:...excludeLayouts)', {
        excludeLayouts: criteria.excludeLayouts,
      });
    }

    // Name search (partial, case-insensitive)
    if (criteria.name) {
      queryBuilder.andWhere('LOWER(card.name) LIKE LOWER(:name)', {
        name: `%${criteria.name}%`,
      });
    }

    // Oracle text search (partial, case-insensitive)
    if (criteria.oracleText) {
      queryBuilder.andWhere('LOWER(card.oracle_text) LIKE LOWER(:oracleText)', {
        oracleText: `%${criteria.oracleText}%`,
      });
    }

    // Type line search (partial, case-insensitive)
    if (criteria.typeLine) {
      queryBuilder.andWhere('LOWER(card.type_line) LIKE LOWER(:typeLine)', {
        typeLine: `%${criteria.typeLine}%`,
      });
    }

    // Color identity filtering
    if (criteria.colorIdentity) {
      this.applyColorFilter(queryBuilder, criteria.colorIdentity);
    }

    // Mana value (CMC) filtering
    if (criteria.cmc) {
      this.applyNumericFilter(queryBuilder, 'card.cmc', criteria.cmc);
    }

    // Power filtering
    if (criteria.power) {
      this.applyNumericFilter(queryBuilder, 'card.power', criteria.power);
    }

    // Toughness filtering
    if (criteria.toughness) {
      this.applyNumericFilter(queryBuilder, 'card.toughness', criteria.toughness);
    }

    // Loyalty filtering
    if (criteria.loyalty) {
      this.applyNumericFilter(queryBuilder, 'card.loyalty', criteria.loyalty);
    }

    // Price filtering
    if (criteria.priceUsd) {
      this.applyNumericFilter(queryBuilder, 'card.price_usd', criteria.priceUsd);
    }

    // Rarity filtering
    if (criteria.rarity && criteria.rarity.length > 0) {
      queryBuilder.andWhere('card.rarity IN (:...rarities)', {
        rarities: criteria.rarity,
      });
    }

    // Set code filtering
    if (criteria.setCode && criteria.setCode.length > 0) {
      queryBuilder.andWhere('LOWER(card.set_code) IN (:...setCodes)', {
        setCodes: criteria.setCode.map((s) => s.toLowerCase()),
      });
    }

    // Collector number filtering
    if (criteria.collectorNumber) {
      queryBuilder.andWhere('card.collector_number = :collectorNumber', {
        collectorNumber: criteria.collectorNumber,
      });
    }

    // Layout filtering
    if (criteria.layout && criteria.layout.length > 0) {
      queryBuilder.andWhere('card.layout IN (:...layouts)', {
        layouts: criteria.layout,
      });
    }

    return queryBuilder;
  }

  /**
   * Apply color identity filtering using PostgreSQL array operators
   */
  private applyColorFilter(
    queryBuilder: SelectQueryBuilder<Card>,
    colorFilter: NonNullable<SearchCriteria['colorIdentity']>,
  ): void {
    const { values, operator, isMulticolor, isColorless } = colorFilter;

    console.log('[SearchBuilder] Applying color filter:', { values, operator, isMulticolor, isColorless });

    // Handle multicolor (2+ colors)
    if (isMulticolor) {
      queryBuilder.andWhere('array_length(card.color_identity, 1) >= 2');
      return;
    }

    // Handle colorless (0 colors)
    if (isColorless) {
      queryBuilder.andWhere(
        '(card.color_identity = ARRAY[]::text[] OR card.color_identity IS NULL)',
      );
      return;
    }

    // No color values specified
    if (!values || values.length === 0) {
      console.log('[SearchBuilder] No color values specified, skipping color filter');
      return;
    }

    // Sort colors for consistent comparison
    const sortedColors = [...values].sort();
    console.log('[SearchBuilder] Sorted colors:', sortedColors, 'operator:', operator);

    switch (operator) {
      case '=':
        // Exact match: card must have exactly these colors
        queryBuilder.andWhere('card.color_identity = :colors', {
          colors: sortedColors,
        });
        break;

      case ':':
        // Contains: card must include all these colors (but can have more)
        queryBuilder.andWhere('card.color_identity @> :colors', {
          colors: sortedColors,
        });
        break;

      case '<':
      case '<=':
        // Subset: card colors must be subset of these colors
        queryBuilder.andWhere('card.color_identity <@ :colors', {
          colors: sortedColors,
        });
        break;

      case '>':
      case '>=':
        // Superset: card must contain all these colors
        queryBuilder.andWhere('card.color_identity @> :colors', {
          colors: sortedColors,
        });
        break;
    }
  }

  /**
   * Apply numeric comparison filtering
   */
  private applyNumericFilter(
    queryBuilder: SelectQueryBuilder<Card>,
    field: string,
    filter: { value: number | string; operator: string },
  ): void {
    const { value, operator } = filter;

    // Handle string values (for power/toughness like '*', 'X')
    if (typeof value === 'string') {
      if (operator === '=' || operator === ':') {
        queryBuilder.andWhere(`${field} = :value`, { value });
      } else if (operator === '!=') {
        queryBuilder.andWhere(`${field} != :value`, { value });
      }
      return;
    }

    // Numeric comparisons
    switch (operator) {
      case '=':
        queryBuilder.andWhere(`${field} = :value`, { value });
        break;
      case '!=':
        queryBuilder.andWhere(`${field} != :value`, { value });
        break;
      case '<':
        queryBuilder.andWhere(`${field} < :value`, { value });
        break;
      case '<=':
        queryBuilder.andWhere(`${field} <= :value`, { value });
        break;
      case '>':
        queryBuilder.andWhere(`${field} > :value`, { value });
        break;
      case '>=':
        queryBuilder.andWhere(`${field} >= :value`, { value });
        break;
    }
  }
}
