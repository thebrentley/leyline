import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type {
  FullPlaytestGameState,
  PlayerId,
  ExtendedGameCard,
} from '@decktutor/shared';
import { SearchService } from './search.service';

/**
 * Response from LLM for land selection
 */
interface LandSelectionResponse {
  selectedLandId: string;
  reasoning?: string;
}

/**
 * Service for intelligent land selection using LLM
 * Used by effects like Many Partings, Cultivate, etc.
 */
@Injectable()
export class LandSelectionService {
  private anthropic: Anthropic | null = null;

  constructor(
    private configService: ConfigService,
    private searchService: SearchService,
  ) {
    const apiKey = this.configService.get('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      console.warn('[LandSelection] ANTHROPIC_API_KEY not configured');
    }
  }

  /**
   * Select the best basic land from library considering game context
   * @param state - The current game state
   * @param player - The player searching for a land
   * @param availableLandIds - Array of land IDs to choose from
   * @returns The selected land ID, or null if no selection made
   */
  async selectBestLand(
    state: FullPlaytestGameState,
    player: PlayerId,
    availableLandIds: string[],
  ): Promise<string | null> {
    if (availableLandIds.length === 0) {
      return null;
    }

    if (availableLandIds.length === 1) {
      return availableLandIds[0];
    }

    // Check if commander is mono-colored - if so, just pick the first matching land
    const commanderCards = state[player].commandZone
      .map((id) => state.cards[id])
      .filter((c) => c != null);

    if (commanderCards.length > 0) {
      const commander = commanderCards[0];
      const colorIdentity = commander.colorIdentity || [];

      // Mono-colored commander - pick the first land that matches
      if (colorIdentity.length === 1) {
        const monoColor = colorIdentity[0];
        const matchingLand = availableLandIds.find((landId) => {
          const land = state.cards[landId];
          return land && this.landProducesColor(land, monoColor);
        });

        if (matchingLand) {
          console.log(
            `[LandSelection] Mono-color commander (${monoColor}) - selecting first matching land`,
          );
          return matchingLand;
        }
      }
    }

    // Use LLM for intelligent selection
    if (!this.anthropic) {
      console.warn('[LandSelection] LLM not configured, selecting first land');
      return availableLandIds[0];
    }

    try {
      const response = await this.callLLM(state, player, availableLandIds);
      if (response.selectedLandId && availableLandIds.includes(response.selectedLandId)) {
        if (response.reasoning) {
          console.log(`[LandSelection] LLM reasoning: ${response.reasoning}`);
        }
        return response.selectedLandId;
      }
    } catch (error) {
      console.error('[LandSelection] Error calling LLM:', error);
    }

    // Fallback to first land
    return availableLandIds[0];
  }

  /**
   * Check if a land produces a specific color of mana
   */
  private landProducesColor(land: ExtendedGameCard, color: string): boolean {
    // Check land subtypes for basic land types
    const typeLine = land.typeLine?.toLowerCase() || '';

    switch (color) {
      case 'W':
        return typeLine.includes('plains');
      case 'U':
        return typeLine.includes('island');
      case 'B':
        return typeLine.includes('swamp');
      case 'R':
        return typeLine.includes('mountain');
      case 'G':
        return typeLine.includes('forest');
      default:
        return false;
    }
  }

  /**
   * Call Claude API to select the best land
   */
  private async callLLM(
    state: FullPlaytestGameState,
    player: PlayerId,
    availableLandIds: string[],
  ): Promise<LandSelectionResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(state, player, availableLandIds);

    const response = await this.anthropic!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseResponse(text, availableLandIds);
  }

  /**
   * Build system prompt for land selection
   */
  private buildSystemPrompt(): string {
    return `You are a Magic: The Gathering mana base optimization assistant. Your job is to select the best basic land from a player's library to add to their hand.

## Your Role
- Analyze the player's current mana situation
- Consider cards in hand and their mana costs
- Consider lands already on the battlefield
- Consider the commander's mana cost and color requirements
- Select the land that best supports the player's immediate and short-term needs

## Decision Factors (in priority order)
1. **Immediate castability** - Can this land help cast cards currently in hand?
2. **Commander requirements** - Does this help cast or re-cast the commander?
3. **Color balance** - Does this address mana color imbalances?
4. **Curve considerations** - Does this support the player's mana curve?

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "selectedLandId": "<the instanceId of the chosen land>",
  "reasoning": "<brief 1-2 sentence explanation>"
}`;
  }

  /**
   * Build user prompt with game context
   */
  private buildUserPrompt(
    state: FullPlaytestGameState,
    player: PlayerId,
    availableLandIds: string[],
  ): string {
    const playerState = state[player];

    // Get commander info
    const commanderCards = playerState.commandZone
      .map((id) => state.cards[id])
      .filter((c) => c != null);

    const commanderInfo =
      commanderCards.length > 0
        ? commanderCards
            .map(
              (c) =>
                `  - ${c.name} (CMC: ${c.cmc}, Colors: ${c.colorIdentity?.join('') || 'Colorless'}, Cost: ${c.manaCost || 'N/A'})`,
            )
            .join('\n')
        : 'None';

    // Get lands on battlefield
    const landsOnBattlefield = state.battlefieldOrder[player]
      .map((id) => state.cards[id])
      .filter((c) => c && c.typeLine?.includes('Land'));

    const landsSummary =
      landsOnBattlefield.length > 0
        ? landsOnBattlefield.map((c) => `  - ${c.name}`).join('\n')
        : 'None';

    // Get cards in hand with CMC
    const cardsInHand = playerState.handOrder
      .map((id) => state.cards[id])
      .filter((c) => c != null);

    const handSummary =
      cardsInHand.length > 0
        ? cardsInHand
            .map(
              (c) =>
                `  - ${c.name} (CMC: ${c.cmc}, Cost: ${c.manaCost || 'N/A'}, Type: ${c.typeLine})`,
            )
            .join('\n')
        : 'Empty';

    // Get available lands
    const availableLands = availableLandIds
      .map((id) => state.cards[id])
      .filter((c) => c != null);

    const landOptions = availableLands
      .map((c) => `  - ${c.name} (instanceId: ${c.instanceId})`)
      .join('\n');

    return `## Commander
${commanderInfo}

## Lands on Battlefield (${landsOnBattlefield.length} total)
${landsSummary}

## Cards in Hand
${handSummary}

## Available Lands to Choose From
${landOptions}

## Your Task
Select the best land from the available options that will help the player cast their spells and execute their strategy. Consider immediate casting needs, commander requirements, and color balance.

Return your selection as JSON with the selectedLandId and reasoning.`;
  }

  /**
   * Parse LLM response
   */
  private parseResponse(
    text: string,
    availableLandIds: string[],
  ): LandSelectionResponse {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{\s*"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as LandSelectionResponse;

      // Validate the selected land ID exists in available lands
      if (!parsed.selectedLandId || !availableLandIds.includes(parsed.selectedLandId)) {
        throw new Error('Invalid land selection');
      }

      return parsed;
    } catch (error) {
      console.error('[LandSelection] Failed to parse LLM response:', error);
      console.error('[LandSelection] Raw response:', text);
      return { selectedLandId: availableLandIds[0] };
    }
  }
}
