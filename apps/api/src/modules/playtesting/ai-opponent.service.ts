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
   * Wrap a promise with a timeout to prevent indefinite hangs
   * @param promise The promise to wrap
   * @param timeoutMs Timeout in milliseconds (default: 30000ms = 30 seconds)
   * @param errorMessage Error message if timeout occurs
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = 30000,
    errorMessage: string = "API call timed out"
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      ),
    ]);
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
            .filter((card) => card?.typeLine?.includes("Land"))
            .map((card) => ({ name: card?.name, tapped: card?.isTapped })),
          permanents: state.battlefieldOrder[player]
            .map((id) => state.cards[id])
            .filter((card) => !card?.typeLine?.includes("Land"))
            .map((card) => ({ name: card?.name, tapped: card?.isTapped })),
        },
        null,
        2,
      ),
    );
    // Filter tap_for_mana - castSpell() auto-taps lands via spendManaForCost(),
    // so tap_for_mana is redundant for both heuristics and LLM decisions
    const actionableActions = availableActions.filter(a => a.type !== "tap_for_mana");

    // Check if heuristics can handle this decision
    const heuristicResult = this.getHeuristicAction(
      state,
      player,
      actionableActions,
    );
    if (heuristicResult) {
      return heuristicResult;
    }

    // Build the decision prompt
    const prompt = this.buildDecisionPrompt(state, player, actionableActions);
    const systemPrompt = this.getSystemPrompt();

    console.log("[AI] Decision prompt:", prompt);

    try {
      const response = await this.withTimeout(
        this.anthropic.beta.promptCaching.messages.create({
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
        }),
        30000,
        "AI decision timed out after 30 seconds"
      );

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
        const decision = this.parseDecision(content.text, actionableActions);
        decision.tokenUsage = tokenUsage;
        return decision;
      }
    } catch (error) {
      console.error("[AI] Error getting AI decision:", error);
      this.logApiError(error);
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
11. **Synergy Awareness** - Before sacrificing or consuming tokens/permanents, check if other permanents you control have abilities that use them. For example, don't sacrifice a token for a small effect if another permanent can turn that token into something much more valuable. Read the oracle text of your permanents carefully to identify synergies between cards

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
${this.formatCastableSpellsAnalysis(state, player)}

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
          const oracleText = c.oracleText?.trim();
          const hasAbilities = oracleText && !c.keywords.some((k) => oracleText.toLowerCase() === k.toLowerCase());
          const abilityInfo = hasAbilities ? ` | ${oracleText}` : "";
          return `  - ${c.name} ${c.power}/${c.toughness}${status}${c.keywords.length > 0 ? ` [${c.keywords.join(", ")}]` : ""}${abilityInfo}`;
        })
        .join("\n")}\n`;
    }

    if (others.length > 0) {
      result += `Other permanents (${others.length}):\n${others
        .map((c) => {
          let status = "";
          if (c.isTapped) status += " (T)";
          const counters = Object.entries(c.counters)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ");
          if (counters) status += ` {${counters}}`;
          const oracleText = c.oracleText?.trim();
          return `  - ${c.name}${status}${oracleText ? ` | ${oracleText}` : ""}`;
        })
        .join("\n")}\n`;
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
      // Use negative lookbehind to exclude granted abilities (e.g. 'gain "{T}: Add...')
      const hasTapAbility = /(?<!")\{T\}: Add/.test(card.oracleText || "");
      const canProduceMana =
        card.typeLine?.includes("Land") || hasTapAbility;

      // Creatures with summoning sickness can't tap for mana (unless they have haste)
      const hasSummoningSickness =
        card.typeLine?.includes("Creature") &&
        card.summoningSickness &&
        !card.keywords.includes("haste");

      // Check activation conditions (e.g. Temple of the False God)
      const meetsCondition = this.meetsActivationCondition(card, state, player);

      // Exclude fetch-only lands (they sacrifice to search, they don't produce mana).
      // But include lands that ALSO have a separate mana ability (e.g., Myriad Landscape: {T}: Add {C})
      const oracleTextLower = card.oracleText?.toLowerCase() || "";
      const isFetchOnly =
        oracleTextLower.includes("sacrifice") &&
        oracleTextLower.includes("search your library") &&
        oracleTextLower.includes("basic land") &&
        !(card.oracleText || "").split("\n").some(
          (line) =>
            /\{T\}: Add/i.test(line) && !line.toLowerCase().includes("sacrifice"),
        );

      if (canProduceMana && !hasSummoningSickness && meetsCondition && !isFetchOnly) {
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
   */
  private formatCastableSpellsAnalysis(
    state: FullPlaytestGameState,
    player: PlayerId,
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

      // Check activation conditions (e.g. Temple of the False God)
      const meetsCondition = this.meetsActivationCondition(card, state, player);

      // Exclude fetch-only lands (they sacrifice to search, they don't produce mana).
      // But include lands that ALSO have a separate mana ability (e.g., Myriad Landscape: {T}: Add {C})
      const oracleTextCheck = card.oracleText?.toLowerCase() || "";
      const isFetchOnlyCheck =
        oracleTextCheck.includes("sacrifice") &&
        oracleTextCheck.includes("search your library") &&
        oracleTextCheck.includes("basic land") &&
        !(card.oracleText || "").split("\n").some(
          (line) =>
            /\{T\}: Add/i.test(line) && !line.toLowerCase().includes("sacrifice"),
        );

      if (canProduceMana && !hasSummoningSickness && meetsCondition && !isFetchOnlyCheck) {
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

    // Count creatures on player's battlefield for spell usefulness checks
    const playerCreatureCount = state.battlefieldOrder[player]
      .map((id) => state.cards[id])
      .filter((card) => card?.typeLine?.includes("Creature")).length;

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
        // Warn if spell only affects creatures you control but you have none
        const oracleLower = (card.oracleText || "").toLowerCase();
        const affectsYourCreatures =
          oracleLower.includes("creatures you control") ||
          oracleLower.includes("each creature you control");
        const noEffectWarning =
          affectsYourCreatures && playerCreatureCount === 0
            ? " -- WARNING: you have NO creatures, this spell would have no effect. Do NOT cast."
            : "";
        spellAnalysis.push(
          `- ${card.name} (${costDisplay}) - CAN CAST with ${cmc} mana${noEffectWarning}`,
        );
      } else {
        spellAnalysis.push(
          `- ${card.name} (${costDisplay}) - CANNOT CAST (needs ${cmc} mana, you have ${effectiveTotalMana} available)`,
        );
      }
    }

    if (spellAnalysis.length === 0) {
      return "(No spells in hand to analyze)";
    }

    return spellAnalysis.join("\n");
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
        let castDesc = `Cast: ${card?.name || "Unknown"} (${card?.manaCost || "free"})`;
        if (action.targets?.length) {
          const targetNames = action.targets
            .map((t) => {
              if (t.type === "player") return t.id;
              const tc = state.cards[t.id];
              if (!tc) return "Unknown";
              const owner =
                tc.controller === state.activePlayer ? "your" : "opponent's";
              return `${owner} ${tc.name}`;
            })
            .join(", ");
          castDesc += ` targeting ${targetNames}`;
        }
        return castDesc;
      }

      case "activate_ability": {
        const card = state.cards[action.cardId];
        if (!card) return `Activate ability of Unknown`;
        const oracleLower = card.oracleText?.toLowerCase() || "";
        if (
          oracleLower.includes("sacrifice") &&
          oracleLower.includes("search your library") &&
          oracleLower.includes("basic land")
        ) {
          return `Activate ${card.name}: Sacrifice to search library for a basic land (enters tapped)`;
        }
        // Show parsed ability details for general activated abilities
        const abilityLine = this.getActivatedAbilityLine(card, action.abilityIndex);
        if (abilityLine) {
          const counters = Object.entries(card.counters)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ");
          const counterInfo = counters ? ` [has ${counters} counter(s)]` : "";
          return `Activate ${card.name}: ${abilityLine.costText} → ${abilityLine.effectText}${counterInfo}`;
        }
        return `Activate ability of ${card.name}`;
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
   * Extract the Nth activated ability line from a card's oracle text.
   * Lightweight version of GameEngineService.parseActivatedAbilities for display purposes.
   */
  private getActivatedAbilityLine(
    card: ExtendedGameCard,
    abilityIndex: number,
  ): { costText: string; effectText: string } | null {
    if (!card.oracleText) return null;

    const cleanedText = card.oracleText.replace(/\([^)]*\)/g, "").trim();
    const lines = cleanedText.split("\n");
    let abilityCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip triggered/static/loyalty abilities
      if (/^(?:when|whenever|at the|this)\b/i.test(trimmed)) continue;
      if (/^[+\-]?\d+\s*:/.test(trimmed)) continue;

      // Find colon not inside curly braces
      let depth = 0;
      let colonIdx = -1;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === "{") depth++;
        else if (trimmed[i] === "}") depth--;
        else if (trimmed[i] === ":" && depth === 0) { colonIdx = i; break; }
      }
      if (colonIdx === -1) continue;

      const costText = trimmed.substring(0, colonIdx).trim();
      const effectText = trimmed.substring(colonIdx + 1).trim();
      if (!costText || !effectText) continue;

      // Must contain a recognizable cost element
      const hasCost =
        /\{[TQWUBRGC\d]+\}/i.test(costText) ||
        /\b(?:sacrifice|remove|pay|discard|exile|tap)\b/i.test(costText);
      if (!hasCost) continue;

      // Exclude mana abilities
      if (/^add\b/i.test(effectText) && /^\{T\}$/.test(costText.replace(/,\s*/g, "").trim())) continue;

      // Exclude fetch lands
      const fullLower = trimmed.toLowerCase();
      if (fullLower.includes("sacrifice") && fullLower.includes("search your library") && fullLower.includes("basic land")) continue;

      if (abilityCount === abilityIndex) {
        return { costText, effectText };
      }
      abilityCount++;
    }

    return null;
  }

  /**
   * Check if a fetch land's ability has a mana cost beyond {T} and sacrifice.
   * For example, Myriad Landscape costs {2} in addition to {T} and sacrifice.
   */
  private fetchLandHasManaCost(card: ExtendedGameCard): boolean {
    if (!card?.oracleText) return false;

    const lines = card.oracleText.replace(/\([^)]*\)/g, "").split("\n");
    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      if (
        lower.includes("sacrifice") &&
        lower.includes("search your library") &&
        lower.includes("basic land")
      ) {
        // Find colon separating cost from effect (not inside braces)
        let depth = 0;
        let colonIdx = -1;
        const trimmed = line.trim();
        for (let i = 0; i < trimmed.length; i++) {
          if (trimmed[i] === "{") depth++;
          else if (trimmed[i] === "}") depth--;
          else if (trimmed[i] === ":" && depth === 0) {
            colonIdx = i;
            break;
          }
        }
        if (colonIdx === -1) return false;

        const costPart = trimmed.substring(0, colonIdx);
        // Check for mana symbols other than {T}
        const manaSymbols = costPart.match(/\{[WUBRGC\d]+\}/gi) || [];
        return manaSymbols.some((s) => s.toUpperCase() !== "{T}");
      }
    }
    return false;
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
      const response = await this.withTimeout(
        this.anthropic.beta.promptCaching.messages.create({
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
        }),
        30000,
        "AI attacker decision timed out after 30 seconds"
      );

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
      this.logApiError(error);
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
      const response = await this.withTimeout(
        this.anthropic.beta.promptCaching.messages.create({
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
        }),
        30000,
        "AI blocker decision timed out after 30 seconds"
      );

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
      this.logApiError(error);
    }

    return { blockers: [] };
  }

  /**
   * Decide whether to mulligan the opening hand
   * Simple heuristic: keep 3-5 land hands, mulligan the rest.
   * For exactly 2 lands, keep if we have mana rocks or mana dorks.
   */
  async decideMulligan(
    state: FullPlaytestGameState,
    player: PlayerId,
    mulliganCount: number,
  ): Promise<{ keep: boolean; reasoning: string; tokenUsage?: TokenUsage }> {
    const playerState = state[player];
    const hand = playerState.handOrder.map((id) => state.cards[id]);

    // After 3+ mulligans, always keep (going to 4 cards or fewer is usually bad)
    if (mulliganCount >= 3) {
      return {
        keep: true,
        reasoning: `Keeping after ${mulliganCount} mulligans - can't go lower`,
      };
    }

    const landCount = hand.filter((c) => c.typeLine?.includes("Land")).length;

    // 3-5 lands: always keep
    if (landCount >= 3 && landCount <= 5) {
      return {
        keep: true,
        reasoning: `Keeping with ${landCount} lands`,
      };
    }

    // 0-1 lands: always mulligan
    if (landCount < 2) {
      return {
        keep: false,
        reasoning: `Mulliganing: only ${landCount} land${landCount === 1 ? "" : "s"}`,
      };
    }

    // 6+ lands: always mulligan
    if (landCount > 5) {
      return {
        keep: false,
        reasoning: `Mulliganing: ${landCount} lands is too many`,
      };
    }

    // Exactly 2 lands: keep if we have mana acceleration (Sol Ring, Arcane Signet, or mana dorks)
    const hasManaAcceleration = hand.some((c) => {
      const name = c.name?.toLowerCase() || "";
      if (name === "sol ring" || name === "arcane signet") return true;
      // Mana dork: creature that taps to add mana
      const isCreature = c.typeLine?.includes("Creature");
      const tapForMana = /\{T\}.*[Aa]dd/.test(c.oracleText || "");
      return isCreature && tapForMana;
    });

    if (hasManaAcceleration) {
      const accelCards = hand
        .filter((c) => {
          const name = c.name?.toLowerCase() || "";
          if (name === "sol ring" || name === "arcane signet") return true;
          const isCreature = c.typeLine?.includes("Creature");
          const tapForMana = /\{T\}.*[Aa]dd/.test(c.oracleText || "");
          return isCreature && tapForMana;
        })
        .map((c) => c.name);
      return {
        keep: true,
        reasoning: `Keeping 2 lands with mana acceleration: ${accelCards.join(", ")}`,
      };
    }

    return {
      keep: false,
      reasoning: `Mulliganing: only 2 lands and no mana acceleration`,
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
      const response = await this.withTimeout(
        this.anthropic.beta.promptCaching.messages.create({
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
        }),
        30000,
        "AI bottom cards decision timed out after 30 seconds"
      );

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
      this.logApiError(error);
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
    // (tap_for_mana already filtered upstream in decideAction)
    const filteredActions = availableActions.filter(
      (action) => action.type !== "concede",
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

    // Auto-activate zero-cost fetch lands during main phase (the found land enters tapped anyway,
    // so there's no strategic reason to hold the fetch land in most cases).
    // Fetch lands with mana costs (e.g., Myriad Landscape: {2}, {T}, Sacrifice) are left to the LLM.
    if (
      state.activePlayer === player &&
      (state.phase === "precombat_main" || state.phase === "postcombat_main") &&
      state.stack.length === 0
    ) {
      const activateAbilityActions = filteredActions.filter(
        (a) => a.type === "activate_ability",
      );
      for (const abilityAction of activateAbilityActions) {
        if (abilityAction.type === "activate_ability") {
          const abilityCard = state.cards[abilityAction.cardId];
          const oracleLower = abilityCard?.oracleText?.toLowerCase() || "";
          if (
            oracleLower.includes("sacrifice") &&
            oracleLower.includes("search your library") &&
            oracleLower.includes("basic land") &&
            !this.fetchLandHasManaCost(abilityCard)
          ) {
            return {
              action: abilityAction,
              reasoning: `Activating ${abilityCard?.name || "fetch land"} to search for a basic land.`,
            };
          }
        }
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

    // Auto-cast when there's exactly one castable permanent spell with no targeting decision.
    // Only auto-cast permanents (creatures, artifacts, enchantments, planeswalkers) since
    // they always advance the board. Instants and sorceries are situational and need LLM evaluation.
    // spendManaForCost() in castSpell() handles auto-tapping all needed lands at once,
    // so we just return the cast_spell action directly instead of tapping one land at a time
    const castSpellActions = filteredActions.filter(
      (a) => a.type === "cast_spell",
    );

    if (
      castSpellActions.length === 1 &&
      state.activePlayer === player
    ) {
      const spellAction = castSpellActions[0];
      if (spellAction.type === "cast_spell" && !spellAction.targets?.length) {
        const spellCard = state.cards[spellAction.cardId];
        if (spellCard) {
          // Only auto-cast permanents - instants/sorceries are situational
          const isPermanent = spellCard.typeLine &&
            !spellCard.typeLine.includes("Instant") &&
            !spellCard.typeLine.includes("Sorcery");
          if (isPermanent) {
            return {
              action: spellAction,
              reasoning: `Auto-casting ${spellCard.name} (only castable spell, no targets).`,
            };
          }
        }
      }
    }

    // No heuristic applies
    return null;
  }

  /**
   * Check if a card's mana ability can currently be activated.
   * Handles "Activate only if..." conditions (e.g. Temple of the False God).
   */
  private meetsActivationCondition(
    card: ExtendedGameCard,
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): boolean {
    const oracleText = card.oracleText?.toLowerCase() || "";

    const activateOnlyMatch = oracleText.match(
      /activate(?:\s+this\s+ability)?\s+only\s+if\s+you\s+control\s+(\w+)\s+or\s+more\s+(\w+)/,
    );
    if (activateOnlyMatch) {
      const wordMap: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      };
      const requiredCount =
        wordMap[activateOnlyMatch[1].toLowerCase()] ||
        parseInt(activateOnlyMatch[1], 10) ||
        0;
      const permanentType = activateOnlyMatch[2];
      const singularType = permanentType.replace(/s$/, "");

      let count = 0;
      for (const cardId of state.battlefieldOrder[controller]) {
        const permanent = state.cards[cardId];
        if (!permanent) continue;
        if (permanent.typeLine?.toLowerCase().includes(singularType)) {
          count++;
        }
      }

      if (count < requiredCount) {
        return false;
      }
    }

    return true;
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

      // Check activation conditions (e.g. Temple of the False God)
      const meetsCondition = this.meetsActivationCondition(card, state, player);

      // Exclude fetch lands
      const oText = card.oracleText?.toLowerCase() || "";
      const isFetch =
        oText.includes("sacrifice") &&
        oText.includes("search your library") &&
        oText.includes("basic land");

      if (canProduceMana && !hasSummoningSickness && meetsCondition && !isFetch) {
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

  /**
   * Log detailed API error information (Anthropic errors, network errors, etc.)
   */
  private logApiError(error: any): void {
    if (!error) return;

    if (error.status) {
      console.error(
        `[AI] API Error - Status: ${error.status}, Type: ${error.error?.type || "unknown"}, Message: ${error.error?.message || error.message}`,
      );
      if (error.headers) {
        const retryAfter = error.headers["retry-after"];
        if (retryAfter) {
          console.error(`[AI] API retry-after: ${retryAfter}s`);
        }
      }
    } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
      console.error(`[AI] Network Error - Code: ${error.code}, Message: ${error.message}`);
    }
  }
}
