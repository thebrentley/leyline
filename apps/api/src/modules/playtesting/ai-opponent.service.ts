import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import type {
  FullPlaytestGameState,
  GameAction,
  PlayerId,
  AIDecision,
  ExtendedGameCard,
  AttackerInfo,
  BlockerInfo,
} from "@decktutor/shared";

@Injectable()
export class AIOpponentService {
  private anthropic: Anthropic | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get("ANTHROPIC_API_KEY");
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  /**
   * Decide what action to take given the current game state
   */
  async decideAction(
    state: FullPlaytestGameState,
    player: PlayerId,
    availableActions: GameAction[],
  ): Promise<AIDecision> {
    if (!this.anthropic) {
      // Fallback: just pass priority if AI not configured
      return {
        action: { type: "pass_priority" },
        reasoning: "AI not configured, passing priority",
      };
    }

    // Check if heuristics can handle this decision
    const heuristicResult = this.getHeuristicAction(availableActions);
    if (heuristicResult) {
      return heuristicResult;
    }

    // Build the decision prompt
    const prompt = this.buildDecisionPrompt(state, player, availableActions);
    const systemPrompt = this.getSystemPrompt();

    console.log("[AI] Decision prompt:", prompt);

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });

      // Parse the response
      const content = response.content[0];
      if (content.type === "text") {
        return this.parseDecision(content.text, availableActions);
      }
    } catch (error) {
      console.error("[AI] Error getting AI decision:", error);
    }

    // Fallback: pass priority
    return {
      action: { type: "pass_priority" },
      reasoning: "Error occurred, passing priority",
    };
  }

  /**
   * Get the system prompt for AI decision making
   */
  private getSystemPrompt(): string {
    return `You are an expert Magic: The Gathering player. You are playing a game and need to decide what action to take.

## Your Objective
Win the game by reducing your opponent's life to 0, dealing 10 poison counters, or making them draw from an empty library.

## Decision Guidelines
When deciding what to do, consider:
1. **Commander Priority** - Casting your commander from the command zone is a high priority when you have the mana. Your deck is built around your commander, so getting it on the battlefield enables your strategy
2. **Card Advantage** - Drawing cards, making opponent discard
3. **Board Presence** - Creatures on battlefield, quality vs quantity
4. **Life Total Pressure** - Your life vs opponent's life
5. **Mana Efficiency** - Using your mana effectively each turn
6. **Timing** - When to hold up mana for responses vs tap out
7. **Threat Assessment** - What threats need answering immediately
8. **Combat Math** - Favorable attacks and blocks
9. **Targeting** - Before casting spells that require targets, verify: (a) valid targets exist, and (b) the target is optimal. Don't cast removal on a weak creature if a bigger threat exists. Don't cast a buff spell if you have no creatures

## Response Format
You MUST respond in valid JSON format:
{
  "actionIndex": <number>,
  "reasoning": "<brief 1-2 sentence explanation>"
}

Where actionIndex is the 0-based index of the action you choose from the available actions list.

## Mana System
To cast spells, you must follow this sequence:
1. **Tap lands** to add mana to your mana pool (each land tap is a separate action)
2. **Cast the spell** once you have enough mana in your pool
Only tap lands when you have a specific spell you intend to cast immediately after. Tap exactly enough lands for that spell's mana cost. Unused mana empties at end of phase.

## Important
- Always choose an action from the available actions
- If unsure, passing priority is usually safe
- Be aggressive when ahead, defensive when behind
- Consider what opponent might do on their turn
- Prioritize casting your commander when you have sufficient mana - it's the centerpiece of your deck
- Before casting targeted spells, ensure optimal targets exist. Pass priority instead of wasting removal on suboptimal targets`;
  }

  /**
   * Build the decision prompt with game state
   */
  private buildDecisionPrompt(
    state: FullPlaytestGameState,
    player: PlayerId,
    availableActions: GameAction[],
  ): string {
    const opponent: PlayerId = player === "player" ? "opponent" : "player";
    const playerState = state[player];
    const opponentState = state[opponent];

    // Build game state summary
    let prompt = `## Current Game State

**Turn ${state.turnNumber}** - ${state.activePlayer === player ? "Your turn" : "Opponent's turn"}
**Phase:** ${state.phase} / ${state.step}
**Priority:** ${state.priorityPlayer === player ? "You have priority" : "Opponent has priority"}

### Life Totals
- You: ${playerState.life} life${playerState.poisonCounters > 0 ? ` (${playerState.poisonCounters} poison)` : ""}
- Opponent: ${opponentState.life} life${opponentState.poisonCounters > 0 ? ` (${opponentState.poisonCounters} poison)` : ""}

### Your Hand (${playerState.handOrder.length} cards)
${this.formatHandCards(state, playerState.handOrder)}

### Your Battlefield
${this.formatBattlefieldCards(state, state.battlefieldOrder[player], player)}

### Opponent's Battlefield
${this.formatBattlefieldCards(state, state.battlefieldOrder[opponent], opponent)}

### Your Mana Available
${this.formatManaAvailable(state, player)}

`;

    // Add stack info if not empty
    if (state.stack.length > 0) {
      prompt += `### The Stack (resolves top to bottom)
${state.stack
  .slice()
  .reverse()
  .map((item, i) => {
    const source = state.cards[item.sourceCardId];
    if (item.type === "spell") {
      return `${i + 1}. ${item.cardName || source?.name || "Unknown"} (${item.controller === player ? "yours" : "opponent's"})`;
    } else {
      return `${i + 1}. Ability: ${item.abilityText || "unknown"} from ${source?.name || "unknown"} (${item.controller === player ? "yours" : "opponent's"})`;
    }
  })
  .join("\n")}

`;
    }

    // Add combat info if in combat
    if (state.combat.isActive) {
      prompt += `### Combat
`;
      if (state.combat.attackers.length > 0) {
        prompt += `Attackers: ${state.combat.attackers
          .map((a) => {
            const card = state.cards[a.cardId];
            return `${card?.name || "Unknown"} (${card?.power}/${card?.toughness})`;
          })
          .join(", ")}\n`;
      }
      if (state.combat.blockers.length > 0) {
        prompt += `Blockers: ${state.combat.blockers
          .map((b) => {
            const blocker = state.cards[b.cardId];
            const attacker = state.cards[b.blockingAttackerId];
            return `${blocker?.name || "Unknown"} blocking ${attacker?.name || "Unknown"}`;
          })
          .join(", ")}\n`;
      }
      prompt += "\n";
    }

    // Add available actions
    prompt += `## Available Actions
Choose ONE action by responding with its index (0-based):

${availableActions
  .map((action, i) => `${i}. ${this.formatAction(action, state)}`)
  .join("\n")}

## Your Decision
Analyze the game state and choose the best action. Respond in JSON format with actionIndex and reasoning.`;

    return prompt;
  }

  /**
   * Format cards in hand for display
   */
  private formatHandCards(
    state: FullPlaytestGameState,
    cardIds: string[],
  ): string {
    if (cardIds.length === 0) return "(empty)";

    return cardIds
      .map((id) => {
        const card = state.cards[id];
        if (!card) return "- Unknown card";
        return `- ${card.name} (${card.manaCost || "No cost"}) - ${card.typeLine || "Unknown type"}`;
      })
      .join("\n");
  }

  /**
   * Format battlefield cards for display
   */
  private formatBattlefieldCards(
    state: FullPlaytestGameState,
    cardIds: string[],
    controller: PlayerId,
  ): string {
    if (cardIds.length === 0) return "(empty)";

    // Group by type
    const lands: ExtendedGameCard[] = [];
    const creatures: ExtendedGameCard[] = [];
    const others: ExtendedGameCard[] = [];

    for (const id of cardIds) {
      const card = state.cards[id];
      if (!card) continue;

      if (card.typeLine?.includes("Land")) {
        lands.push(card);
      } else if (card.typeLine?.includes("Creature")) {
        creatures.push(card);
      } else {
        others.push(card);
      }
    }

    let result = "";

    if (lands.length > 0) {
      result += `Lands (${lands.length}): ${lands
        .map((c) => `${c.name}${c.isTapped ? " (T)" : ""}`)
        .join(", ")}\n`;
    }

    if (creatures.length > 0) {
      result += `Creatures (${creatures.length}):\n${creatures
        .map((c) => {
          let status = "";
          if (c.isTapped) status += " (T)";
          if (c.summoningSickness) status += " (SS)";
          if (c.damage > 0) status += ` [${c.damage} dmg]`;
          const counters = Object.entries(c.counters)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ");
          if (counters) status += ` {${counters}}`;
          return `  - ${c.name} ${c.power}/${c.toughness}${status}${c.keywords.length > 0 ? ` [${c.keywords.join(", ")}]` : ""}`;
        })
        .join("\n")}\n`;
    }

    if (others.length > 0) {
      result += `Other permanents: ${others
        .map((c) => `${c.name}${c.isTapped ? " (T)" : ""}`)
        .join(", ")}\n`;
    }

    return result || "(empty)";
  }

  /**
   * Format available mana
   */
  private formatManaAvailable(
    state: FullPlaytestGameState,
    player: PlayerId,
  ): string {
    // Count untapped lands and mana sources
    let availableMana = 0;
    const manaByColor: Record<string, number> = {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
      C: 0,
    };

    for (const cardId of state.battlefieldOrder[player]) {
      const card = state.cards[cardId];
      if (!card || card.isTapped) continue;

      // Check if it's a mana source
      const canProduceMana =
        card.typeLine?.includes("Land") ||
        card.oracleText?.includes("{T}: Add");

      if (canProduceMana) {
        availableMana++;

        // Determine color (simplified)
        const typeLine = card.typeLine?.toLowerCase() || "";
        const oracleText = card.oracleText?.toLowerCase() || "";

        if (typeLine.includes("plains") || oracleText.includes("add {w}"))
          manaByColor.W++;
        else if (typeLine.includes("island") || oracleText.includes("add {u}"))
          manaByColor.U++;
        else if (typeLine.includes("swamp") || oracleText.includes("add {b}"))
          manaByColor.B++;
        else if (
          typeLine.includes("mountain") ||
          oracleText.includes("add {r}")
        )
          manaByColor.R++;
        else if (typeLine.includes("forest") || oracleText.includes("add {g}"))
          manaByColor.G++;
        else manaByColor.C++;
      }
    }

    // Also include current mana pool
    const pool = state[player].manaPool;
    const poolStr = Object.entries(pool)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v}${k}`)
      .join(" ");

    const availableStr = Object.entries(manaByColor)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v}${k}`)
      .join(" ");

    return `${availableMana} untapped sources (${availableStr || "none"})${poolStr ? ` | Pool: ${poolStr}` : ""}`;
  }

  /**
   * Format an action for display
   */
  private formatAction(
    action: GameAction,
    state: FullPlaytestGameState,
  ): string {
    switch (action.type) {
      case "pass_priority":
        return "Pass priority";

      case "concede":
        return "Concede the game";

      case "play_land": {
        const card = state.cards[action.cardId];
        return `Play land: ${card?.name || "Unknown"}`;
      }

      case "cast_spell": {
        const card = state.cards[action.cardId];
        return `Cast: ${card?.name || "Unknown"} (${card?.manaCost || "free"})`;
      }

      case "activate_ability": {
        const card = state.cards[action.cardId];
        return `Activate ability of ${card?.name || "Unknown"}`;
      }

      case "tap_for_mana": {
        const card = state.cards[action.cardId];
        return `Tap ${card?.name || "Unknown"} for mana`;
      }

      case "declare_attackers": {
        if (action.attackers.length === 0) {
          return "Declare no attackers (skip combat)";
        }
        const attackerNames = action.attackers
          .map((a) => state.cards[a.cardId]?.name || "Unknown")
          .join(", ");
        return `Attack with: ${attackerNames}`;
      }

      case "declare_blockers": {
        if (action.blockers.length === 0) {
          return "Declare no blockers";
        }
        const blockDescs = action.blockers
          .map((b) => {
            const blocker = state.cards[b.cardId];
            const attacker = state.cards[b.blockingAttackerId];
            return `${blocker?.name || "Unknown"} blocks ${attacker?.name || "Unknown"}`;
          })
          .join(", ");
        return `Block: ${blockDescs}`;
      }

      case "mulligan":
        return "Mulligan (draw 7 new cards minus 1)";

      case "keep_hand":
        return "Keep current hand";

      case "draw_card":
        return "Draw a card";

      case "discard": {
        const card = state.cards[action.cardId];
        return `Discard: ${card?.name || "Unknown"}`;
      }

      default:
        return `Action: ${action.type}`;
    }
  }

  /**
   * Parse the AI's decision response
   */
  private parseDecision(
    text: string,
    availableActions: GameAction[],
  ): AIDecision {
    try {
      // Try to extract JSON from the response
      // Use \{\s*" to match actual JSON objects and avoid mana symbols like {G}, {W}, etc.
      const jsonMatch = text.match(/\{\s*"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const actionIndex = parseInt(parsed.actionIndex, 10);

      if (
        isNaN(actionIndex) ||
        actionIndex < 0 ||
        actionIndex >= availableActions.length
      ) {
        throw new Error(`Invalid action index: ${actionIndex}`);
      }

      return {
        action: availableActions[actionIndex],
        reasoning: parsed.reasoning || "No reasoning provided",
        confidence: parsed.confidence,
      };
    } catch (error) {
      console.error("[AI] Failed to parse decision:", error, "Response:", text);

      // Fallback: pass priority
      return {
        action: { type: "pass_priority" },
        reasoning: "Failed to parse AI response, passing priority",
      };
    }
  }

  /**
   * Generate strategic reasoning for the game log
   */
  async generateReasoning(
    state: FullPlaytestGameState,
    player: PlayerId,
    action: GameAction,
  ): Promise<string> {
    // For simple actions, generate quick reasoning without API call
    switch (action.type) {
      case "pass_priority":
        if (state.stack.length === 0) {
          return "Nothing to respond to, passing priority";
        }
        return "Choosing not to respond to the stack";

      case "play_land": {
        const card = state.cards[action.cardId];
        return `Playing ${card?.name || "land"} to develop mana base`;
      }

      case "tap_for_mana": {
        const card = state.cards[action.cardId];
        return `Tapping ${card?.name || "land"} for mana`;
      }

      case "declare_attackers": {
        if (action.attackers.length === 0) {
          return "Choosing not to attack this turn";
        }
        const names = action.attackers
          .map((a) => state.cards[a.cardId]?.name || "creature")
          .join(", ");
        return `Attacking with ${names} to pressure opponent's life total`;
      }

      case "declare_blockers": {
        if (action.blockers.length === 0) {
          return "Choosing not to block";
        }
        return `Setting up blocks to minimize damage`;
      }

      default:
        return `Taking action: ${action.type}`;
    }
  }

  /**
   * Decide on attackers for combat
   */
  async decideAttackers(
    state: FullPlaytestGameState,
    player: PlayerId,
    possibleAttackers: string[],
  ): Promise<AttackerInfo[]> {
    if (!this.anthropic || possibleAttackers.length === 0) {
      return [];
    }

    const opponent: PlayerId = player === "player" ? "opponent" : "player";

    // Build a focused prompt for attacker selection
    const prompt = `## Combat Decision

You are deciding which creatures to attack with.

**Your Creatures That Can Attack:**
${possibleAttackers
  .map((id) => {
    const card = state.cards[id];
    return `- ${card?.name} (${card?.power}/${card?.toughness}) ${card?.keywords.join(", ") || ""}`;
  })
  .join("\n")}

**Opponent's Potential Blockers:**
${
  state.battlefieldOrder[opponent]
    .map((id) => {
      const card = state.cards[id];
      if (!card?.typeLine?.includes("Creature") || card.isTapped) return null;
      return `- ${card.name} (${card.power}/${card.toughness}) ${card.keywords.join(", ") || ""}`;
    })
    .filter(Boolean)
    .join("\n") || "(none)"
}

**Life Totals:**
- You: ${state[player].life}
- Opponent: ${state[opponent].life}

Which creatures should attack? Consider:
- Can you deal lethal damage?
- Will you lose valuable creatures to unfavorable blocks?
- Is it worth applying pressure even if trades happen?

Respond with JSON:
{
  "attackerIndices": [<indices of creatures to attack with, or empty array>],
  "reasoning": "<brief explanation>"
}

Where indices correspond to the order in "Your Creatures That Can Attack" (0-indexed).`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system:
          "You are an expert MTG player deciding combat. Be aggressive when it makes sense, but avoid throwing away creatures for no value.",
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{\s*"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const indices = parsed.attackerIndices || [];

          return indices
            .filter((i: number) => i >= 0 && i < possibleAttackers.length)
            .map((i: number) => ({
              cardId: possibleAttackers[i],
              attackingPlayerId: player,
              defendingTarget: opponent,
            }));
        }
      }
    } catch (error) {
      console.error("[AI] Error deciding attackers:", error);
    }

    // Default: attack with everything if opponent has no blockers
    const opponentBlockers = state.battlefieldOrder[opponent].filter((id) => {
      const card = state.cards[id];
      return card?.typeLine?.includes("Creature") && !card.isTapped;
    });

    if (opponentBlockers.length === 0) {
      return possibleAttackers.map((cardId) => ({
        cardId,
        attackingPlayerId: player,
        defendingTarget: opponent,
      }));
    }

    return [];
  }

  /**
   * Decide on blockers for combat
   */
  async decideBlockers(
    state: FullPlaytestGameState,
    player: PlayerId,
    possibleBlockers: string[],
    attackers: AttackerInfo[],
  ): Promise<BlockerInfo[]> {
    if (
      !this.anthropic ||
      possibleBlockers.length === 0 ||
      attackers.length === 0
    ) {
      return [];
    }

    // Build a focused prompt for blocker selection
    const prompt = `## Blocking Decision

**Attacking Creatures:**
${attackers
  .map((a, i) => {
    const card = state.cards[a.cardId];
    return `${i}. ${card?.name} (${card?.power}/${card?.toughness}) ${card?.keywords.join(", ") || ""}`;
  })
  .join("\n")}

**Your Creatures That Can Block:**
${possibleBlockers
  .map((id, i) => {
    const card = state.cards[id];
    return `${i}. ${card?.name} (${card?.power}/${card?.toughness}) ${card?.keywords.join(", ") || ""}`;
  })
  .join("\n")}

**Life Totals:**
- You: ${state[player].life}
- Opponent: ${state[player === "player" ? "opponent" : "player"].life}

**Total Unblocked Damage:** ${attackers.reduce((sum, a) => {
      const card = state.cards[a.cardId];
      return sum + parseInt(card?.power || "0", 10);
    }, 0)}

How should you block? Consider:
- Can you survive without blocking?
- Are any trades favorable (your smaller creature for their bigger one)?
- Do any attackers have evasion that you can't block?
- Is it better to chump block to stay alive?

Respond with JSON:
{
  "blocks": [{"blockerIndex": <blocker index>, "attackerIndex": <attacker index>}, ...],
  "reasoning": "<brief explanation>"
}

Use empty array for blocks if you don't want to block.`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system:
          "You are an expert MTG player deciding blocks. Preserve your life total while avoiding unnecessary creature trades.",
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{\s*"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const blocks = parsed.blocks || [];

          return blocks
            .filter(
              (b: any) =>
                b.blockerIndex >= 0 &&
                b.blockerIndex < possibleBlockers.length &&
                b.attackerIndex >= 0 &&
                b.attackerIndex < attackers.length,
            )
            .map((b: any) => ({
              cardId: possibleBlockers[b.blockerIndex],
              blockingAttackerId: attackers[b.attackerIndex].cardId,
            }));
        }
      }
    } catch (error) {
      console.error("[AI] Error deciding blockers:", error);
    }

    return [];
  }

  /**
   * Decide whether to mulligan the opening hand
   * Uses London mulligan rules - always draw 7, then put X cards on bottom where X = mulligan count
   */
  async decideMulligan(
    state: FullPlaytestGameState,
    player: PlayerId,
    mulliganCount: number,
  ): Promise<{ keep: boolean; reasoning: string }> {
    const playerState = state[player];
    const hand = playerState.handOrder.map((id) => state.cards[id]);

    // If this is a free mulligan (first one in Commander), be more willing to mulligan
    const isFreeMultiplayer =
      mulliganCount === 0 &&
      (state.format === "commander" || state.format === "edh");

    // After 3+ mulligans, always keep (going to 4 cards or fewer is usually bad)
    if (mulliganCount >= 3) {
      return {
        keep: true,
        reasoning: `Keeping after ${mulliganCount} mulligans - can't go lower`,
      };
    }

    if (!this.anthropic) {
      // Fallback: basic heuristic - keep if we have 2-5 lands
      const landCount = hand.filter((c) => c.typeLine?.includes("Land")).length;
      const keep = landCount >= 2 && landCount <= 5;
      return {
        keep,
        reasoning: keep
          ? `Keeping with ${landCount} lands`
          : `Mulliganing: ${landCount} lands is not ideal`,
      };
    }

    // Build the mulligan decision prompt
    const prompt = this.buildMulliganPrompt(
      state,
      player,
      hand,
      mulliganCount,
      isFreeMultiplayer,
    );

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: this.getMulliganSystemPrompt(),
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{\s*"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            keep: parsed.keep === true,
            reasoning: parsed.reasoning || "No reasoning provided",
          };
        }
      }
    } catch (error) {
      console.error("[AI] Error deciding mulligan:", error);
    }

    // Fallback: keep the hand
    return {
      keep: true,
      reasoning: "Error evaluating hand, keeping by default",
    };
  }

  /**
   * Decide which cards to put on the bottom of the library after a London mulligan
   */
  async decideBottomCards(
    state: FullPlaytestGameState,
    player: PlayerId,
    cardsToBottom: number,
  ): Promise<{ cardIds: string[]; reasoning: string }> {
    const playerState = state[player];
    const hand = playerState.handOrder.map((id) => state.cards[id]);

    if (cardsToBottom <= 0 || cardsToBottom >= hand.length) {
      return { cardIds: [], reasoning: "No cards to bottom" };
    }

    if (!this.anthropic) {
      // Fallback: bottom the highest CMC cards that aren't lands
      const sortedHand = [...hand].sort((a, b) => {
        // Keep lands
        if (a.typeLine?.includes("Land") && !b.typeLine?.includes("Land"))
          return 1;
        if (!a.typeLine?.includes("Land") && b.typeLine?.includes("Land"))
          return -1;
        // Sort by CMC descending (higher CMC gets bottomed)
        return b.cmc - a.cmc;
      });

      const toBottom = sortedHand
        .slice(0, cardsToBottom)
        .map((c) => c.instanceId);
      return {
        cardIds: toBottom,
        reasoning: `Bottoming highest CMC non-land cards`,
      };
    }

    const prompt = this.buildBottomCardsPrompt(
      state,
      player,
      hand,
      cardsToBottom,
    );

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system:
          "You are an expert MTG player deciding which cards to put on the bottom of your library after a mulligan. Choose cards that are least useful in the early game or that you have duplicates of.",
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{\s*"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const indices = parsed.cardIndices || [];

          // Validate indices
          const validIndices = indices
            .filter((i: number) => i >= 0 && i < hand.length)
            .slice(0, cardsToBottom);

          if (validIndices.length === cardsToBottom) {
            return {
              cardIds: validIndices.map((i: number) => hand[i].instanceId),
              reasoning: parsed.reasoning || "No reasoning provided",
            };
          }
        }
      }
    } catch (error) {
      console.error("[AI] Error deciding bottom cards:", error);
    }

    // Fallback: bottom highest CMC non-lands
    const sortedHand = [...hand].sort((a, b) => {
      if (a.typeLine?.includes("Land") && !b.typeLine?.includes("Land"))
        return 1;
      if (!a.typeLine?.includes("Land") && b.typeLine?.includes("Land"))
        return -1;
      return b.cmc - a.cmc;
    });

    return {
      cardIds: sortedHand.slice(0, cardsToBottom).map((c) => c.instanceId),
      reasoning: "Fallback: bottoming highest CMC non-land cards",
    };
  }

  /**
   * Get system prompt for mulligan decisions
   */
  private getMulliganSystemPrompt(): string {
    return `You are an expert Magic: The Gathering player evaluating an opening hand.

## Mulligan Guidelines for Commander

A keepable hand typically has:
1. **Mana Sources**: 2-4 lands (or mana rocks) to cast early spells
2. **Curve**: Cards you can cast in the first few turns
3. **Game Plan**: Cards that advance your strategy (card draw, ramp, or key pieces)
4. **Color Access**: Lands that produce the colors you need for cards in hand

Red flags to mulligan:
- 0-1 lands (won't cast anything)
- 6-7 lands with no action
- All high-cost cards with no ramp
- Wrong colors for the cards in hand
- No clear path to doing anything meaningful

In Commander with free first mulligan, be more willing to mulligan marginal hands.

## Response Format
Respond with JSON:
{
  "keep": <true or false>,
  "reasoning": "<1-2 sentence explanation>"
}`;
  }

  /**
   * Build the mulligan decision prompt
   */
  private buildMulliganPrompt(
    state: FullPlaytestGameState,
    player: PlayerId,
    hand: ExtendedGameCard[],
    mulliganCount: number,
    isFreeMultiplayer: boolean,
  ): string {
    const deckName =
      player === "player" ? state.deckName : state.opponentDeckName;
    const commanders = state[player].commandZone.map((id) => state.cards[id]);

    const cardsAfterKeep = 7 - mulliganCount;

    return `## Mulligan Decision

**Deck:** ${deckName}
**Commander(s):** ${commanders.map((c) => `${c.name} (${c.manaCost})`).join(", ") || "None"}
**Mulligan Count:** ${mulliganCount}${isFreeMultiplayer ? " (free mulligan in multiplayer)" : ""}
**Cards After Keeping:** ${cardsAfterKeep}

### Your Opening Hand (${hand.length} cards):
${hand.map((c, i) => `${i + 1}. ${c.name} - ${c.manaCost || "No cost"} - ${c.typeLine}`).join("\n")}

### Analysis Questions:
- How many lands? Do they produce the right colors?
- Can you cast anything in the first 3 turns?
- Does this hand have a game plan?
- Is it worth going to ${cardsAfterKeep - 1} cards for a better hand?

Should you keep this hand or mulligan?`;
  }

  /**
   * Build the bottom cards prompt
   */
  private buildBottomCardsPrompt(
    _state: FullPlaytestGameState,
    _player: PlayerId,
    hand: ExtendedGameCard[],
    cardsToBottom: number,
  ): string {
    return `## London Mulligan - Choose Cards to Bottom

You need to put **${cardsToBottom} card${cardsToBottom > 1 ? "s" : ""}** on the bottom of your library.

### Your Hand (${hand.length} cards):
${hand.map((c, i) => `${i}. ${c.name} - ${c.manaCost || "No cost"} - ${c.typeLine}`).join("\n")}

### Guidelines:
- Keep lands you need for your colors
- Keep low-cost cards you can cast early
- Bottom expensive cards you can't cast soon
- Bottom duplicates or situational cards

Respond with JSON:
{
  "cardIndices": [<indices of cards to bottom>],
  "reasoning": "<brief explanation>"
}

Choose exactly ${cardsToBottom} indices (0-indexed).`;
  }

  /**
   * Apply simple heuristics to determine action without calling AI.
   * Returns null if no heuristic applies, otherwise returns { action, reasoning }.
   */
  getHeuristicAction(
    availableActions: GameAction[],
  ): { action: GameAction; reasoning: string } | null {
    // Filter out concede - heuristics will never concede
    const filteredActions = availableActions.filter(
      (action) => action.type !== "concede",
    );

    // If only pass_priority is available, automatically pass
    if (
      filteredActions.length === 1 &&
      filteredActions[0].type === "pass_priority"
    ) {
      return {
        action: filteredActions[0],
        reasoning: "No other actions available, passing priority.",
      };
    }

    // No heuristic applies
    return null;
  }
}
