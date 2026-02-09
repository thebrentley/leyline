import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type {
  FullPlaytestGameState,
  PlayerId,
  StackItem,
  ExtendedGameCard,
  PlaytestEvent,
} from '@decktutor/shared';
import { GameEngineService } from './game-engine.service';
import { ActionExecutorService } from './action-executor.service';
import { SpellResolutionCacheService } from './spell-resolution-cache.service';
import type {
  SpellAction,
  LLMSpellResponse,
  TokenUsage,
} from './llm-spell-resolution.types';

/**
 * LLM-based spell resolution service
 * Uses Claude AI to interpret oracle text and resolve spell effects dynamically
 */
@Injectable()
export class LLMSpellResolutionService {
  private anthropic: Anthropic | null = null;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => GameEngineService))
    private gameEngine: GameEngineService,
    private actionExecutor: ActionExecutorService,
    private cache: SpellResolutionCacheService,
  ) {
    const apiKey = this.configService.get('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      console.warn('[LLMSpellResolution] ANTHROPIC_API_KEY not configured');
    }
  }

  /**
   * Resolve a spell using LLM-based interpretation
   */
  async resolveSpell(
    state: FullPlaytestGameState,
    item: StackItem,
    card: ExtendedGameCard,
    controller: PlayerId,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];

    if (!card.oracleText) {
      // No oracle text - nothing to resolve
      return events;
    }

    // Step 1: Check heuristics for simple patterns
    const heuristicActions = this.checkHeuristics(card.oracleText);
    if (heuristicActions) {
      console.log(`[LLMSpellResolution] Heuristic match for ${card.name}`);
      return this.actionExecutor.executeActions(
        heuristicActions,
        state,
        item,
        controller,
      );
    }

    // Step 2: Check cache
    if (this.cache.has(card.name)) {
      const cachedActions = this.cache.get(card.name);
      if (cachedActions) {
        console.log(`[LLMSpellResolution] Cache hit for ${card.name}`);
        return this.actionExecutor.executeActions(
          cachedActions,
          state,
          item,
          controller,
        );
      }
    }

    // Step 3: Use LLM
    if (!this.anthropic) {
      console.warn(`[LLMSpellResolution] LLM not configured, spell ${card.name} fizzles`);
      this.gameEngine.addLogEntry(state, events, {
        type: 'action',
        player: controller,
        message: `Error resolving ${card.name} effect (LLM not configured)`,
      });
      return events;
    }

    try {
      console.log(`[LLMSpellResolution] Calling LLM for ${card.name}`);
      const response = await this.callLLM(card, state, item, controller);

      if (response.actions && response.actions.length > 0) {
        // Cache successful resolution
        this.cache.set(card.name, response.actions);

        // Execute actions
        const actionEvents = await this.actionExecutor.executeActions(
          response.actions,
          state,
          item,
          controller,
        );
        events.push(...actionEvents);

        if (response.reasoning) {
          console.log(`[LLMSpellResolution] Reasoning: ${response.reasoning}`);
        }
      } else {
        console.warn(`[LLMSpellResolution] No actions returned for ${card.name}`);
        this.gameEngine.addLogEntry(state, events, {
          type: 'action',
          player: controller,
          message: `${card.name} resolves with no effect`,
        });
      }
    } catch (error) {
      console.error(`[LLMSpellResolution] Error resolving ${card.name}:`, error);
      this.logApiError(error);
      this.gameEngine.addLogEntry(state, events, {
        type: 'action',
        player: controller,
        message: `Error resolving ${card.name} effect: ${error.message || "Unknown error"}`,
      });
    }

    return events;
  }

  /**
   * Check heuristics for common simple spell patterns
   * Returns actions if matched, null otherwise
   */
  private checkHeuristics(oracleText: string): SpellAction[] | null {
    const text = oracleText.toLowerCase().trim();

    // "Draw N card(s)"
    const drawMatch = text.match(/^draw (\d+) cards?\.?$/);
    if (drawMatch) {
      const count = parseInt(drawMatch[1]);
      return [{ type: 'drawCard', player: 'self', count }];
    }

    // "Deal N damage to any target"
    const damageAnyMatch = text.match(/^deal (\d+) damage to any target\.?$/);
    if (damageAnyMatch) {
      const amount = parseInt(damageAnyMatch[1]);
      return [{ type: 'dealDamage', target: 'creature', targetId: '$TARGET_0', amount }];
    }

    // "Deal N damage to target creature or player"
    const damageCreaturePlayerMatch = text.match(/^deal (\d+) damage to target (?:creature or )?player\.?$/);
    if (damageCreaturePlayerMatch) {
      const amount = parseInt(damageCreaturePlayerMatch[1]);
      return [{ type: 'dealDamage', target: 'creature', targetId: '$TARGET_0', amount }];
    }

    // "Destroy target creature"
    if (text === 'destroy target creature.' || text === 'destroy target creature') {
      return [{ type: 'destroyPermanent', targetId: '$TARGET_0', reason: 'spell effect' }];
    }

    // "Destroy target artifact"
    if (text === 'destroy target artifact.' || text === 'destroy target artifact') {
      return [{ type: 'destroyPermanent', targetId: '$TARGET_0', reason: 'spell effect' }];
    }

    // "Destroy target enchantment"
    if (text === 'destroy target enchantment.' || text === 'destroy target enchantment') {
      return [{ type: 'destroyPermanent', targetId: '$TARGET_0', reason: 'spell effect' }];
    }

    return null; // No heuristic matched
  }

  /**
   * Call Claude API to interpret oracle text
   */
  private async callLLM(
    card: ExtendedGameCard,
    state: FullPlaytestGameState,
    item: StackItem,
    controller: PlayerId,
  ): Promise<LLMSpellResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(card, state, item, controller);

    const response = await this.anthropic!.beta.promptCaching.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }, // Cache for 5 minutes
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Track token usage
    const tokenUsage: TokenUsage = {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      cacheReadInputTokens: (response.usage as any)?.cache_read_input_tokens || 0,
      cacheCreationInputTokens: (response.usage as any)?.cache_creation_input_tokens || 0,
    };

    console.log('[LLMSpellResolution] Token usage:', tokenUsage);

    // Parse response
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseResponse(text);
  }

  /**
   * Build system prompt (cached for efficiency)
   */
  private buildSystemPrompt(): string {
    return `You are a Magic: The Gathering rules engine assistant. Your job is to interpret card oracle text and translate it into a sequence of game actions.

## Your Role
- Parse oracle text and determine the exact sequence of effects
- Follow official MTG rules strictly
- Output structured actions that can be executed by the game engine
- Handle conditional effects, targeting, and modal spells correctly

## Available Actions

You can use these 10 primitive actions:

1. **createToken** - Create token permanents
   Parameters: tokenId OR custom token properties, controller, quantity
   Example: { "type": "createToken", "tokenId": "food", "controller": "self", "quantity": 1 }

2. **searchLibrary** - Search a player's library for cards
   Parameters: player, criteria (supertype, type, subtype, cmc), maxResults, destination, reveal
   Example: { "type": "searchLibrary", "player": "self", "criteria": { "supertype": "Basic", "type": "Land" }, "maxResults": 1, "destination": "hand", "reveal": true }

3. **moveCard** - Move a card between zones (hand, library, battlefield, graveyard, exile)
   Parameters: cardIdentifier, from, to, controller
   Example: { "type": "moveCard", "cardIdentifier": "$SEARCH_RESULT_0", "from": "library", "to": "hand", "controller": "self" }
   Exile example: { "type": "moveCard", "cardIdentifier": "$TARGET_0", "from": "battlefield", "to": "exile", "controller": "opponent" }

4. **dealDamage** - Deal damage to a player or creature
   Parameters: target, targetId (if creature), amount
   Example: { "type": "dealDamage", "target": "opponent", "amount": 3 }
   Example: { "type": "dealDamage", "target": "creature", "targetId": "$TARGET_0", "amount": 3 }

5. **drawCard** - Draw cards
   Parameters: player, count
   Example: { "type": "drawCard", "player": "self", "count": 2 }

6. **destroyPermanent** - Destroy a permanent
   Parameters: targetId, reason
   Example: { "type": "destroyPermanent", "targetId": "$TARGET_0", "reason": "spell effect" }

7. **shuffleLibrary** - Shuffle a player's library
   Parameters: player
   Example: { "type": "shuffleLibrary", "player": "self" }

8. **revealCard** - Reveal a card to all players
   Parameters: cardId, player
   Example: { "type": "revealCard", "cardId": "$SEARCH_RESULT_0", "player": "self" }

9. **logMessage** - Add a message to the game log
   Parameters: message
   Example: { "type": "logMessage", "message": "No basic lands found" }

10. **exileUntilSourceLeaves** - Exile a permanent until the source card leaves the battlefield. Use this for "exile ... until ~ leaves the battlefield" effects (e.g. Banisher Priest, Grasp of Fate, Oblivion Ring). The game engine automatically returns the exiled card when the source leaves.
   Parameters: targetId, controller (of the target being exiled)
   Example: { "type": "exileUntilSourceLeaves", "targetId": "$TARGET_0", "controller": "opponent" }

## Variable Substitution
- Use $TARGET_N to reference spell targets (e.g., $TARGET_0 for first target)
- Use $SEARCH_RESULT_N to reference cards from search actions (e.g., $SEARCH_RESULT_0 for first result)
- Actions execute in array order, so search results are available for later actions

## Action Sequencing Rules
- Always shuffle library AFTER searching (if oracle text says "then shuffle")
- Reveal cards BEFORE moving them to hand (if oracle text says "reveal")
- Use searchLibrary with destination parameter to automatically move found cards

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "actions": [ <array of action objects> ],
  "reasoning": "<brief explanation of your interpretation>" // optional
}

## Important Rules
- Follow oracle text exactly - don't add or remove effects
- "Up to" means the effect is optional or partial (but the action still happens if possible)
- "May" makes the entire effect optional (still include the action, the game engine handles optionality)
- Handle "if you do" conditionals by including the conditional action
- Targets are provided in the spell's stack item (use $TARGET_N to reference them)
- When searching library and moving to hand, use searchLibrary with destination: "hand"
- **CRITICAL: Player references must ALWAYS be "self" or "opponent" (relative to the spell's controller). "self" = the player who cast the spell. "opponent" = the other player. NEVER use literal values like "player" — always use "self" or "opponent".**`;
  }

  /**
   * Build user prompt with game context
   */
  private buildUserPrompt(
    card: ExtendedGameCard,
    state: FullPlaytestGameState,
    item: StackItem,
    controller: PlayerId,
  ): string {
    const opponent = controller === 'player' ? 'opponent' : 'player';

    // Build battlefield summary with card IDs for targeting
    const playerBattlefield = Object.values(state.cards)
      .filter((c) => c.zone === 'battlefield' && c.controller === controller)
      .map((c) => `${c.name} [${c.typeLine}] (id:${c.instanceId})`);

    const opponentBattlefield = Object.values(state.cards)
      .filter((c) => c.zone === 'battlefield' && c.controller === opponent)
      .map((c) => `${c.name} [${c.typeLine}] (id:${c.instanceId})`);

    // Build targets summary
    const targetsDesc = item.targets && item.targets.length > 0
      ? item.targets.map((t, i) => {
          const targetCard = state.cards[t.id];
          return `  - $TARGET_${i}: ${targetCard ? targetCard.name : 'Unknown'} (${t.type})`;
        }).join('\n')
      : 'None';

    return `## Spell to Resolve
**Name:** ${card.name}
**Oracle Text:** "${card.oracleText}"
**Type:** ${card.typeLine}

## Game State Context (from the spell controller's perspective)
Use "self" for the spell controller and "opponent" for the other player. Do NOT use literal player identifiers.
**Self (spell controller) Life:** ${state[controller].life}
**Opponent Life:** ${state[opponent].life}
**Self Hand Size:** ${state[controller].handOrder.length}
**Self Library Size:** ${state[controller].libraryOrder.length}
**Opponent Hand Size:** ${state[opponent].handOrder.length}
**Opponent Library Size:** ${state[opponent].libraryOrder.length}

**Self Battlefield:** ${playerBattlefield.length > 0 ? playerBattlefield.join(', ') : 'Empty'}
**Opponent Battlefield:** ${opponentBattlefield.length > 0 ? opponentBattlefield.join(', ') : 'Empty'}

## Targets
${targetsDesc}

## Your Task
Interpret the oracle text and output the sequence of actions to resolve this spell's effects. Remember: use "self" for the spell controller and "opponent" for the other player. Use variable substitution ($TARGET_N, $SEARCH_RESULT_N) where appropriate.`;
  }

  /**
   * Parse LLM response into structured actions
   */
  private parseResponse(text: string): LLMSpellResponse {
    try {
      // Extract JSON from response (avoiding MTG mana symbols like {G}, {W})
      const jsonMatch = text.match(/\{\s*"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as LLMSpellResponse;

      // Validate response structure
      if (!parsed.actions || !Array.isArray(parsed.actions)) {
        throw new Error('Invalid response structure: missing or invalid actions array');
      }

      return parsed;
    } catch (error) {
      console.error('[LLMSpellResolution] Failed to parse LLM response:', error);
      console.error('[LLMSpellResolution] Raw response:', text);
      return { actions: [] };
    }
  }

  /**
   * Log detailed API error information (Anthropic errors, network errors, etc.)
   */
  private logApiError(error: any): void {
    if (!error) return;

    if (error.status) {
      console.error(
        `[LLMSpellResolution] API Error - Status: ${error.status}, Type: ${error.error?.type || "unknown"}, Message: ${error.error?.message || error.message}`,
      );
      if (error.headers) {
        const retryAfter = error.headers["retry-after"];
        if (retryAfter) {
          console.error(`[LLMSpellResolution] API retry-after: ${retryAfter}s`);
        }
      }
    } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
      console.error(`[LLMSpellResolution] Network Error - Code: ${error.code}, Message: ${error.message}`);
    }
  }
}
