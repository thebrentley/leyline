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
  TokenUsage,
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

    console.log(
      "Checking if we need AI: ",
      JSON.stringify(
        {
          player,
          activePlayer: state.activePlayer,
          phase: state.phase,
          step: state.step,
          availableActions: availableActions.map(
            (action: GameAction) => action.type,
          ),
          handCardNames: state[player].handOrder.map(
            (id) => state.cards[id]?.name,
          ),
          manaPool: state[player].manaPool,
          lands: state.battlefieldOrder[player]
            .map((id) => state.cards[id])
            .map((card) => ({ name: card?.name, tapped: card?.isTapped })),
        },
        null,
        2,
      ),
    );
    // Check if heuristics can handle this decision
    const heuristicResult = this.getHeuristicAction(
      state,
      player,
      availableActions,
    );
    if (heuristicResult) {
      return heuristicResult;
    }

    // Build the decision prompt
    const prompt = this.buildDecisionPrompt(state, player, availableActions);
    const systemPrompt = this.getSystemPrompt();

    console.log("[AI] Decision prompt:", prompt);

    try {
      const response = await this.anthropic.beta.promptCaching.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" }, // Cache system prompt for 5 min
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });

      // Extract token usage from response
      const tokenUsage: TokenUsage = {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        cacheReadInputTokens:
          (response.usage as any)?.cache_read_input_tokens || 0,
        cacheCreationInputTokens:
          (response.usage as any)?.cache_creation_input_tokens || 0,
      };

      // Parse the response
      const content = response.content[0];
      if (content.type === "text") {
        const decision = this.parseDecision(content.text, availableActions);
        decision.tokenUsage = tokenUsage;
        return decision;
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
10. **Land Selection** - When choosing which land to play, prefer lands that enter the battlefield tapped during early turns (1-4) unless an untapped land allows you to cast a spell this turn. Save untapped lands for when you need the mana immediately

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

### Your Command Zone
${this.formatCommandZone(state, playerState.commandZone)}

### Your Hand (${playerState.handOrder.length} cards)
${this.formatHandCards(state, playerState.handOrder)}

### Your Battlefield
${this.formatBattlefieldCards(state, state.battlefieldOrder[player], player)}

### Opponent's Battlefield
${this.formatBattlefieldCards(state, state.battlefieldOrder[opponent], opponent)}

### Your Mana Available
${this.formatManaAvailable(state, player)}

### Castable Spells Analysis
${this.formatCastableSpellsAnalysis(state, player, availableActions)}

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
   * Format command zone cards for display
   */
  private formatCommandZone(
    state: FullPlaytestGameState,
    cardIds: string[],
  ): string {
    if (cardIds.length === 0) return "(empty)";

    return cardIds
      .map((id) => {
        const card = state.cards[id];
        if (!card) return "- Unknown card";
        const commanderTax = card.commanderTax || 0;
        const taxStr =
          commanderTax > 0 ? ` [Commander tax: ${commanderTax}]` : "";
        return `- ${card.name} (${card.manaCost || "No cost"}) - ${card.typeLine || "Unknown type"}${taxStr}`;
      })
      .join("\n");
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

      // Creatures with summoning sickness can't tap for mana (unless they have haste)
      const hasSummoningSickness =
        card.typeLine?.includes("Creature") &&
        card.summoningSickness &&
        !card.keywords.includes("haste");

      if (canProduceMana && !hasSummoningSickness) {
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
   * Analyze which spells can be cast with available mana
   * This helps the AI understand when tapping lands is useful vs wasteful
   */
  private formatCastableSpellsAnalysis(
    state: FullPlaytestGameState,
    player: PlayerId,
    availableActions: GameAction[],
  ): string {
    const playerState = state[player];

    // Count total available mana (untapped sources)
    let totalAvailableMana = 0;
    const availableManaByColor: Record<string, number> = {
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

      const canProduceMana =
        card.typeLine?.includes("Land") ||
        card.oracleText?.includes("{T}: Add");

      // Creatures with summoning sickness can't tap for mana (unless they have haste)
      const hasSummoningSickness =
        card.typeLine?.includes("Creature") &&
        card.summoningSickness &&
        !card.keywords.includes("haste");

      if (canProduceMana && !hasSummoningSickness) {
        totalAvailableMana++;
        const typeLine = card.typeLine?.toLowerCase() || "";
        const oracleText = card.oracleText?.toLowerCase() || "";

        if (typeLine.includes("plains") || oracleText.includes("add {w}"))
          availableManaByColor.W++;
        else if (typeLine.includes("island") || oracleText.includes("add {u}"))
          availableManaByColor.U++;
        else if (typeLine.includes("swamp") || oracleText.includes("add {b}"))
          availableManaByColor.B++;
        else if (
          typeLine.includes("mountain") ||
          oracleText.includes("add {r}")
        )
          availableManaByColor.R++;
        else if (typeLine.includes("forest") || oracleText.includes("add {g}"))
          availableManaByColor.G++;
        else availableManaByColor.C++;
      }
    }

    // Include current mana pool
    const pool = playerState.manaPool;
    const poolTotal = Object.values(pool).reduce((sum, v) => sum + v, 0);
    const effectiveTotalMana = totalAvailableMana + poolTotal;

    // Analyze each spell in hand
    const handCards = playerState.handOrder.map((id) => state.cards[id]);
    const spellAnalysis: string[] = [];
    const castableSpells: string[] = [];

    for (const card of handCards) {
      if (!card) continue;

      // Skip lands - they don't need mana to play
      if (card.typeLine?.includes("Land")) continue;

      const manaCost = card.manaCost || "";

      // Parse generic and colored mana separately
      let genericMana = this.parseGenericMana(manaCost);
      const coloredPips = this.parseColoredManaPips(manaCost);

      // Apply cost reduction from static abilities (only reduces generic mana)
      const reduction = this.calculateCostReduction(state, player, card);
      const reducedGeneric = Math.max(0, genericMana - reduction);

      // Calculate effective CMC (reduced generic + colored pips)
      const cmc = reducedGeneric + coloredPips;

      // Check if spell can be cast with available mana
      const canCast = this.canCastSpell(
        manaCost,
        cmc,
        effectiveTotalMana,
        availableManaByColor,
        pool as unknown as { [key: string]: number },
      );

      // Format cost display with reduction indicator
      let costDisplay: string;
      if (reduction > 0 && genericMana > 0) {
        // Show original cost and the reduction
        const actualReduction = Math.min(reduction, genericMana);
        costDisplay = `${manaCost} (${actualReduction} generic mana reduced, effective CMC: ${cmc})`;
      } else if (reduction > 0 && genericMana === 0) {
        // Reduction available but no generic mana to reduce
        costDisplay = `${manaCost} (no generic mana to reduce)`;
      } else {
        costDisplay = manaCost || "free";
      }

      if (canCast) {
        castableSpells.push(card.name);
        spellAnalysis.push(
          `- ${card.name} (${costDisplay}) - CAN CAST with ${cmc} mana`,
        );
      } else {
        spellAnalysis.push(
          `- ${card.name} (${costDisplay}) - CANNOT CAST (needs ${cmc} mana, you have ${effectiveTotalMana} available)`,
        );
      }
    }

    // Check if there are tap_for_mana actions but no castable spells
    const hasTapForManaActions = availableActions.some(
      (a) => a.type === "tap_for_mana",
    );
    const hasCastSpellActions = availableActions.some(
      (a) => a.type === "cast_spell",
    );

    let guidance = "";
    if (
      hasTapForManaActions &&
      !hasCastSpellActions &&
      castableSpells.length === 0
    ) {
      guidance = `\n**⚠️ IMPORTANT:** You have no spells that can be cast this turn. Tapping lands for mana would be wasteful since unused mana empties at end of phase. You should PASS PRIORITY instead.`;
    } else if (
      hasTapForManaActions &&
      castableSpells.length > 0 &&
      !hasCastSpellActions
    ) {
      guidance = `\n**Note:** You have castable spells in hand but they are not in the available actions yet. You may need to tap lands first to add mana to your pool, then the cast action will become available.`;
    }

    if (spellAnalysis.length === 0) {
      return "(No spells in hand to analyze)";
    }

    return spellAnalysis.join("\n") + guidance;
  }

  /**
   * Parse only the generic mana portion from a mana cost string
   */
  private parseGenericMana(manaCost: string): number {
    const genericMatch = manaCost.match(/\{(\d+)\}/);
    return genericMatch ? parseInt(genericMatch[1], 10) : 0;
  }

  /**
   * Count colored mana symbols in a mana cost string
   */
  private parseColoredManaPips(manaCost: string): number {
    const coloredMatches = manaCost.match(/\{[WUBRG]\}/g);
    return coloredMatches ? coloredMatches.length : 0;
  }

  /**
   * Calculate total mana cost reduction from static abilities
   * (e.g., Green Medallion, Ruby Medallion, cost reduction effects)
   */
  private calculateCostReduction(
    state: FullPlaytestGameState,
    player: PlayerId,
    card: ExtendedGameCard,
  ): number {
    let reduction = 0;
    const cardColors = card.colors || [];
    const cardTypeLine = card.typeLine?.toLowerCase() || "";

    // Check all permanents the player controls for cost reduction effects
    for (const permanent of Object.values(state.cards)) {
      if (
        permanent.controller !== player ||
        permanent.zone !== "battlefield" ||
        !permanent.oracleText
      ) {
        continue;
      }

      const oracleText = permanent.oracleText.toLowerCase();

      // Medallion cycle: "{Color} spells you cast cost {1} less to cast."
      // Green Medallion
      if (
        oracleText.includes("green spells you cast cost") &&
        oracleText.includes("less to cast") &&
        cardColors.includes("G")
      ) {
        const match = oracleText.match(/cost\s+\{(\d+)\}\s+less/);
        if (match) {
          reduction += parseInt(match[1], 10);
        }
      }

      // White Medallion (Pearl Medallion)
      if (
        oracleText.includes("white spells you cast cost") &&
        oracleText.includes("less to cast") &&
        cardColors.includes("W")
      ) {
        const match = oracleText.match(/cost\s+\{(\d+)\}\s+less/);
        if (match) {
          reduction += parseInt(match[1], 10);
        }
      }

      // Blue Medallion (Sapphire Medallion)
      if (
        oracleText.includes("blue spells you cast cost") &&
        oracleText.includes("less to cast") &&
        cardColors.includes("U")
      ) {
        const match = oracleText.match(/cost\s+\{(\d+)\}\s+less/);
        if (match) {
          reduction += parseInt(match[1], 10);
        }
      }

      // Black Medallion (Jet Medallion)
      if (
        oracleText.includes("black spells you cast cost") &&
        oracleText.includes("less to cast") &&
        cardColors.includes("B")
      ) {
        const match = oracleText.match(/cost\s+\{(\d+)\}\s+less/);
        if (match) {
          reduction += parseInt(match[1], 10);
        }
      }

      // Red Medallion (Ruby Medallion)
      if (
        oracleText.includes("red spells you cast cost") &&
        oracleText.includes("less to cast") &&
        cardColors.includes("R")
      ) {
        const match = oracleText.match(/cost\s+\{(\d+)\}\s+less/);
        if (match) {
          reduction += parseInt(match[1], 10);
        }
      }

      // Creature spell cost reduction (e.g., Goblin Warchief)
      if (
        oracleText.includes("creature spells you cast cost") &&
        oracleText.includes("less to cast") &&
        cardTypeLine.includes("creature")
      ) {
        const match = oracleText.match(/cost\s+\{(\d+)\}\s+less/);
        if (match) {
          reduction += parseInt(match[1], 10);
        }
      }

      // Artifact spell cost reduction (e.g., Foundry Inspector)
      if (
        oracleText.includes("artifact spells you cast cost") &&
        oracleText.includes("less to cast") &&
        cardTypeLine.includes("artifact")
      ) {
        const match = oracleText.match(/cost\s+\{(\d+)\}\s+less/);
        if (match) {
          reduction += parseInt(match[1], 10);
        }
      }

      // Enchantment spell cost reduction
      if (
        oracleText.includes("enchantment spells you cast cost") &&
        oracleText.includes("less to cast") &&
        cardTypeLine.includes("enchantment")
      ) {
        const match = oracleText.match(/cost\s+\{(\d+)\}\s+less/);
        if (match) {
          reduction += parseInt(match[1], 10);
        }
      }

      // Instant/Sorcery cost reduction (e.g., Baral, Chief of Compliance)
      if (
        oracleText.includes("instant") &&
        oracleText.includes("sorcery") &&
        oracleText.includes("spells you cast cost") &&
        oracleText.includes("less to cast") &&
        (cardTypeLine.includes("instant") || cardTypeLine.includes("sorcery"))
      ) {
        const match = oracleText.match(/cost\s+\{(\d+)\}\s+less/);
        if (match) {
          reduction += parseInt(match[1], 10);
        }
      }
    }

    return reduction;
  }

  /**
   * Helper to determine if a spell can be cast with available mana
   */
  private canCastSpell(
    manaCost: string,
    cmc: number,
    totalAvailableMana: number,
    availableManaByColor: Record<string, number>,
    currentPool: { [key: string]: number },
  ): boolean {
    // If not enough total mana, definitely can't cast
    if (totalAvailableMana < cmc) {
      return false;
    }

    // Parse mana cost for color requirements
    // Format like {2}{G}{G} or {1}{W}{U}
    const colorRequirements: Record<string, number> = {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
    };

    const colorMatches = manaCost.match(/\{([WUBRG])\}/gi) || [];
    for (const match of colorMatches) {
      const color = match.replace(/[{}]/g, "").toUpperCase();
      if (colorRequirements[color] !== undefined) {
        colorRequirements[color]++;
      }
    }

    // Check if we can meet color requirements
    for (const [color, required] of Object.entries(colorRequirements)) {
      if (required > 0) {
        const available =
          (availableManaByColor[color] || 0) + (currentPool[color] || 0);
        if (available < required) {
          return false;
        }
      }
    }

    return true;
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
  ): Promise<{ attackers: AttackerInfo[]; tokenUsage?: TokenUsage }> {
    if (!this.anthropic || possibleAttackers.length === 0) {
      return { attackers: [] };
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
      const response = await this.anthropic.beta.promptCaching.messages.create({
        model: "claude-3-5-haiku-20241022", // Haiku for combat decisions
        max_tokens: 512,
        system: [
          {
            type: "text",
            text: "You are an expert MTG player deciding combat. Be aggressive when it makes sense, but avoid throwing away creatures for no value.",
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });

      // Extract token usage
      const tokenUsage: TokenUsage = {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        cacheReadInputTokens:
          (response.usage as any)?.cache_read_input_tokens || 0,
        cacheCreationInputTokens:
          (response.usage as any)?.cache_creation_input_tokens || 0,
      };

      const content = response.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{\s*"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const indices = parsed.attackerIndices || [];

          const attackers = indices
            .filter((i: number) => i >= 0 && i < possibleAttackers.length)
            .map((i: number) => ({
              cardId: possibleAttackers[i],
              attackingPlayerId: player,
              defendingTarget: opponent,
            }));
          return { attackers, tokenUsage };
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
      return {
        attackers: possibleAttackers.map((cardId) => ({
          cardId,
          attackingPlayerId: player,
          defendingTarget: opponent,
        })),
      };
    }

    return { attackers: [] };
  }

  /**
   * Decide on blockers for combat
   */
  async decideBlockers(
    state: FullPlaytestGameState,
    player: PlayerId,
    possibleBlockers: string[],
    attackers: AttackerInfo[],
  ): Promise<{ blockers: BlockerInfo[]; tokenUsage?: TokenUsage }> {
    if (
      !this.anthropic ||
      possibleBlockers.length === 0 ||
      attackers.length === 0
    ) {
      return { blockers: [] };
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
      const response = await this.anthropic.beta.promptCaching.messages.create({
        model: "claude-3-5-haiku-20241022", // Haiku for combat decisions
        max_tokens: 512,
        system: [
          {
            type: "text",
            text: "You are an expert MTG player deciding blocks. Preserve your life total while avoiding unnecessary creature trades.",
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });

      // Extract token usage
      const tokenUsage: TokenUsage = {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        cacheReadInputTokens:
          (response.usage as any)?.cache_read_input_tokens || 0,
        cacheCreationInputTokens:
          (response.usage as any)?.cache_creation_input_tokens || 0,
      };

      const content = response.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{\s*"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const blocks = parsed.blocks || [];

          const blockers = blocks
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
          return { blockers, tokenUsage };
        }
      }
    } catch (error) {
      console.error("[AI] Error deciding blockers:", error);
    }

    return { blockers: [] };
  }

  /**
   * Decide whether to mulligan the opening hand
   * Uses London mulligan rules - always draw 7, then put X cards on bottom where X = mulligan count
   */
  async decideMulligan(
    state: FullPlaytestGameState,
    player: PlayerId,
    mulliganCount: number,
  ): Promise<{ keep: boolean; reasoning: string; tokenUsage?: TokenUsage }> {
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
      const response = await this.anthropic.beta.promptCaching.messages.create({
        model: "claude-3-5-haiku-20241022", // Haiku for simple mulligan decisions
        max_tokens: 512,
        system: [
          {
            type: "text",
            text: this.getMulliganSystemPrompt(),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });

      // Extract token usage
      const tokenUsage: TokenUsage = {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        cacheReadInputTokens:
          (response.usage as any)?.cache_read_input_tokens || 0,
        cacheCreationInputTokens:
          (response.usage as any)?.cache_creation_input_tokens || 0,
      };

      const content = response.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{\s*"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            keep: parsed.keep === true,
            reasoning: parsed.reasoning || "No reasoning provided",
            tokenUsage,
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
  ): Promise<{
    cardIds: string[];
    reasoning: string;
    tokenUsage?: TokenUsage;
  }> {
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
      const response = await this.anthropic.beta.promptCaching.messages.create({
        model: "claude-3-5-haiku-20241022", // Haiku for simple bottom cards decisions
        max_tokens: 512,
        system: [
          {
            type: "text",
            text: "You are an expert MTG player deciding which cards to put on the bottom of your library after a mulligan. Choose cards that are least useful in the early game or that you have duplicates of.",
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });

      // Extract token usage
      const tokenUsage: TokenUsage = {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        cacheReadInputTokens:
          (response.usage as any)?.cache_read_input_tokens || 0,
        cacheCreationInputTokens:
          (response.usage as any)?.cache_creation_input_tokens || 0,
      };

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
              tokenUsage,
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

    // Format commander details with CMC and oracle text
    const commanderDetails =
      commanders.length > 0
        ? commanders
            .map(
              (
                c,
              ) => `- **${c.name}** (CMC: ${c.cmc}, Mana Cost: ${c.manaCost || "None"})
  Type: ${c.typeLine}
  Oracle Text: ${c.oracleText || "No text"}`,
            )
            .join("\n")
        : "None";

    return `## Mulligan Decision

**Deck:** ${deckName}
**Mulligan Count:** ${mulliganCount}${isFreeMultiplayer ? " (free mulligan in multiplayer)" : ""}
**Cards After Keeping:** ${cardsAfterKeep}

### Commander(s):
${commanderDetails}

### Your Opening Hand (${hand.length} cards):
${hand.map((c, i) => `${i + 1}. ${c.name} - ${c.manaCost || "No cost"} - ${c.typeLine}${c.oracleText ? `\n   Oracle: ${c.oracleText}` : ""}`).join("\n")}

### Analysis Questions:
- How many lands? Do they produce the right colors?
- Does my commander offer any means of producing mana (e.g., mana abilities, cost reduction)?
- Do other cards in my hand have ways to produce mana or fetch lands (e.g., mana dorks, ramp spells, land tutors)?
- Can I afford to cast the mana-producing/ramp cards in my hand with my current lands?
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
    state: FullPlaytestGameState,
    player: PlayerId,
    availableActions: GameAction[],
  ): { action: GameAction; reasoning: string } | null {
    // Filter out concede - heuristics will never concede
    const filteredActions = availableActions.filter(
      (action) => action.type !== "concede" && action.type !== "tap_for_mana",
    );

    const passAction = filteredActions.find((a) => a.type === "pass_priority");

    // If only pass_priority is available, automatically pass
    if (filteredActions.length === 1 && passAction) {
      return {
        action: passAction,
        reasoning: "No other actions available, passing priority.",
      };
    }

    // If draw_card is available, automatically draw (mandatory draw step action)
    const drawCardAction = filteredActions.find(
      (action) => action.type === "draw_card",
    );
    if (drawCardAction) {
      return {
        action: drawCardAction,
        reasoning: "Drawing card for turn.",
      };
    }

    // If keep_hand is available but mulligan is not, auto-keep
    const keepHandAction = filteredActions.find(
      (action) => action.type === "keep_hand",
    );
    const mulliganAction = filteredActions.find(
      (action) => action.type === "mulligan",
    );
    if (keepHandAction && !mulliganAction) {
      return {
        action: keepHandAction,
        reasoning: "Keeping hand (no mulligan option available).",
      };
    }

    // If declare_attackers has only one option with no attackers, auto-skip combat
    const declareAttackersActions = filteredActions.filter(
      (action) => action.type === "declare_attackers",
    );
    if (
      declareAttackersActions.length === 1 &&
      declareAttackersActions[0].type === "declare_attackers" &&
      declareAttackersActions[0].attackers.length === 0
    ) {
      return {
        action: declareAttackersActions[0],
        reasoning: "No creatures available to attack.",
      };
    }

    // If declare_blockers has only one option with no blockers, auto-skip blocking
    const declareBlockersActions = filteredActions.filter(
      (action) => action.type === "declare_blockers",
    );
    if (
      declareBlockersActions.length === 1 &&
      declareBlockersActions[0].type === "declare_blockers" &&
      declareBlockersActions[0].blockers.length === 0
    ) {
      return {
        action: declareBlockersActions[0],
        reasoning: "No creatures available to block.",
      };
    }

    // If it's declare attackers step and we have no creatures that can attack, pass priority
    if (passAction && state.step === "declare_attackers") {
      const creaturesCanAttack = state.battlefieldOrder[player].some((id) => {
        const card = state.cards[id];
        if (!card || !card.typeLine?.includes("Creature")) return false;
        if (card.isTapped) return false;
        // Can attack if no summoning sickness OR has haste
        return !card.summoningSickness || card.keywords?.includes("haste");
      });

      if (!creaturesCanAttack) {
        return {
          action: passAction,
          reasoning: "No creatures that can attack, passing priority.",
        };
      }
    }

    // If it's declare blockers step and we have no untapped creatures, pass priority
    if (passAction && state.step === "declare_blockers") {
      const hasUntappedCreatures = state.battlefieldOrder[player].some((id) => {
        const card = state.cards[id];
        return card && card.typeLine?.includes("Creature") && !card.isTapped;
      });

      if (!hasUntappedCreatures) {
        return {
          action: passAction,
          reasoning: "No untapped creatures to block with, passing priority.",
        };
      }
    }

    // ============================================
    // NEW HEURISTICS BELOW
    // ============================================

    // Auto-pass during early phases (untap, upkeep) when stack is empty
    // Both players can benefit from this - nothing usually happens here
    if (
      passAction &&
      state.stack.length === 0 &&
      state.phase === "beginning" &&
      (state.step === "untap" || state.step === "upkeep")
    ) {
      // Check if we have any instant-speed actions (not just pass_priority)
      // Note: tap_for_mana is already filtered out of filteredActions
      const hasInstantAction = filteredActions.some(
        (a) => a.type !== "pass_priority",
      );
      if (!hasInstantAction) {
        return {
          action: passAction,
          reasoning: `Auto-passing ${state.step} step (no actions to take).`,
        };
      }
    }

    // Auto-pass during opponent's turn when stack is empty and no instant-speed plays
    if (
      passAction &&
      state.activePlayer !== player &&
      state.stack.length === 0
    ) {
      // Check if we have any meaningful actions besides pass_priority
      // Note: tap_for_mana is already filtered out of filteredActions
      const hasMeaningfulAction = filteredActions.some(
        (a) => a.type !== "pass_priority",
      );
      if (!hasMeaningfulAction) {
        return {
          action: passAction,
          reasoning:
            "Auto-passing on opponent's turn (no instant-speed plays).",
        };
      }
    }

    // Auto-play single land during main phase
    const playLandActions = filteredActions.filter(
      (a) => a.type === "play_land",
    );
    if (
      playLandActions.length === 1 &&
      state.activePlayer === player &&
      (state.phase === "precombat_main" || state.phase === "postcombat_main") &&
      state.stack.length === 0
    ) {
      const landAction = playLandActions[0];
      if (landAction.type === "play_land") {
        const card = state.cards[landAction.cardId];
        return {
          action: landAction,
          reasoning: `Auto-playing ${card?.name || "land"} (only land in hand).`,
        };
      }
    }

    // Auto-select which land to play when multiple lands are available
    // Prefer tapped lands early in the game unless untapped lands provide immediate advantage
    if (
      playLandActions.length > 1 &&
      state.activePlayer === player &&
      (state.phase === "precombat_main" || state.phase === "postcombat_main") &&
      state.stack.length === 0
    ) {
      const selectedLand = this.selectBestLandToPlay(
        state,
        player,
        playLandActions,
      );
      if (selectedLand) {
        return selectedLand;
      }
    }

    // Auto-tap mana when there's a pending cast_spell action
    // If we have tap_for_mana actions and a cast_spell action exists,
    // and we need to tap lands to afford the spell, auto-tap
    const tapForManaActions = availableActions.filter(
      (a) => a.type === "tap_for_mana",
    );
    const castSpellActions = filteredActions.filter(
      (a) => a.type === "cast_spell",
    );

    // If we have exactly one spell to cast and need mana, tap lands automatically
    if (
      castSpellActions.length === 1 &&
      tapForManaActions.length > 0 &&
      state.activePlayer === player
    ) {
      const spellAction = castSpellActions[0];
      if (spellAction.type === "cast_spell") {
        const spellCard = state.cards[spellAction.cardId];
        if (spellCard) {
          const playerMana = state[player].manaPool;
          const currentManaTotal = Object.values(playerMana).reduce(
            (sum, v) => sum + v,
            0,
          );

          // If we don't have enough mana yet, tap a land
          if (
            currentManaTotal < spellCard.cmc &&
            tapForManaActions.length > 0
          ) {
            // Find the best land to tap (prefer basics that match spell colors)
            const spellColors = this.parseManaCostColors(
              spellCard.manaCost || "",
            );
            let bestTap = tapForManaActions[0];

            for (const tapAction of tapForManaActions) {
              if (tapAction.type === "tap_for_mana") {
                const landCard = state.cards[tapAction.cardId];
                if (landCard) {
                  const landColor = this.getLandColor(landCard);
                  // Prefer lands that produce colors we need
                  if (landColor && spellColors.includes(landColor)) {
                    bestTap = tapAction;
                    break;
                  }
                }
              }
            }

            if (bestTap.type === "tap_for_mana") {
              const landCard = state.cards[bestTap.cardId];
              return {
                action: bestTap,
                reasoning: `Auto-tapping ${landCard?.name || "land"} to cast ${spellCard.name}.`,
              };
            }
          }
        }
      }
    }

    // Auto-tap when ONLY tap_for_mana and pass are available, and we have a castable spell in hand
    // This handles the case where cast_spell isn't available yet because we need mana first
    if (
      tapForManaActions.length > 0 &&
      passAction &&
      state.activePlayer === player &&
      (state.phase === "precombat_main" || state.phase === "postcombat_main") &&
      state.stack.length === 0
    ) {
      // Check if the only actions are tap_for_mana, pass_priority, and concede
      const onlyTapAndPass = availableActions.every(
        (a) => a.type === "tap_for_mana" || a.type === "pass_priority" || a.type === "concede",
      );

      if (onlyTapAndPass) {
        // Check if we have a spell in hand that we could cast
        const hand = state[player].handOrder.map((id) => state.cards[id]);
        const playerMana = state[player].manaPool;
        const untappedLandCount = tapForManaActions.length;
        const currentManaTotal = Object.values(playerMana).reduce(
          (sum, v) => sum + v,
          0,
        );
        const potentialMana = currentManaTotal + untappedLandCount;

        // Find a sorcery-speed spell we're trying to cast
        // Skip instants and cards with flash - those should be held up for response opportunities
        // and only cast when there's a valid target and the situation warrants it
        const castableSpell = hand.find((card) => {
          if (!card || card.typeLine?.includes("Land")) return false;
          const isInstant =
            card.typeLine?.includes("Instant") ||
            card.keywords?.includes("flash");
          if (isInstant) return false;
          return card.cmc <= potentialMana;
        });

        if (castableSpell) {
          // Tap a land to work toward casting this spell
          const spellColors = this.parseManaCostColors(
            castableSpell.manaCost || "",
          );
          let bestTap = tapForManaActions[0];

          for (const tapAction of tapForManaActions) {
            if (tapAction.type === "tap_for_mana") {
              const landCard = state.cards[tapAction.cardId];
              if (landCard) {
                const landColor = this.getLandColor(landCard);
                if (landColor && spellColors.includes(landColor)) {
                  bestTap = tapAction;
                  break;
                }
              }
            }
          }

          if (bestTap.type === "tap_for_mana") {
            const landCard = state.cards[bestTap.cardId];
            return {
              action: bestTap,
              reasoning: `Auto-tapping ${landCard?.name || "land"} to cast ${castableSpell.name}.`,
            };
          }
        }
      }
    }

    // No heuristic applies
    return null;
  }

  /**
   * Parse mana cost string to get required colors
   * e.g., "{2}{G}{G}" returns ["G", "G"]
   */
  private parseManaCostColors(manaCost: string): string[] {
    const colors: string[] = [];
    const matches = manaCost.match(/\{([WUBRG])\}/gi) || [];
    for (const match of matches) {
      const color = match.replace(/[{}]/g, "").toUpperCase();
      colors.push(color);
    }
    return colors;
  }

  /**
   * Get the primary color a land produces
   */
  private getLandColor(card: ExtendedGameCard): string | null {
    const typeLine = card.typeLine?.toLowerCase() || "";
    const oracleText = card.oracleText?.toLowerCase() || "";

    if (typeLine.includes("plains") || oracleText.includes("add {w}"))
      return "W";
    if (typeLine.includes("island") || oracleText.includes("add {u}"))
      return "U";
    if (typeLine.includes("swamp") || oracleText.includes("add {b}"))
      return "B";
    if (typeLine.includes("mountain") || oracleText.includes("add {r}"))
      return "R";
    if (typeLine.includes("forest") || oracleText.includes("add {g}"))
      return "G";

    return null; // Colorless or unknown
  }

  /**
   * Select the best land to play from multiple options
   * Prefers tapped lands early in the game unless untapped lands provide immediate advantage
   */
  private selectBestLandToPlay(
    state: FullPlaytestGameState,
    player: PlayerId,
    playLandActions: GameAction[],
  ): { action: GameAction; reasoning: string } | null {
    const isEarlyGame = state.turnNumber <= 4;

    // Categorize lands as tapped or untapped
    const tappedLands: GameAction[] = [];
    const untappedLands: GameAction[] = [];

    for (const action of playLandActions) {
      if (action.type === "play_land") {
        const card = state.cards[action.cardId];
        if (!card) continue;

        const willEnterTapped = this.willLandEnterTapped(card, state, player);
        if (willEnterTapped) {
          tappedLands.push(action);
        } else {
          untappedLands.push(action);
        }
      }
    }

    // If no tapped lands available, or not early game, let LLM decide
    if (tappedLands.length === 0 || !isEarlyGame) {
      return null;
    }

    // Check if playing an untapped land provides immediate advantage
    const hasImmediateAdvantage = this.untappedLandProvidesAdvantage(
      state,
      player,
      untappedLands,
    );

    // If untapped land provides advantage, let LLM decide between them
    if (hasImmediateAdvantage) {
      return null;
    }

    // Prefer tapped land - select the first one
    const selectedAction = tappedLands[0];
    if (selectedAction.type === "play_land") {
      const card = state.cards[selectedAction.cardId];
      return {
        action: selectedAction,
        reasoning: `Playing ${card?.name || "tapped land"} early (no immediate need for untapped mana).`,
      };
    }

    return null;
  }

  /**
   * Check if a land will enter the battlefield tapped
   */
  private willLandEnterTapped(
    card: ExtendedGameCard,
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): boolean {
    if (!card.oracleText) return false;

    const oracleTextLower = card.oracleText.toLowerCase();

    // Check if there's any "enters tapped" pattern
    const hasTappedClause =
      oracleTextLower.includes("enters the battlefield tapped") ||
      oracleTextLower.includes("enters tapped") ||
      oracleTextLower.includes("enter the battlefield tapped") ||
      oracleTextLower.includes("enter tapped");

    if (!hasTappedClause) return false;

    // Check for conditional "unless" clause
    if (oracleTextLower.includes("unless")) {
      // Simple check - if we control the required land type, it enters untapped
      // This is a simplified version - full logic is in game-engine.service
      const controlsRequiredLand = this.checkUnlessCondition(
        oracleTextLower,
        state,
        controller,
      );
      return !controlsRequiredLand;
    }

    // No "unless" clause - enters tapped unconditionally
    return true;
  }

  /**
   * Simple check for "unless you control" conditions
   */
  private checkUnlessCondition(
    oracleTextLower: string,
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): boolean {
    // Extract condition after "unless"
    const unlessMatch = oracleTextLower.match(
      /unless\s+you\s+control\s+(.+?)(?:\.|$)/,
    );
    if (!unlessMatch) return false;

    const conditionText = unlessMatch[1];

    // Check for basic land types
    const basicLandTypes = ["plains", "island", "swamp", "mountain", "forest"];
    const battlefield = state.battlefieldOrder[controller];

    for (const cardId of battlefield) {
      const card = state.cards[cardId];
      if (!card || !card.typeLine?.toLowerCase().includes("land")) continue;

      const cardTypeLine = card.typeLine.toLowerCase();

      // Check if card matches any required land type
      for (const landType of basicLandTypes) {
        if (
          conditionText.includes(landType) &&
          cardTypeLine.includes(landType)
        ) {
          return true;
        }
      }

      // Check for "basic land" condition
      if (
        conditionText.includes("basic land") &&
        cardTypeLine.includes("basic")
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if playing an untapped land provides immediate advantage
   * (e.g., can cast a spell this turn with the untapped land)
   */
  private untappedLandProvidesAdvantage(
    state: FullPlaytestGameState,
    player: PlayerId,
    untappedLands: GameAction[],
  ): boolean {
    if (untappedLands.length === 0) return false;

    const playerState = state[player];
    const hand = playerState.handOrder.map((id) => state.cards[id]);

    // Count current available mana
    const currentPool = playerState.manaPool;
    const currentManaTotal = Object.values(currentPool).reduce(
      (sum, v) => sum + v,
      0,
    );

    // Count untapped mana sources on battlefield
    let untappedManaCount = 0;
    for (const cardId of state.battlefieldOrder[player]) {
      const card = state.cards[cardId];
      if (!card || card.isTapped) continue;

      const canProduceMana =
        card.typeLine?.includes("Land") ||
        card.oracleText?.includes("{T}: Add");

      const hasSummoningSickness =
        card.typeLine?.includes("Creature") &&
        card.summoningSickness &&
        !card.keywords.includes("haste");

      if (canProduceMana && !hasSummoningSickness) {
        untappedManaCount++;
      }
    }

    const potentialManaWithUntappedLand =
      currentManaTotal + untappedManaCount + 1;
    const potentialManaWithTappedLand = currentManaTotal + untappedManaCount;

    // Check if any castable spells in hand would benefit from the extra untapped mana
    for (const card of hand) {
      if (!card || card.typeLine?.includes("Land")) continue;

      // Skip instants with flash - those should be held for responses
      const isInstantSpeed =
        card.typeLine?.includes("Instant") || card.keywords?.includes("flash");
      if (isInstantSpeed) continue;

      const cmc = card.cmc || 0;

      // If we can cast this spell with untapped land but not with tapped land
      if (
        cmc <= potentialManaWithUntappedLand &&
        cmc > potentialManaWithTappedLand
      ) {
        return true; // Untapped land enables casting this spell
      }
    }

    return false; // No immediate advantage
  }
}
