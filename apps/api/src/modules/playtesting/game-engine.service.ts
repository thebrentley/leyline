import { Injectable, forwardRef, Inject } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import type {
  FullPlaytestGameState,
  PlaytestEvent,
  GamePhase,
  GameStep,
  PlayerId,
  ExtendedGameCard,
  StackItem,
  GameAction,
  AttackerInfo,
  BlockerInfo,
  ManaPool,
  GameLogEntry,
  CombatDamageInfo,
  GameWatch,
} from "@leyline/shared";
import { SpellEffectsService } from "./spell-effects/spell-effects.service";
import { LLMSpellResolutionService } from "./llm-spell-resolution.service";
import { KeywordAbilitiesService } from "./keyword-abilities.service";
import { TokensService } from "./tokens.service";
import { SearchService } from "./search.service";
import { LandSelectionService } from "./land-selection.service";

// Re-export PlaytestEvent for use in spell effects
export type { PlaytestEvent } from "@leyline/shared";

export interface ParsedActivatedAbility {
  costText: string;       // Raw cost string, e.g. "{1}, {T}, Remove a page counter from Tome of Legends"
  effectText: string;     // Raw effect string, e.g. "Draw a card."
  costs: {
    manaCost: string | null;    // e.g. "{1}" or "{2}{B}"
    tapSelf: boolean;           // {T} in cost
    removedCounters: { type: string; count: number } | null;
    sacrificeSelf: boolean;
    payLife: number | null;
  };
}

@Injectable()
export class GameEngineService {
  constructor(
    @Inject(forwardRef(() => SpellEffectsService))
    private spellEffectsService: SpellEffectsService,
    @Inject(forwardRef(() => LLMSpellResolutionService))
    private llmSpellResolutionService: LLMSpellResolutionService,
    @Inject(forwardRef(() => KeywordAbilitiesService))
    private keywordService: KeywordAbilitiesService,
    @Inject(forwardRef(() => TokensService))
    private tokensService: TokensService,
    @Inject(forwardRef(() => SearchService))
    private searchService: SearchService,
    @Inject(forwardRef(() => LandSelectionService))
    private landSelectionService: LandSelectionService,
  ) {}

  // =====================
  // MDFC (Modal Double-Faced Card) Helpers
  // =====================

  /**
   * Switch an MDFC's active properties to a given face index.
   * Updates name, typeLine, oracleText, manaCost, power, toughness, imageUrl, and keywords.
   */
  private switchToFace(card: ExtendedGameCard, faceIndex: number): void {
    if (!card.cardFaces || faceIndex >= card.cardFaces.length) return;
    const face = card.cardFaces[faceIndex];
    card.activeFaceIndex = faceIndex;
    card.name = face.name;
    card.typeLine = face.typeLine;
    card.oracleText = face.oracleText ?? null;
    card.manaCost = face.manaCost ?? null;
    card.power = face.power ?? null;
    card.toughness = face.toughness ?? null;
    card.imageUrl = face.imageUri ?? card.imageUrl;
    card.keywords = this.keywordService.parseKeywords(face.oracleText ?? null, face.typeLine);
  }

  /**
   * Revert an MDFC to its front face (index 0).
   * Called when a card leaves the battlefield (MTG rule: DFCs revert to front face in other zones).
   */
  private revertToFrontFace(card: ExtendedGameCard): void {
    if (card.layout === 'modal_dfc' && card.activeFaceIndex && card.activeFaceIndex !== 0) {
      this.switchToFace(card, 0);
    }
  }

  // =====================
  // Turn/Phase Progression
  // =====================

  /**
   * Advance to the next phase or step in the turn structure
   */
  advancePhase(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const { phase, step } = state;

    // Determine next phase/step
    const nextStep = this.getNextStep(phase, step);

    if (nextStep.newTurn) {
      // Start new turn for opposite player
      events.push(...this.startNewTurn(state));
    } else {
      state.phase = nextStep.phase;
      state.step = nextStep.step;

      events.push({
        type: "phase:changed",
        phase: state.phase,
        step: state.step,
        activePlayer: state.activePlayer,
      });

      // Handle phase-specific actions
      events.push(...this.handlePhaseStart(state));
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Get the next step in the turn structure
   */
  private getNextStep(
    phase: GamePhase,
    step: GameStep,
  ): {
    phase: GamePhase;
    step: GameStep;
    newTurn: boolean;
  } {
    // Turn structure: Beginning (untap -> upkeep -> draw) -> Pre-combat Main ->
    // Combat (beginning -> attackers -> blockers -> first_strike -> damage -> end) ->
    // Post-combat Main -> Ending (end -> cleanup)

    switch (phase) {
      case "beginning":
        switch (step) {
          case "untap":
            return { phase: "beginning", step: "upkeep", newTurn: false };
          case "upkeep":
            return { phase: "beginning", step: "draw", newTurn: false };
          case "draw":
            return { phase: "precombat_main", step: "main", newTurn: false };
        }
        break;

      case "precombat_main":
        return { phase: "combat", step: "beginning_of_combat", newTurn: false };

      case "combat":
        switch (step) {
          case "beginning_of_combat":
            return {
              phase: "combat",
              step: "declare_attackers",
              newTurn: false,
            };
          case "declare_attackers":
            return {
              phase: "combat",
              step: "declare_blockers",
              newTurn: false,
            };
          case "declare_blockers":
            // Check if there are first strikers
            return {
              phase: "combat",
              step: "first_strike_damage",
              newTurn: false,
            };
          case "first_strike_damage":
            return { phase: "combat", step: "combat_damage", newTurn: false };
          case "combat_damage":
            return { phase: "combat", step: "end_of_combat", newTurn: false };
          case "end_of_combat":
            return { phase: "postcombat_main", step: "main", newTurn: false };
        }
        break;

      case "postcombat_main":
        return { phase: "ending", step: "end", newTurn: false };

      case "ending":
        switch (step) {
          case "end":
            return { phase: "ending", step: "cleanup", newTurn: false };
          case "cleanup":
            return { phase: "beginning", step: "untap", newTurn: true };
        }
        break;
    }

    // Fallback (shouldn't reach here)
    return { phase: "beginning", step: "untap", newTurn: true };
  }

  /**
   * Start a new turn
   */
  private startNewTurn(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    // Switch active player
    state.activePlayer =
      state.activePlayer === "player" ? "opponent" : "player";
    state.turnNumber++;

    // Reset land plays
    state.player.landPlaysRemaining = 1;
    state.opponent.landPlaysRemaining = 1;

    // Set phase to beginning/untap
    state.phase = "beginning";
    state.step = "untap";

    events.push({
      type: "turn:started",
      turnNumber: state.turnNumber,
      activePlayer: state.activePlayer,
    });

    events.push({
      type: "phase:changed",
      phase: state.phase,
      step: state.step,
      activePlayer: state.activePlayer,
    });

    // Handle untap step
    events.push(...this.handlePhaseStart(state));

    return events;
  }

  /**
   * Handle actions at the start of a phase/step
   */
  private handlePhaseStart(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    switch (state.step) {
      case "untap":
        // Untap all permanents controlled by active player
        events.push(...this.untapStep(state));
        // No priority during untap, automatically advance
        events.push(...this.advancePhase(state));
        break;

      case "upkeep":
        // Priority starts with active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: "priority:changed", player: state.priorityPlayer });
        break;

      case "draw":
        // Active player draws (skip on turn 1 in 2-player)
        if (state.turnNumber > 1 || state.activePlayer === "opponent") {
          events.push(...this.drawCard(state, state.activePlayer));
        }
        // Priority to active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: "priority:changed", player: state.priorityPlayer });
        break;

      case "main":
        // Main phase - priority to active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        // Add lore counters to Sagas at beginning of precombat main phase
        if (state.phase === "precombat_main") {
          events.push(...this.addLoreCountersToSagas(state));
        }
        events.push({ type: "priority:changed", player: state.priorityPlayer });
        break;

      case "beginning_of_combat":
        // Combat begins
        state.combat.isActive = true;
        state.combat.attackers = [];
        state.combat.blockers = [];
        state.combat.damageAssignmentOrder = {};
        events.push({ type: "combat:started" });
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: "priority:changed", player: state.priorityPlayer });
        break;

      case "declare_attackers":
        // Wait for attacker declaration, then priority
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: "priority:changed", player: state.priorityPlayer });
        break;

      case "declare_blockers":
        // Wait for blocker declaration, then priority
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: "priority:changed", player: state.priorityPlayer });
        break;

      case "first_strike_damage":
      case "combat_damage": {
        // Deal combat damage when entering the step
        const isFirstStrike = state.step === "first_strike_damage";
        const damages = this.calculateCombatDamage(state, isFirstStrike);
        if (damages.length > 0) {
          events.push(...this.processCombatDamage(state, damages));
          events.push({ type: "combat:damage", damages });
        }
        // Then priority to active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: "priority:changed", player: state.priorityPlayer });
        break;
      }

      case "end_of_combat":
        events.push({ type: "combat:ended" });
        state.combat.isActive = false;
        state.combat.attackers = [];
        state.combat.blockers = [];
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: "priority:changed", player: state.priorityPlayer });
        break;

      case "end":
        // End step - priority to active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: "priority:changed", player: state.priorityPlayer });
        break;

      case "cleanup":
        // Discard to hand size, damage clears
        events.push(...this.cleanupStep(state));
        // Usually no priority, automatically advance
        events.push(...this.advancePhase(state));
        break;
    }

    return events;
  }

  /**
   * Untap step - untap all permanents controlled by active player
   */
  private untapStep(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const activePlayer = state.activePlayer;

    for (const card of Object.values(state.cards)) {
      if (card.controller === activePlayer && card.zone === "battlefield") {
        // Clear summoning sickness for all creatures at the start of your turn
        if (card.summoningSickness) {
          card.summoningSickness = false;
        }
        // Untap tapped permanents
        if (card.isTapped) {
          card.isTapped = false;
          events.push({
            type: "card:tapped",
            cardId: card.instanceId,
            cardName: card.name,
            player: activePlayer,
            isTapped: false,
          });
        }
      }
    }

    this.addLogEntry(state, events, {
      type: "phase",
      player: activePlayer,
      message: `${activePlayer === "player" ? "Player" : "Opponent"} untaps all permanents`,
    });

    return events;
  }

  /**
   * Cleanup step - discard to hand size, remove damage
   */
  private cleanupStep(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const activePlayer = state.activePlayer;
    const playerState = state[activePlayer];

    // Discard to 7 cards
    while (playerState.handOrder.length > 7) {
      // For now, discard last card in hand (AI will handle this properly)
      const cardId = playerState.handOrder.pop()!;
      const card = state.cards[cardId];
      if (card) {
        events.push(...this.moveCard(state, cardId, "graveyard", activePlayer));
      }
    }

    // Remove damage from creatures
    for (const card of Object.values(state.cards)) {
      if (card.zone === "battlefield" && card.damage > 0) {
        card.damage = 0;
        events.push({
          type: "card:damage",
          cardId: card.instanceId,
          damage: 0,
        });
      }
    }

    // Clear mana pools for both players
    const players: PlayerId[] = ["player", "opponent"];
    for (const playerId of players) {
      const player = state[playerId];
      const hadMana = Object.values(player.manaPool).some(amount => amount > 0);

      if (hadMana) {
        player.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
        events.push({
          type: "mana:changed",
          player: playerId,
          manaPool: { ...player.manaPool },
        });
      }
    }

    return events;
  }

  // =====================
  // Priority System
  // =====================

  /**
   * Pass priority for a player
   */
  async passPriority(
    state: FullPlaytestGameState,
    player: PlayerId,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];
    const otherPlayer: PlayerId = player === "player" ? "opponent" : "player";

    // Mark this player as passed
    state[player].hasPassedPriority = true;

    // Check if other player has also passed
    if (state[otherPlayer].hasPassedPriority) {
      // Both players passed
      if (state.stack.length > 0) {
        // Resolve top of stack
        events.push(...await this.resolveTopOfStack(state));
        // Reset priority passes, active player gets priority
        this.resetPriorityPasses(state);
        state.priorityPlayer = state.activePlayer;
        events.push({ type: "priority:changed", player: state.priorityPlayer });
      } else {
        // Empty stack, advance to next phase/step
        events.push(...this.advancePhase(state));
      }
    } else {
      // Other player gets priority
      state.priorityPlayer = otherPlayer;
      events.push({ type: "priority:changed", player: otherPlayer });
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Reset priority passes for both players
   */
  private resetPriorityPasses(state: FullPlaytestGameState): void {
    state.player.hasPassedPriority = false;
    state.opponent.hasPassedPriority = false;
  }

  // =====================
  // Stack Management
  // =====================

  /**
   * Add an item to the stack
   */
  addToStack(state: FullPlaytestGameState, item: StackItem): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    state.stack.push(item);
    events.push({ type: "stack:added", item });

    // Reset priority passes, active player gets priority
    this.resetPriorityPasses(state);
    state.priorityPlayer = state.activePlayer;
    events.push({ type: "priority:changed", player: state.priorityPlayer });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Resolve the top item on the stack
   */
  async resolveTopOfStack(state: FullPlaytestGameState): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];

    if (state.stack.length === 0) {
      return events;
    }

    const item = state.stack.pop()!;
    events.push({ type: "stack:resolved", itemId: item.id });

    // Handle resolution based on type
    if (item.type === "spell") {
      events.push(...await this.resolveSpell(state, item));
    } else if (item.type === "ability") {
      events.push(...await this.resolveAbility(state, item));
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Resolve a spell (placeholder - will be expanded in Phase 9)
   */
  private async resolveSpell(
    state: FullPlaytestGameState,
    item: StackItem,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];
    const card = state.cards[item.sourceCardId];

    if (!card) return events;

    // Check if it's a permanent spell
    const isPermanent =
      card.typeLine?.includes("Creature") ||
      card.typeLine?.includes("Artifact") ||
      card.typeLine?.includes("Enchantment") ||
      card.typeLine?.includes("Planeswalker") ||
      card.typeLine?.includes("Land");

    // Check if it's an Aura
    const isAura = card.typeLine?.includes("Aura");

    console.log(`[resolveSpell] Resolving ${card.name} (isPermanent: ${isPermanent}, isAura: ${isAura})`);
    if (isAura) {
      console.log(`[resolveSpell] Aura targets:`, item.targets);
    }

    if (isPermanent) {
      if (isAura && item.targets && item.targets.length > 0) {
        // Aura spell - attach to target
        const targetId = item.targets[0].id;
        const target = state.cards[targetId];

        console.log(`[resolveSpell] Aura ${card.name} targeting ${targetId}`);
        console.log(`[resolveSpell] Target card:`, target ? `${target.name} (zone: ${target.zone})` : "not found");

        if (target && target.zone === "battlefield") {
          // Attach aura to the target
          console.log(`[resolveSpell] Attaching ${card.name} to ${target.name}`);
          events.push(
            ...this.attachCard(
              state,
              card.instanceId,
              targetId,
              item.controller,
            ),
          );
        } else {
          // Target invalid - aura fizzles to graveyard
          console.log(`[resolveSpell] Aura ${card.name} fizzled - invalid target`);
          events.push(
            ...this.moveCard(state, card.instanceId, "graveyard", card.owner),
          );
          this.addLogEntry(state, events, {
            type: "play",
            player: item.controller,
            message: `${card.name} fizzled (invalid target)`,
          });
          return events;
        }
      } else if (isAura) {
        // Aura without valid targets - fizzles
        console.log(`[resolveSpell] Aura ${card.name} fizzled - no valid targets provided`);
        events.push(
          ...this.moveCard(state, card.instanceId, "graveyard", card.owner),
        );
        this.addLogEntry(state, events, {
          type: "play",
          player: item.controller,
          message: `${card.name} fizzled (no valid target)`,
        });
        return events;
      } else {
        // Check for copy effects BEFORE entering the battlefield
        const copyInfo = this.isCopyEffect(card);
        if (copyInfo.isCopy) {
          const copyTarget = this.selectCopyTarget(state, card, copyInfo.copyType!);
          if (copyTarget) {
            this.applyCopyEffect(card, copyTarget);
            this.addLogEntry(state, events, {
              type: 'play',
              player: item.controller,
              message: `${card.originalName} enters as a copy of ${copyTarget.name}`,
            });
          }
        }

        // Normal permanent - move to battlefield
        events.push(
          ...this.moveCard(
            state,
            card.instanceId,
            "battlefield",
            item.controller,
          ),
        );
      }

      // Check if permanent should enter tapped
      if (this.shouldEnterTapped(card, state, item.controller)) {
        card.isTapped = true;
        events.push({
          type: "card:tapped",
          cardId: card.instanceId,
          cardName: card.name,
          player: item.controller,
          isTapped: true,
        });
      }

      // Check for ETB triggers and add to stack
      const etbTriggers = this.keywordService.checkETBTriggers(
        state,
        card.instanceId,
      );
      for (const trigger of etbTriggers) {
        events.push(...this.addToStack(state, trigger));
      }

      // Register watches for triggered abilities
      console.log(`[registerWatches] Permanent entering battlefield: ${card.name} (instanceId: ${card.instanceId})`);
      console.log(`[registerWatches] Oracle text: "${card.oracleText || 'none'}"`);
      console.log(`[registerWatches] Current watches before registration:`, state.watches?.length ?? 0);
      this.registerWatchesForCard(state, card);
      console.log(`[registerWatches] Watches after registration:`, state.watches?.length ?? 0);

      // Handle "choose a color" effects (e.g., Utopia Sprawl)
      if (card.oracleText?.toLowerCase().includes("choose a color")) {
        const chosenColor = this.chooseColorForCard(state, card, item.controller);
        if (chosenColor) {
          card.chosenColor = chosenColor;
          this.addLogEntry(state, events, {
            type: "action",
            player: item.controller,
            message: `${item.controller === "player" ? "Player" : "Opponent"} chose ${chosenColor} for ${card.name}`,
          });
        }
      }

      // Apply summoning sickness to creatures
      if (
        card.typeLine?.includes("Creature") &&
        !card.keywords.includes("haste")
      ) {
        card.summoningSickness = true;
      }

      // Saga ETB - add initial lore counter
      if (this.isSaga(card)) {
        card.counters["lore"] = 1;
        events.push({
          type: "card:counters",
          cardId: card.instanceId,
          counters: { ...card.counters },
        });
        this.addLogEntry(state, events, {
          type: "action",
          player: item.controller,
          message: `${card.name} enters with a lore counter (Chapter I)`,
        });
      }

      // Generic ETB counters - parse "enters with X counter(s) on it"
      if (card.oracleText) {
        const etbCounterPattern =
          /enters(?:\s+the\s+battlefield)?\s+with\s+(?:a|an|(\d+)|one|two|three|four|five|six|seven|eight|nine|ten)\s+([\w/+-]+)\s+counters?\s+on\s+it/i;
        const match = card.oracleText.match(etbCounterPattern);
        if (match) {
          const wordToNum: Record<string, number> = {
            a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
            six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
          };
          const rawCount = match[1]; // numeric capture
          const counterType = match[2].toLowerCase(); // e.g. "page", "+1/+1", "charge"
          let count: number;
          if (rawCount) {
            count = parseInt(rawCount, 10);
          } else {
            // Extract the word that matched from the full match
            const wordMatch = match[0].match(
              /with\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s/i,
            );
            count = wordMatch ? (wordToNum[wordMatch[1].toLowerCase()] || 1) : 1;
          }
          // Don't duplicate saga lore counters
          if (!(this.isSaga(card) && counterType === "lore")) {
            card.counters[counterType] = (card.counters[counterType] || 0) + count;
            events.push({
              type: "card:counters",
              cardId: card.instanceId,
              counters: { ...card.counters },
            });
            this.addLogEntry(state, events, {
              type: "action",
              player: item.controller,
              message: `${card.name} enters with ${count} ${counterType} counter${count !== 1 ? "s" : ""}`,
            });
          }
        }
      }
    } else {
      // Instant or sorcery - execute effects, then move to graveyard

      // Check if this spell has a registered hard-coded effect
      if (this.spellEffectsService.hasEffect(card.name)) {
        try {
          const effectEvents = await this.spellEffectsService.executeEffect(
            card.name,
            state,
            item,
            item.controller,
          );
          if (effectEvents) {
            events.push(...effectEvents);
          }
        } catch (error) {
          console.error(`Error executing spell effect for ${card.name}:`, error);
          this.addLogEntry(state, events, {
            type: "action",
            player: item.controller,
            message: `Error executing ${card.name} effect`,
          });
        }
      } else {
        // No hard-coded effect - use LLM-based resolution
        try {
          const effectEvents = await this.llmSpellResolutionService.resolveSpell(
            state,
            item,
            card,
            item.controller,
          );
          if (effectEvents && effectEvents.length > 0) {
            events.push(...effectEvents);
          }
        } catch (error) {
          console.error(`Error resolving spell via LLM for ${card.name}:`, error);
          this.addLogEntry(state, events, {
            type: "action",
            player: item.controller,
            message: `Error resolving ${card.name} effect`,
          });
        }
      }

      // Check if the spell exiles itself (e.g., "Exile Teferi's Protection")
      const oracleText = card.oracleText?.toLowerCase() || "";
      const cardNameLower = card.name.toLowerCase();
      const exilesSelf =
        oracleText.includes(`exile ${cardNameLower}`) ||
        oracleText.includes("exile this spell");

      if (exilesSelf) {
        events.push(
          ...this.moveCard(state, card.instanceId, "exile", card.owner),
        );
      } else {
        // Move to graveyard after resolution
        events.push(
          ...this.moveCard(state, card.instanceId, "graveyard", card.owner),
        );
      }
    }

    this.addLogEntry(state, events, {
      type: "play",
      player: item.controller,
      message: `${item.controller === "player" ? "Player" : "Opponent"} resolved ${card.name}`,
    });

    return events;
  }

  /**
   * Resolve an ability
   * Executes the effect of a triggered or activated ability
   */
  private async resolveAbility(
    state: FullPlaytestGameState,
    item: StackItem,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];

    if (!item.abilityText) {
      this.addLogEntry(state, events, {
        type: "ability",
        player: item.controller,
        message: `${item.controller === "player" ? "Player" : "Opponent"} resolved ability`,
      });
      return events;
    }

    // Parse and execute the ability effect
    const abilityTextLower = item.abilityText.toLowerCase();
    const sourceCard = state.cards[item.sourceCardId];

    // Token creation effects: "create a [Token Name] token" or "create X [Token Name] tokens"
    // Supports both digit quantities ("2") and word quantities ("two", "three", etc.)
    const createTokenMatch = abilityTextLower.match(/create\s+(?:a|an|(\w+))\s+([a-z\s]+?)\s+tokens?/);
    if (createTokenMatch) {
      const wordToNumber: Record<string, number> = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      };
      const rawQuantity = createTokenMatch[1];
      const quantity = rawQuantity
        ? (wordToNumber[rawQuantity] || parseInt(rawQuantity, 10) || 1)
        : 1;
      const tokenName = createTokenMatch[2].trim();

      // Map common token names to token IDs
      const tokenIdMap: Record<string, string> = {
        'food': 'food',
        'treasure': 'treasure',
        'clue': 'clue',
        'blood': 'blood',
        'gold': 'gold',
        'shard': 'shard',
      };

      // Try hardcoded map first, then fall back to DB lookup by name
      let tokenId = tokenIdMap[tokenName];
      if (!tokenId) {
        const dbTokens = await this.tokensService.findTokensByName(
          tokenName.charAt(0).toUpperCase() + tokenName.slice(1),
        );
        if (dbTokens.length > 0) {
          tokenId = dbTokens[0].tokenId;
        }
      }

      if (tokenId) {
        try {
          const tokenInstanceIds = await this.tokensService.createTokens(
            state,
            tokenId,
            item.controller,
            quantity,
          );

          events.push({
            type: 'token:created',
            tokenIds: tokenInstanceIds,
            tokenName: tokenName.charAt(0).toUpperCase() + tokenName.slice(1),
            controller: item.controller,
          });

          this.addLogEntry(state, events, {
            type: "ability",
            player: item.controller,
            message: `${item.controller === "player" ? "Player" : "Opponent"} created ${quantity} ${tokenName.charAt(0).toUpperCase() + tokenName.slice(1)} token${quantity > 1 ? 's' : ''} from ${sourceCard?.name || "ability"}`,
          });
        } catch (error) {
          console.error(`Error creating ${tokenName} token:`, error);
          this.addLogEntry(state, events, {
            type: "ability",
            player: item.controller,
            message: `Failed to create ${tokenName} token (token definition not found)`,
          });
        }
      } else {
        this.addLogEntry(state, events, {
          type: "ability",
          player: item.controller,
          message: `${item.controller === "player" ? "Player" : "Opponent"} resolved ability: ${item.abilityText} (token type not supported yet)`,
        });
      }
    }

    // Life gain effects: "you gain X life" or "gain X life"
    const lifeGainMatch = abilityTextLower.match(/(?:you\s+)?gain\s+(\d+)\s+life/);
    if (lifeGainMatch) {
      const amount = parseInt(lifeGainMatch[1], 10);
      const controller = item.controller;
      state[controller].life += amount;

      events.push({
        type: "life:changed",
        player: controller,
        life: state[controller].life,
        change: amount,
        source: sourceCard?.name,
      });

      this.addLogEntry(state, events, {
        type: "ability",
        player: controller,
        message: `${controller === "player" ? "Player" : "Opponent"} gained ${amount} life from ${sourceCard?.name || "ability"}`,
      });
    }

    // Draw card effects: "draw a card" or "draw X cards"
    const drawMatch = abilityTextLower.match(/draw\s+(?:a|(\d+)|(\w+))\s+cards?/);
    if (drawMatch) {
      const wordToNumber: Record<string, number> = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      };
      const count = drawMatch[1]
        ? parseInt(drawMatch[1], 10)
        : drawMatch[2]
          ? (wordToNumber[drawMatch[2]] || 1)
          : 1;
      const controller = item.controller;

      for (let i = 0; i < count; i++) {
        events.push(...this.drawCard(state, controller));
        if (state.isGameOver) break;
      }

      this.addLogEntry(state, events, {
        type: "ability",
        player: controller,
        message: `${controller === "player" ? "Player" : "Opponent"} drew ${count} card${count > 1 ? 's' : ''} from ${sourceCard?.name || "ability"}`,
      });
    }

    // Damage effects: "deal X damage to target [player/opponent]" or "deals X damage"
    const damageMatch = abilityTextLower.match(/deals?\s+(\d+)\s+damage/);
    if (damageMatch && item.targets.length > 0) {
      const amount = parseInt(damageMatch[1], 10);
      const target = item.targets[0];

      if (target.type === 'player') {
        const targetPlayer = target.id as PlayerId;
        state[targetPlayer].life -= amount;

        events.push({
          type: "life:changed",
          player: targetPlayer,
          life: state[targetPlayer].life,
          change: -amount,
          source: sourceCard?.name,
        });

        this.addLogEntry(state, events, {
          type: "damage",
          player: item.controller,
          message: `${sourceCard?.name || "Ability"} dealt ${amount} damage to ${targetPlayer === "player" ? "Player" : "Opponent"}`,
        });
      } else if (target.type === 'card') {
        // Damage to creature/planeswalker
        const targetCard = state.cards[target.id];
        if (targetCard && targetCard.zone === 'battlefield') {
          targetCard.damage += amount;

          events.push({
            type: "card:damage",
            cardId: target.id,
            damage: targetCard.damage,
            source: item.sourceCardId,
          });

          this.addLogEntry(state, events, {
            type: "damage",
            player: item.controller,
            message: `${sourceCard?.name || "Ability"} dealt ${amount} damage to ${targetCard.name}`,
          });
        }
      }
    }

    // Fetch land ability: search library for basic land(s), put onto battlefield tapped, shuffle
    if (
      abilityTextLower.includes("search your library") &&
      abilityTextLower.includes("basic land") &&
      abilityTextLower.includes("battlefield tapped")
    ) {
      const controller = item.controller;
      const playerName = controller === "player" ? "Player" : "Opponent";

      // Parse how many lands to fetch (e.g., "up to two basic land cards" → 2)
      const countMatch = abilityTextLower.match(/up to (\w+) basic land/);
      const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
      const fetchCount = countMatch
        ? (wordToNum[countMatch[1]] || parseInt(countMatch[1]) || 1)
        : 1;

      // Check if lands must share a land type (e.g., Myriad Landscape)
      const mustShareType = abilityTextLower.includes("share a land type");

      // Search library for all basic lands
      const basicLands = this.searchService.searchLibrary(
        state,
        controller,
        { supertype: "Basic", type: "Land" },
        0,
      );

      if (basicLands.length > 0) {
        let landsToFetch: string[] = [];

        if (fetchCount > 1 && mustShareType) {
          // Group basic lands by their basic land type (Plains, Island, Swamp, Mountain, Forest)
          const landsByType: Record<string, string[]> = {};
          for (const landId of basicLands) {
            const land = state.cards[landId];
            if (!land) continue;
            const basicType = this.getBasicLandType(land);
            if (basicType) {
              if (!landsByType[basicType]) landsByType[basicType] = [];
              landsByType[basicType].push(landId);
            }
          }

          // Pick the best land type: use selectBestLand to determine which type is most needed,
          // then take up to fetchCount of that type
          const bestLandId = await this.landSelectionService.selectBestLand(
            state,
            controller,
            basicLands,
          );
          if (bestLandId) {
            const bestType = this.getBasicLandType(state.cards[bestLandId]);
            if (bestType && landsByType[bestType]) {
              landsToFetch = landsByType[bestType].slice(0, fetchCount);
            } else {
              landsToFetch = [bestLandId];
            }
          }
        } else if (fetchCount > 1) {
          // Multiple lands, no shared type constraint
          for (let i = 0; i < fetchCount && basicLands.length > 0; i++) {
            const selectedId = await this.landSelectionService.selectBestLand(
              state,
              controller,
              basicLands,
            );
            if (selectedId) {
              landsToFetch.push(selectedId);
              basicLands.splice(basicLands.indexOf(selectedId), 1);
            }
          }
        } else {
          // Single land fetch (most common case)
          const selectedId = await this.landSelectionService.selectBestLand(
            state,
            controller,
            basicLands,
          );
          if (selectedId) {
            landsToFetch = [selectedId];
          }
        }

        const fetchedNames: string[] = [];
        for (const landId of landsToFetch) {
          const land = state.cards[landId];
          if (!land) continue;

          // Move land from library to battlefield
          events.push(
            ...this.moveCard(state, landId, "battlefield", controller),
          );

          // Force the land to enter tapped
          land.isTapped = true;
          events.push({
            type: "card:tapped",
            cardId: landId,
            cardName: land.name,
            player: controller,
            isTapped: true,
          });

          fetchedNames.push(land.name);
        }

        if (fetchedNames.length > 0) {
          this.addLogEntry(state, events, {
            type: "ability",
            player: controller,
            message: `${playerName} searches and puts ${fetchedNames.join(" and ")} onto the battlefield tapped`,
          });
        }
      } else {
        this.addLogEntry(state, events, {
          type: "ability",
          player: controller,
          message: `${playerName} searches but finds no basic lands`,
        });
      }

      // Shuffle library (always, even if no land found — per MTG rules)
      const library = state[controller].libraryOrder;
      for (let i = library.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [library[i], library[j]] = [library[j], library[i]];
      }

      events.push({
        type: "zone:shuffled",
        zone: "library",
        player: controller,
      });

      this.addLogEntry(state, events, {
        type: "ability",
        player: controller,
        message: `${playerName} shuffles their library`,
      });
    }

    // If no specific effect was parsed, try LLM resolution as fallback
    if (events.length === 0 && item.abilityText) {
      const sourceCardForLLM = state.cards[item.sourceCardId];
      if (sourceCardForLLM) {
        try {
          const llmEvents = await this.llmSpellResolutionService.resolveSpell(
            state,
            item,
            {
              ...sourceCardForLLM,
              oracleText: item.abilityText,
            } as ExtendedGameCard,
            item.controller,
          );
          events.push(...llmEvents);
        } catch (error) {
          console.error(`[resolveAbility] LLM fallback failed for: ${item.abilityText}`, error);
          this.addLogEntry(state, events, {
            type: "ability",
            player: item.controller,
            message: `${item.controller === "player" ? "Player" : "Opponent"} resolved ability: ${item.abilityText}`,
          });
        }
      } else {
        this.addLogEntry(state, events, {
          type: "ability",
          player: item.controller,
          message: `${item.controller === "player" ? "Player" : "Opponent"} resolved ability: ${item.abilityText}`,
        });
      }
    }

    return events;
  }

  // =====================
  // State-Based Actions
  // =====================

  /**
   * Check and perform state-based actions
   * Returns events for any SBAs performed
   */
  checkStateBasedActions(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    let sbaPerformed = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 100; // Safety limit to prevent infinite loops

    // Keep checking until no more SBAs are performed
    while (sbaPerformed) {
      iterationCount++;

      if (iterationCount > MAX_ITERATIONS) {
        console.error(`[checkStateBasedActions] INFINITE LOOP DETECTED! Breaking after ${MAX_ITERATIONS} iterations`);
        console.error(`[checkStateBasedActions] Game state:`, {
          phase: state.phase,
          step: state.step,
          turnNumber: state.turnNumber,
          activePlayer: state.activePlayer,
          stackLength: state.stack.length,
          battlefieldCards: Object.values(state.cards).filter(c => c.zone === 'battlefield').map(c => ({
            name: c.name,
            typeLine: c.typeLine,
            counters: c.counters,
            zone: c.zone,
          })),
        });
        break;
      }

      sbaPerformed = false;

      if (iterationCount > 5) {
        console.log(`[checkStateBasedActions] Iteration ${iterationCount}`);
      }

      // Check player life totals
      if (state.player.life <= 0 && !state.isGameOver) {
        console.log(`[checkStateBasedActions] SBA: Player life <= 0`);
        state.isGameOver = true;
        state.winner = "opponent";
        state.gameOverReason = "Player life reached 0";
        events.push({
          type: "game:over",
          winner: "opponent",
          reason: state.gameOverReason,
        });
        sbaPerformed = true;
      }

      if (state.opponent.life <= 0 && !state.isGameOver) {
        state.isGameOver = true;
        state.winner = "player";
        state.gameOverReason = "Opponent life reached 0";
        events.push({
          type: "game:over",
          winner: "player",
          reason: state.gameOverReason,
        });
        sbaPerformed = true;
      }

      // Check poison counters
      if (state.player.poisonCounters >= 10 && !state.isGameOver) {
        state.isGameOver = true;
        state.winner = "opponent";
        state.gameOverReason = "Player received 10 poison counters";
        events.push({
          type: "game:over",
          winner: "opponent",
          reason: state.gameOverReason,
        });
        sbaPerformed = true;
      }

      if (state.opponent.poisonCounters >= 10 && !state.isGameOver) {
        state.isGameOver = true;
        state.winner = "player";
        state.gameOverReason = "Opponent received 10 poison counters";
        events.push({
          type: "game:over",
          winner: "player",
          reason: state.gameOverReason,
        });
        sbaPerformed = true;
      }

      // Check creatures with lethal damage or 0 toughness
      for (const card of Object.values(state.cards)) {
        if (
          card.zone === "battlefield" &&
          card.typeLine?.includes("Creature")
        ) {
          const toughness = this.parsePowerToughness(card.toughness);
          const effectiveToughness =
            toughness +
            (card.counters["+1/+1"] || 0) -
            (card.counters["-1/-1"] || 0);

          // Check lethal damage
          if (
            card.damage >= effectiveToughness &&
            !card.keywords.includes("indestructible")
          ) {
            if (iterationCount > 5) {
              console.log(`[checkStateBasedActions] SBA: Destroying ${card.name} (${card.instanceId}) due to lethal damage`);
            }
            events.push(
              ...this.destroyPermanent(state, card.instanceId, "lethal damage"),
            );
            sbaPerformed = true;
          }

          // Check 0 or less toughness
          if (effectiveToughness <= 0) {
            if (iterationCount > 5) {
              console.log(`[checkStateBasedActions] SBA: Destroying ${card.name} (${card.instanceId}) due to 0 toughness`);
            }
            events.push(
              ...this.destroyPermanent(state, card.instanceId, "0 toughness"),
            );
            sbaPerformed = true;
          }
        }

        // Check planeswalkers with 0 loyalty
        if (
          card.zone === "battlefield" &&
          card.typeLine?.includes("Planeswalker")
        ) {
          const loyalty = card.counters["loyalty"] || 0;
          if (loyalty <= 0) {
            events.push(
              ...this.destroyPermanent(state, card.instanceId, "0 loyalty"),
            );
            sbaPerformed = true;
          }
        }

        // Check Sagas that completed their final chapter
        if (card.zone === "battlefield" && this.isSaga(card)) {
          const loreCounters = card.counters["lore"] || 0;
          const finalChapter = this.getSagaFinalChapter(card);
          if (loreCounters >= finalChapter) {
            if (iterationCount > 5) {
              console.log(`[checkStateBasedActions] SBA: Destroying saga ${card.name} (${card.instanceId}) - lore: ${loreCounters}, final: ${finalChapter}, zone: ${card.zone}`);
            }
            events.push(
              ...this.destroyPermanent(
                state,
                card.instanceId,
                "saga completed",
              ),
            );
            sbaPerformed = true;
          }
        }

        // Check auras attached to invalid/missing hosts
        if (
          card.zone === "battlefield" &&
          card.attachedTo &&
          card.typeLine?.includes("Aura")
        ) {
          const host = state.cards[card.attachedTo];
          // Aura falls off if host is not on the battlefield
          if (!host || host.zone !== "battlefield") {
            if (iterationCount > 5) {
              console.log(`[checkStateBasedActions] SBA: Destroying aura ${card.name} (${card.instanceId}) - host invalid`);
            }
            events.push(
              ...this.destroyPermanent(
                state,
                card.instanceId,
                "enchanted permanent left battlefield",
              ),
            );
            sbaPerformed = true;
          }
        }
      }

      // Check legend rule
      const legendRuleEvents = this.checkLegendRule(state, iterationCount);
      events.push(...legendRuleEvents);
      if (legendRuleEvents.some((e) => e.type === "card:destroyed")) {
        if (iterationCount > 5) {
          console.log(`[checkStateBasedActions] SBA: Legend rule triggered`);
        }
        sbaPerformed = true;
      }

      // Tokens in zones other than the battlefield cease to exist (CR 704.5d)
      for (const card of Object.values(state.cards)) {
        if (card.isToken && card.zone !== "battlefield" && card.zone !== "stack") {
          // Remove token from any zone tracking arrays
          const owner = card.owner;
          if (card.zone === "graveyard") {
            state[owner].graveyardOrder = state[owner].graveyardOrder.filter(
              (id) => id !== card.instanceId,
            );
          } else if (card.zone === "exile") {
            state[owner].exileOrder = state[owner].exileOrder.filter(
              (id) => id !== card.instanceId,
            );
          } else if (card.zone === "hand") {
            state[owner].handOrder = state[owner].handOrder.filter(
              (id: string) => id !== card.instanceId,
            );
          } else if (card.zone === "library") {
            state[owner].libraryOrder = state[owner].libraryOrder.filter(
              (id) => id !== card.instanceId,
            );
          }
          delete state.cards[card.instanceId];
          sbaPerformed = true;
        }
      }

      // Check if a player tried to draw from empty library
      if (state.player.libraryOrder.length === 0) {
        // Only lose if they actually tried to draw
        // This is handled in drawCard method
      }
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Check and enforce legend rule
   */
  private checkLegendRule(state: FullPlaytestGameState, iterationCount?: number): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const legendsByController: Record<PlayerId, Map<string, string[]>> = {
      player: new Map(),
      opponent: new Map(),
    };

    // Group legends by controller and name
    for (const card of Object.values(state.cards)) {
      if (card.zone === "battlefield" && card.typeLine?.includes("Legendary")) {
        const map = legendsByController[card.controller];
        if (!map.has(card.name)) {
          map.set(card.name, []);
        }
        map.get(card.name)!.push(card.instanceId);
      }
    }

    // Destroy duplicates (keep first, destroy rest)
    for (const controller of ["player", "opponent"] as PlayerId[]) {
      for (const [name, instanceIds] of legendsByController[controller]) {
        if (instanceIds.length > 1) {
          if (iterationCount && iterationCount > 5) {
            console.log(`[checkStateBasedActions] Legend rule: destroying duplicates of ${name} for ${controller}`);
          }
          // Keep first, destroy rest
          for (let i = 1; i < instanceIds.length; i++) {
            events.push(
              ...this.destroyPermanent(state, instanceIds[i], "legend rule"),
            );
          }
        }
      }
    }

    return events;
  }

  // =====================
  // Saga Support
  // =====================

  /**
   * Check if a card is a Saga enchantment
   */
  private isSaga(card: ExtendedGameCard): boolean {
    return card.typeLine?.includes("Saga") ?? false;
  }

  /**
   * Get the final chapter number for a Saga by parsing its oracle text
   * Returns the highest chapter number found (typically I, II, III, IV, or V)
   */
  private getSagaFinalChapter(card: ExtendedGameCard): number {
    if (!card.oracleText) return 3; // Default to 3 chapters

    // Match Roman numerals for chapters: V, IV, III, II, I (check highest first)
    const romanNumerals = ["V", "IV", "III", "II", "I"];
    const values = [5, 4, 3, 2, 1];

    for (let i = 0; i < romanNumerals.length; i++) {
      // Look for "IV —" or "IV," or "IV\n" patterns
      const pattern = new RegExp(`${romanNumerals[i]}\\s*[—,\\n]`);
      if (pattern.test(card.oracleText)) {
        return values[i];
      }
    }

    return 3; // Default fallback
  }

  /**
   * Convert number to Roman numeral (for chapter display)
   */
  private romanNumeral(num: number): string {
    const numerals = ["I", "II", "III", "IV", "V", "VI"];
    return numerals[num - 1] || num.toString();
  }

  /**
   * Check if a permanent should enter the battlefield tapped based on its oracle text
   * Handles both unconditional ("enters tapped") and conditional ("enters tapped unless...")
   */
  private shouldEnterTapped(
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
      // Parse and evaluate the condition
      const conditionMet = this.evaluateUnlessCondition(oracleTextLower, state, controller);
      // If condition is met, card does NOT enter tapped
      return !conditionMet;
    }

    // No "unless" clause - enters tapped unconditionally
    return true;
  }

  /**
   * Evaluate "unless" conditions for ETB tapped effects
   * Returns true if the condition is satisfied (meaning card enters untapped)
   */
  private evaluateUnlessCondition(
    oracleTextLower: string,
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): boolean {
    // Pattern: "unless you control [a/an] [land type]"
    // Examples: "unless you control a Mountain", "unless you control a Plains or a Mountain", "unless you control a basic land"

    // Extract the condition text after "unless"
    const unlessMatch = oracleTextLower.match(/unless\s+you\s+control\s+(.+?)(?:\.|$)/);
    if (!unlessMatch) return false;

    const conditionText = unlessMatch[1];

    // Check for general "a basic land" condition (e.g., Ba Sing Se)
    if (conditionText.includes('basic land')) {
      return this.controlsBasicLand(state, controller);
    }

    // Parse land types from the condition
    // Handle patterns like "a Mountain", "a Plains or a Mountain", "two or more other lands"
    const landTypes = this.parseLandTypesFromCondition(conditionText);

    if (landTypes.length === 0) {
      // Couldn't parse the condition - default to enters tapped for safety
      return false;
    }

    // Check if controller controls any of the required land types
    return this.controlsAnyLandType(state, controller, landTypes);
  }

  /**
   * Parse land types from an "unless" condition string
   */
  private parseLandTypesFromCondition(conditionText: string): string[] {
    const landTypes: string[] = [];
    const basicLandTypes = ['plains', 'island', 'swamp', 'mountain', 'forest'];

    // Check for each basic land type in the condition
    for (const landType of basicLandTypes) {
      if (conditionText.includes(landType)) {
        landTypes.push(landType);
      }
    }

    return landTypes;
  }

  /**
   * Check if a player controls any basic land
   */
  private controlsBasicLand(
    state: FullPlaytestGameState,
    controller: PlayerId,
  ): boolean {
    for (const card of Object.values(state.cards)) {
      if (
        card.controller === controller &&
        card.zone === 'battlefield' &&
        card.typeLine?.includes('Land') &&
        card.typeLine?.includes('Basic')
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a player controls any permanent with the specified land types
   */
  private controlsAnyLandType(
    state: FullPlaytestGameState,
    controller: PlayerId,
    landTypes: string[],
  ): boolean {
    for (const card of Object.values(state.cards)) {
      if (
        card.controller === controller &&
        card.zone === 'battlefield' &&
        card.typeLine?.includes('Land')
      ) {
        // Check if this land matches any of the required types
        const typeLineLower = card.typeLine.toLowerCase();
        for (const landType of landTypes) {
          if (typeLineLower.includes(landType)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Add lore counters to all Sagas controlled by active player
   * Called at the beginning of precombat main phase
   */
  private addLoreCountersToSagas(
    state: FullPlaytestGameState,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const activePlayer = state.activePlayer;

    const battlefieldCards = Object.values(state.cards).filter(c => c.zone === "battlefield");
    const sagas = battlefieldCards.filter(c => this.isSaga(c));
    const activePlayerSagas = sagas.filter(c => c.controller === activePlayer);
    console.log(`[addLoreCountersToSagas] Active player: ${activePlayer}, battlefield: ${battlefieldCards.length}, sagas: ${sagas.length}, active player sagas: ${activePlayerSagas.length}`);

    for (const card of Object.values(state.cards)) {
      if (
        card.controller === activePlayer &&
        card.zone === "battlefield" &&
        this.isSaga(card)
      ) {
        const currentLore = card.counters["lore"] || 0;
        card.counters["lore"] = currentLore + 1;
        console.log(`[addLoreCountersToSagas] ${card.name}: lore ${currentLore} -> ${card.counters["lore"]}`);

        events.push({
          type: "card:counters",
          cardId: card.instanceId,
          counters: { ...card.counters },
        });

        this.addLogEntry(state, events, {
          type: "action",
          player: activePlayer,
          message: `${card.name} gains a lore counter (Chapter ${this.romanNumeral(card.counters["lore"])})`,
        });
      }
    }

    return events;
  }

  // =====================
  // Available Actions
  // =====================

  /**
   * Get all available actions for a player
   */
  getAvailableActions(
    state: FullPlaytestGameState,
    player: PlayerId,
  ): GameAction[] {
    const actions: GameAction[] = [];
    const playerState = state[player];

    // Can always pass priority
    actions.push({ type: "pass_priority" });

    // Can always concede
    actions.push({ type: "concede" });

    // Check if it's a main phase for the active player
    const isMainPhase = state.step === "main" && state.activePlayer === player;
    const canPlaySorcerySpeed = isMainPhase && state.stack.length === 0;

    // Play land (only during main phase, if haven't played one this turn)
    if (canPlaySorcerySpeed && playerState.landPlaysRemaining > 0) {
      for (const cardId of playerState.handOrder) {
        const card = state.cards[cardId];
        if (!card) continue;

        if (card.layout === 'modal_dfc' && card.cardFaces) {
          // MDFC: check each face for Land type
          for (let i = 0; i < card.cardFaces.length; i++) {
            if (card.cardFaces[i].typeLine?.includes("Land")) {
              actions.push({ type: "play_land", cardId, faceIndex: i });
            }
          }
        } else if (card.typeLine?.includes("Land")) {
          actions.push({ type: "play_land", cardId });
        }
      }
    }

    // Cast spells from hand
    for (const cardId of playerState.handOrder) {
      const card = state.cards[cardId];
      if (!card) continue;
      // Skip pure lands, but NOT MDFCs (their front face typeLine won't include "Land" after init fix)
      if (card.typeLine?.includes("Land")) continue;

      const isInstant =
        card.typeLine?.includes("Instant") || card.keywords.includes("flash");

      if (isInstant || canPlaySorcerySpeed) {
        // Check if can afford mana cost (now includes color validation and cost reduction)
        if (this.canAffordManaCost(state, player, card.manaCost, card)) {
          // Check if spell requires targets
          if (this.requiresTargets(card)) {
            // Only add action if valid targets exist
            const validTargets = this.getValidTargetsForSpell(
              card,
              state,
              player,
            );
            const isAura = card.typeLine?.includes("Aura");
            if (isAura) {
              console.log(`[getAvailableActions] Evaluating Aura ${card.name} for player ${player}`);
              console.log(`[getAvailableActions] Found ${validTargets.length} valid targets:`, validTargets);
            }
            if (validTargets.length > 0) {
              if (isAura) {
                console.log(`[getAvailableActions] Adding cast_spell action for ${card.name} with target:`, validTargets[0]);
              }
              // Create one action per valid target so AI can choose
              for (const target of validTargets) {
                actions.push({ type: "cast_spell", cardId, targets: [target] });
              }
            } else if (isAura) {
              console.log(`[getAvailableActions] Cannot cast ${card.name} - no valid targets`);
            }
          } else {
            // No targets required, can cast freely
            actions.push({ type: "cast_spell", cardId });
          }
        }
      }
    }

    // Cast commanders from command zone
    for (const cardId of playerState.commandZone) {
      const card = state.cards[cardId];
      if (!card) continue;

      // Commanders can only be cast at sorcery speed (unless they have flash)
      const hasFlash = card.keywords.includes("flash");
      if (hasFlash || canPlaySorcerySpeed) {
        // Calculate total mana cost including commander tax
        const totalManaCost = this.calculateCommanderManaCost(card);

        // Check if can afford commander with tax and cost reduction
        if (this.canAffordManaCost(state, player, totalManaCost, card)) {
          // Check if spell requires targets
          if (this.requiresTargets(card)) {
            const validTargets = this.getValidTargetsForSpell(
              card,
              state,
              player,
            );
            if (validTargets.length > 0) {
              for (const target of validTargets) {
                actions.push({ type: "cast_spell", cardId, targets: [target] });
              }
            }
          } else {
            actions.push({ type: "cast_spell", cardId });
          }
        }
      }
    }

    // Activate abilities of permanents
    for (const card of Object.values(state.cards)) {
      if (card.controller === player && card.zone === "battlefield") {
        // Tap for mana (lands and mana creatures)
        if (this.canTapForMana(card) && !card.isTapped) {
          // Creatures with summoning sickness can't tap for mana (unless they have haste)
          const hasSummoningSickness =
            card.typeLine?.includes("Creature") &&
            card.summoningSickness &&
            !card.keywords.includes("haste");
          // Check activation conditions (e.g. Temple of the False God)
          const meetsCondition = this.meetsActivationCondition(card, state, player);
          if (!hasSummoningSickness && meetsCondition) {
            actions.push({ type: "tap_for_mana", cardId: card.instanceId });
          }
        }

        // Fetch land abilities (e.g., Terramorphic Expanse, Evolving Wilds, Myriad Landscape)
        if (this.isFetchLand(card) && !card.isTapped) {
          // Check if the fetch ability has a mana cost (e.g., Myriad Landscape: {2}, {T}, Sacrifice)
          const fetchManaCost = this.getFetchLandManaCost(card);
          if (!fetchManaCost || this.canAffordManaCost(state, player, fetchManaCost)) {
            actions.push({
              type: "activate_ability",
              cardId: card.instanceId,
              abilityIndex: 0,
            });
          }
        }

        // General activated abilities parsed from oracle text
        const abilities = this.parseActivatedAbilities(card);
        for (let i = 0; i < abilities.length; i++) {
          if (this.canActivateAbility(state, player, card, abilities[i])) {
            actions.push({
              type: "activate_ability",
              cardId: card.instanceId,
              abilityIndex: i,
            });
          }
        }
      }
    }

    // Combat actions
    if (state.step === "declare_attackers" && state.activePlayer === player) {
      const possibleAttackers = this.getPossibleAttackers(state, player);
      if (possibleAttackers.length > 0) {
        // Generate combinations of attackers (simplified - just allow declaring all or none for now)
        const attackerInfos: AttackerInfo[] = possibleAttackers.map(
          (cardId) => ({
            cardId,
            attackingPlayerId: player,
            defendingTarget: player === "player" ? "opponent" : "player",
          }),
        );
        actions.push({ type: "declare_attackers", attackers: attackerInfos });
        actions.push({ type: "declare_attackers", attackers: [] }); // No attack
      }
    }

    if (state.step === "declare_blockers" && state.activePlayer !== player) {
      const possibleBlockers = this.getPossibleBlockers(state, player);
      if (possibleBlockers.length > 0 && state.combat.attackers.length > 0) {
        // This will be expanded in Phase 8 for proper blocking
        actions.push({ type: "declare_blockers", blockers: [] });
      }
    }

    return actions;
  }

  /**
   * Calculate the total mana cost for a commander including commander tax
   * Commander tax adds {2} for each time it has been cast from the command zone
   */
  private calculateCommanderManaCost(card: ExtendedGameCard): string {
    const baseCost = card.manaCost || "{0}";
    const tax = card.commanderTax || 0;

    if (tax === 0) return baseCost;

    // Parse the base cost to extract generic mana
    const genericMatch = baseCost.match(/\{(\d+)\}/);
    const genericMana = genericMatch ? parseInt(genericMatch[1]) : 0;

    // Add commander tax (2 colorless mana per tax)
    const newGenericMana = genericMana + (tax * 2);

    // Replace or add the generic mana cost
    if (genericMatch) {
      return baseCost.replace(/\{\d+\}/, `{${newGenericMana}}`);
    } else {
      // No generic mana in cost, prepend it
      return `{${newGenericMana}}${baseCost}`;
    }
  }

  /**
   * Check if a player can afford a mana cost
   */
  private canAffordManaCost(
    state: FullPlaytestGameState,
    player: PlayerId,
    manaCost: string | null,
    card?: ExtendedGameCard,
  ): boolean {
    if (!manaCost) return true;

    const playerState = state[player];

    // Parse generic and colored mana portions separately
    let genericMana = this.parseGenericMana(manaCost);
    const coloredPips = this.parseColoredManaPips(manaCost);

    // Apply cost reduction from static abilities if card is provided
    // Cost reduction only reduces generic mana, not colored pips
    if (card) {
      const reduction = this.calculateCostReduction(state, player, card);
      genericMana = Math.max(0, genericMana - reduction);
    }

    // Calculate effective CMC (reduced generic + colored pips)
    const cmc = genericMana + coloredPips;

    const colorRequirements: Record<string, number> = {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
    };

    // Extract colored mana requirements
    const colorMatches = manaCost.match(/\{([WUBRG])\}/gi) || [];
    for (const match of colorMatches) {
      const color = match.replace(/[{}]/g, "").toUpperCase();
      if (colorRequirements[color] !== undefined) {
        colorRequirements[color]++;
      }
    }

    // Count mana already in the pool
    let totalMana = Object.values(playerState.manaPool).reduce(
      (sum, val) => sum + val,
      0,
    );

    // Count available mana by color (pool + untapped sources)
    const availableManaByColor: Record<string, number> = {
      W: playerState.manaPool.W || 0,
      U: playerState.manaPool.U || 0,
      B: playerState.manaPool.B || 0,
      R: playerState.manaPool.R || 0,
      G: playerState.manaPool.G || 0,
      C: playerState.manaPool.C || 0,
    };

    // Add mana available from untapped sources
    for (const card of Object.values(state.cards)) {
      if (
        card.controller === player &&
        card.zone === "battlefield" &&
        !card.isTapped
      ) {
        if (this.canTapForMana(card)) {
          // Creatures with summoning sickness can't tap for mana (unless they have haste)
          const hasSummoningSickness =
            card.typeLine?.includes("Creature") &&
            card.summoningSickness &&
            !card.keywords.includes("haste");
          if (!hasSummoningSickness) {
            totalMana++;
            const manaColor = this.getManaColorFromCard(card);
            availableManaByColor[manaColor]++;
          }
        }
      }
    }

    // Check if we have enough total mana
    if (totalMana < cmc) {
      return false;
    }

    // Check if we can meet color requirements
    for (const [color, required] of Object.entries(colorRequirements)) {
      if (required > 0) {
        const available = availableManaByColor[color] || 0;
        if (available < required) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Parse CMC from mana cost string
   */
  private parseManaCostCMC(manaCost: string): number {
    let cmc = 0;
    // Match numbers (generic mana)
    const genericMatch = manaCost.match(/\{(\d+)\}/);
    if (genericMatch) {
      cmc += parseInt(genericMatch[1], 10);
    }
    // Count colored mana symbols
    const coloredMatches = manaCost.match(/\{[WUBRG]\}/g);
    if (coloredMatches) {
      cmc += coloredMatches.length;
    }
    return cmc;
  }

  /**
   * Parse only the generic mana portion from a mana cost string
   * Returns the amount of generic mana (the number in {X} format)
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

      // Creature spell cost reduction (e.g., Goblin Warchief, Ravenous Baloth synergies)
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
   * Check if a card has a mana ability
   */
  private canTapForMana(card: ExtendedGameCard): boolean {
    // Basic lands
    if (card.typeLine?.includes("Basic Land")) return true;

    // Non-basic lands that tap for mana
    if (card.typeLine?.includes("Land") && card.oracleText?.includes("Add"))
      return true;

    // Mana dorks — use negative lookbehind to exclude granted abilities
    // (e.g. Song of Freyalise: 'creatures you control gain "{T}: Add...')
    if (/(?<!")\{T\}: Add/.test(card.oracleText || "")) return true;

    return false;
  }

  /**
   * Check if a card is a fetch land (sacrifices to search for a basic land)
   * Matches cards like Terramorphic Expanse, Evolving Wilds, etc.
   */
  private isFetchLand(card: ExtendedGameCard): boolean {
    if (!card.oracleText) return false;
    const text = card.oracleText.toLowerCase();
    return (
      text.includes("sacrifice") &&
      text.includes("search your library") &&
      text.includes("basic land")
    );
  }

  /**
   * Extract the mana cost from a fetch land's activated ability, if any.
   * Returns null for zero-cost fetches (e.g., Evolving Wilds: "{T}, Sacrifice").
   * Returns the mana cost string for paid fetches (e.g., Myriad Landscape: "{2}").
   */
  private getFetchLandManaCost(card: ExtendedGameCard): string | null {
    if (!card.oracleText) return null;

    const cleanedText = card.oracleText.replace(/\([^)]*\)/g, "").trim();
    const lines = cleanedText.split("\n");

    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      if (
        lower.includes("sacrifice") &&
        lower.includes("search your library") &&
        lower.includes("basic land")
      ) {
        const colonIdx = this.findAbilityColon(line.trim());
        if (colonIdx === -1) continue;

        const costPart = line.trim().substring(0, colonIdx);
        // Extract mana symbols, excluding {T} (tap cost)
        const manaSymbols = costPart.match(/\{[WUBRGC\d]+\}/gi) || [];
        const manaCostSymbols = manaSymbols.filter(
          (s) => s.toUpperCase() !== "{T}",
        );

        if (manaCostSymbols.length > 0) {
          return manaCostSymbols.join("");
        }
        return null;
      }
    }

    return null;
  }

  /**
   * Parse activated abilities from a card's oracle text.
   * Returns an array of abilities with parsed costs and effect text.
   * Excludes mana abilities, fetch land abilities, triggered abilities, and loyalty abilities.
   */
  parseActivatedAbilities(card: ExtendedGameCard): ParsedActivatedAbility[] {
    if (!card.oracleText) return [];

    // Strip reminder text (parenthesized text)
    const cleanedText = card.oracleText.replace(/\([^)]*\)/g, "").trim();
    const lines = cleanedText.split("\n");
    const abilities: ParsedActivatedAbility[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip triggered abilities
      if (/^(?:when|whenever|at the)\b/i.test(trimmed)) continue;

      // Skip static/ETB text (no colon-separated cost:effect pattern)
      if (/^this\b/i.test(trimmed)) continue;

      // Skip loyalty abilities (+N:, -N:, 0:)
      if (/^[+\-]?\d+\s*:/.test(trimmed)) continue;

      // Match activated ability pattern: COST: EFFECT
      // The cost portion must contain at least one recognizable cost element
      // Use a colon that is NOT inside curly braces as the separator
      const colonIndex = this.findAbilityColon(trimmed);
      if (colonIndex === -1) continue;

      const costText = trimmed.substring(0, colonIndex).trim();
      const effectText = trimmed.substring(colonIndex + 1).trim();

      if (!costText || !effectText) continue;

      // Cost must contain at least one recognizable cost element
      const hasCostElement =
        /\{[TQWUBRGC\d]+\}/i.test(costText) ||
        /\b(?:sacrifice|remove|pay|discard|exile|tap)\b/i.test(costText);
      if (!hasCostElement) continue;

      // Exclude mana abilities: cost is only {T} (possibly with conditions) and effect starts with "Add"
      if (/^add\b/i.test(effectText) && /^\{T\}$/.test(costText.replace(/,\s*/g, "").trim())) continue;

      // Exclude fetch lands (already handled separately)
      const fullLower = trimmed.toLowerCase();
      if (
        fullLower.includes("sacrifice") &&
        fullLower.includes("search your library") &&
        fullLower.includes("basic land")
      ) continue;

      // Parse costs
      const costs = this.parseAbilityCosts(costText, card.name);
      abilities.push({ costText, effectText, costs });
    }

    return abilities;
  }

  /**
   * Find the colon that separates costs from effects in an activated ability.
   * Skips colons inside curly braces like {T}.
   */
  private findAbilityColon(text: string): number {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      else if (text[i] === ":" && depth === 0) return i;
    }
    return -1;
  }

  /**
   * Parse individual cost components from the cost portion of an activated ability.
   */
  private parseAbilityCosts(
    costText: string,
    cardName: string,
  ): ParsedActivatedAbility["costs"] {
    const costs: ParsedActivatedAbility["costs"] = {
      manaCost: null,
      tapSelf: false,
      removedCounters: null,
      sacrificeSelf: false,
      payLife: null,
    };

    // Split on commas, but be careful not to split inside curly braces
    const parts = this.splitCostParts(costText);

    for (const part of parts) {
      const trimmed = part.trim();

      // Tap: {T}
      if (trimmed === "{T}") {
        costs.tapSelf = true;
        continue;
      }

      // Mana cost: one or more {X} symbols (not {T} or {Q})
      if (/^(\{[\dWUBRGCX]+\}\s*)+$/i.test(trimmed) && !/\{[TQ]\}/i.test(trimmed)) {
        costs.manaCost = (costs.manaCost || "") + trimmed.replace(/\s+/g, "");
        continue;
      }

      // Remove counter: "Remove a/N TYPE counter from CARDNAME/this"
      const removeCounterMatch = trimmed.match(
        /[Rr]emove\s+(?:a|an|(\d+)|(\w+))\s+([\w/+-]+)\s+counter/i,
      );
      if (removeCounterMatch) {
        const wordToNum: Record<string, number> = {
          a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
        };
        const rawCount = removeCounterMatch[1] || removeCounterMatch[2];
        const count = rawCount
          ? (parseInt(rawCount, 10) || wordToNum[rawCount.toLowerCase()] || 1)
          : 1;
        costs.removedCounters = {
          type: removeCounterMatch[3].toLowerCase(),
          count,
        };
        continue;
      }

      // Sacrifice self: "Sacrifice CARDNAME" or "Sacrifice ~" or "Sacrifice this"
      const cardNameEscaped = cardName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (
        new RegExp(`sacrifice\\s+(?:this|~|${cardNameEscaped})`, "i").test(trimmed)
      ) {
        costs.sacrificeSelf = true;
        continue;
      }

      // Pay life: "Pay N life"
      const payLifeMatch = trimmed.match(/[Pp]ay\s+(\d+)\s+life/);
      if (payLifeMatch) {
        costs.payLife = parseInt(payLifeMatch[1], 10);
        continue;
      }
    }

    return costs;
  }

  /**
   * Split cost text on commas, respecting curly braces.
   */
  private splitCostParts(costText: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;

    for (const ch of costText) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;

      if (ch === "," && depth === 0) {
        parts.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    if (current) parts.push(current);
    return parts;
  }

  /**
   * Check if an activated ability's costs can be paid.
   */
  private canActivateAbility(
    state: FullPlaytestGameState,
    player: PlayerId,
    card: ExtendedGameCard,
    ability: ParsedActivatedAbility,
  ): boolean {
    if (card.zone !== "battlefield" || card.controller !== player) return false;

    // Check tap cost
    if (ability.costs.tapSelf) {
      if (card.isTapped) return false;
      // Creatures with summoning sickness can't use {T} abilities (unless haste)
      const hasSummoningSickness =
        card.typeLine?.includes("Creature") &&
        card.summoningSickness &&
        !card.keywords.includes("haste");
      if (hasSummoningSickness) return false;
    }

    // Check mana cost
    if (ability.costs.manaCost) {
      let effectiveCost = ability.costs.manaCost;
      // For abilities with {X} in cost, require enough mana for at least X=1.
      // Activating abilities for X=0 is almost never meaningful (e.g. Treasure Vault
      // sacrificing itself to create 0 treasures) and just generates noise / LLM calls.
      const xCount = (effectiveCost.match(/\{X\}/gi) || []).length;
      if (xCount > 0) {
        effectiveCost = effectiveCost.replace(/\{X\}/gi, "") + `{${xCount}}`;
      }
      if (!this.canAffordManaCost(state, player, effectiveCost)) return false;
    }

    // Check counter removal
    if (ability.costs.removedCounters) {
      const { type, count } = ability.costs.removedCounters;
      if ((card.counters[type] || 0) < count) return false;
    }

    // Check life payment (strict > per MTG rules)
    if (ability.costs.payLife !== null) {
      if (state[player].life <= ability.costs.payLife) return false;
    }

    // Check activation conditions (e.g., "Activate only if...")
    if (!this.meetsActivationCondition(card, state, player)) return false;

    return true;
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

    // Check for "activate only if" or "activate this ability only if" conditions
    const activateOnlyMatch = oracleText.match(
      /activate(?:\s+this\s+ability)?\s+only\s+if\s+you\s+control\s+(\w+)\s+or\s+more\s+(\w+)/,
    );
    if (activateOnlyMatch) {
      const requiredCount = this.parseWordNumber(activateOnlyMatch[1]);
      const permanentType = activateOnlyMatch[2]; // e.g. "lands", "creatures"

      // Count matching permanents the player controls
      let count = 0;
      for (const cardId of state.battlefieldOrder[controller]) {
        const permanent = state.cards[cardId];
        if (!permanent) continue;
        const typeLine = permanent.typeLine?.toLowerCase() || "";
        // Match singular form (e.g. "lands" -> "land")
        const singularType = permanentType.replace(/s$/, "");
        if (typeLine.includes(singularType)) {
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
   * Parse a word-form number (e.g. "five") to its numeric value
   */
  private parseWordNumber(word: string): number {
    const wordMap: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };
    return wordMap[word.toLowerCase()] || parseInt(word, 10) || 0;
  }

  /**
   * Get creatures that can attack
   */
  private getPossibleAttackers(
    state: FullPlaytestGameState,
    player: PlayerId,
  ): string[] {
    const attackers: string[] = [];

    for (const card of Object.values(state.cards)) {
      if (
        card.controller === player &&
        card.zone === "battlefield" &&
        card.typeLine?.includes("Creature") &&
        !card.isTapped &&
        !card.summoningSickness &&
        !card.keywords.includes("defender")
      ) {
        attackers.push(card.instanceId);
      }
    }

    return attackers;
  }

  /**
   * Get creatures that can block
   */
  private getPossibleBlockers(
    state: FullPlaytestGameState,
    player: PlayerId,
  ): string[] {
    const blockers: string[] = [];

    for (const card of Object.values(state.cards)) {
      if (
        card.controller === player &&
        card.zone === "battlefield" &&
        card.typeLine?.includes("Creature") &&
        !card.isTapped
      ) {
        blockers.push(card.instanceId);
      }
    }

    return blockers;
  }

  // =====================
  // Card Actions
  // =====================

  /**
   * Play a land
   */
  playLand(
    state: FullPlaytestGameState,
    player: PlayerId,
    cardId: string,
    faceIndex?: number,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const playerState = state[player];
    const card = state.cards[cardId];

    if (!card || playerState.landPlaysRemaining <= 0) {
      return events;
    }

    // Switch to the specified face for MDFCs (e.g., back face is a land)
    if (faceIndex !== undefined && card.layout === 'modal_dfc') {
      this.switchToFace(card, faceIndex);
    }

    playerState.landPlaysRemaining--;
    events.push(...this.moveCard(state, cardId, "battlefield", player));

    // Check if land should enter tapped
    if (this.shouldEnterTapped(card, state, player)) {
      card.isTapped = true;
      events.push({
        type: "card:tapped",
        cardId: card.instanceId,
        cardName: card.name,
        player,
        isTapped: true,
      });
    }

    // Check for ETB triggers and add to stack
    const etbTriggers = this.keywordService.checkETBTriggers(
      state,
      card.instanceId,
    );
    for (const trigger of etbTriggers) {
      events.push(...this.addToStack(state, trigger));
    }

    this.addLogEntry(state, events, {
      type: "play",
      player,
      message: `${player === "player" ? "Player" : "Opponent"} played ${card.name}`,
    });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Cast a spell (add to stack)
   */
  castSpell(
    state: FullPlaytestGameState,
    player: PlayerId,
    cardId: string,
    targets?: { type: "card" | "player"; id: string }[],
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];

    if (!card) return events;

    const isAura = card.typeLine?.includes("Aura");
    if (isAura) {
      console.log(`[castSpell] Casting Aura ${card.name} with targets:`, targets);
    }

    const playerState = state[player];

    // Determine if casting from command zone
    const fromCommandZone = playerState.commandZone.includes(cardId);
    const fromZone = fromCommandZone ? "command" : "hand";

    // Calculate mana cost (including commander tax if from command zone)
    const totalManaCost = fromCommandZone
      ? this.calculateCommanderManaCost(card)
      : card.manaCost;

    // Spend mana from pool for the spell's cost
    events.push(...this.spendManaForCost(state, player, totalManaCost));

    // Move to stack
    card.zone = "stack";

    // Remove from hand or command zone
    if (fromCommandZone) {
      const commandZoneIndex = playerState.commandZone.indexOf(cardId);
      if (commandZoneIndex > -1) {
        playerState.commandZone.splice(commandZoneIndex, 1);
      }
      // Increment commander tax for next time
      card.commanderTax = (card.commanderTax || 0) + 1;
    } else {
      const handIndex = playerState.handOrder.indexOf(cardId);
      if (handIndex > -1) {
        playerState.handOrder.splice(handIndex, 1);
      }
    }

    // Emit card:moved event so frontend updates display
    events.push({
      type: "card:moved",
      cardId,
      cardName: card.name,
      player,
      from: fromZone,
      to: "stack",
    });

    // Create stack item
    const stackItem: StackItem = {
      id: uuidv4(),
      type: "spell",
      sourceCardId: cardId,
      controller: player,
      targets: targets || [],
      cardName: card.name,
      manaCost: card.manaCost || undefined,
    };

    if (isAura) {
      console.log(`[castSpell] Created stack item for ${card.name}:`, {
        id: stackItem.id,
        targets: stackItem.targets,
      });
    }

    events.push(...this.addToStack(state, stackItem));

    // Check for watches that trigger on spell cast
    events.push(...this.checkSpellCastWatches(state, player, card));

    this.addLogEntry(state, events, {
      type: "play",
      player,
      message: `${player === "player" ? "Player" : "Opponent"} cast ${card.name}`,
    });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Spend mana from pool to pay a cost (auto-taps lands if pool is insufficient)
   */
  private spendManaForCost(
    state: FullPlaytestGameState,
    player: PlayerId,
    manaCost: string | null,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    if (!manaCost) return events;

    const playerState = state[player];
    const cmc = this.parseManaCostCMC(manaCost);

    // Parse colored mana requirements from cost
    const coloredRequired: Record<string, number> = {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
    };
    const colorMatches = manaCost.match(/\{([WUBRG])\}/g);
    if (colorMatches) {
      for (const match of colorMatches) {
        const color = match.charAt(1);
        coloredRequired[color]++;
      }
    }

    // Calculate how much mana we need vs what's in the pool
    let totalNeeded = cmc;
    let totalInPool = Object.values(playerState.manaPool).reduce(
      (sum, val) => sum + val,
      0,
    );

    // Auto-tap lands if we don't have enough mana in the pool
    if (totalInPool < totalNeeded) {
      // Find untapped mana sources and tap them
      const untappedSources: ExtendedGameCard[] = [];
      for (const card of Object.values(state.cards)) {
        if (
          card.controller === player &&
          card.zone === "battlefield" &&
          !card.isTapped
        ) {
          if (this.canTapForMana(card)) {
            untappedSources.push(card);
          }
        }
      }

      // Sort sources: prioritize lands that produce colors we need
      untappedSources.sort((a, b) => {
        const colorA = this.getManaColorFromCard(a);
        const colorB = this.getManaColorFromCard(b);
        const neededA = coloredRequired[colorA] || 0;
        const neededB = coloredRequired[colorB] || 0;
        // Prioritize colors we need more of
        return neededB - neededA;
      });

      // Tap sources until we have enough mana
      for (const source of untappedSources) {
        if (totalInPool >= totalNeeded) break;

        source.isTapped = true;
        events.push({
          type: "card:tapped",
          cardId: source.instanceId,
          cardName: source.name,
          player,
          isTapped: true,
        });

        const manaColor = this.getManaColorFromCard(source);
        playerState.manaPool[manaColor]++;
        totalInPool++;
      }

      // Emit mana changed after tapping
      events.push({
        type: "mana:changed",
        player,
        manaPool: { ...playerState.manaPool },
      });
    }

    // Now spend from the pool
    let remaining = cmc;

    // Spend colored mana first (to satisfy color requirements)
    for (const color of ["W", "U", "B", "R", "G"] as const) {
      const needed = coloredRequired[color];
      const available = playerState.manaPool[color];
      const toSpend = Math.min(needed, available);
      if (toSpend > 0) {
        playerState.manaPool[color] -= toSpend;
        remaining -= toSpend;
      }
    }

    // Spend remaining mana from any color (including colorless)
    if (remaining > 0) {
      for (const color of ["C", "W", "U", "B", "R", "G"] as const) {
        const available = playerState.manaPool[color];
        const toSpend = Math.min(remaining, available);
        if (toSpend > 0) {
          playerState.manaPool[color] -= toSpend;
          remaining -= toSpend;
        }
        if (remaining <= 0) break;
      }
    }

    events.push({
      type: "mana:changed",
      player,
      manaPool: { ...playerState.manaPool },
    });
    return events;
  }

  /**
   * Tap a permanent for mana
   */
  tapForMana(
    state: FullPlaytestGameState,
    player: PlayerId,
    cardId: string,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];
    const playerState = state[player];

    if (!card || card.isTapped) return events;

    card.isTapped = true;
    events.push({
      type: "card:tapped",
      cardId,
      cardName: card.name,
      player,
      isTapped: true,
    });

    // Add mana to pool (simplified - assume 1 mana of appropriate color)
    const manaColor = this.getManaColorFromCard(card);
    playerState.manaPool[manaColor]++;

    // Check for enchantments that modify mana production (e.g., Utopia Sprawl, Wild Growth)
    for (const attachmentId of card.attachments) {
      const attachment = state.cards[attachmentId];
      if (
        attachment &&
        attachment.zone === "battlefield" &&
        attachment.typeLine?.includes("Enchantment") &&
        attachment.oracleText?.toLowerCase().includes("adds an additional")
      ) {
        let manaKey: keyof ManaPool | undefined;
        let colorName: string | undefined;

        // First, check if the enchantment has a chosen color (e.g., Utopia Sprawl)
        const chosenColor = attachment.chosenColor;
        if (chosenColor) {
          const colorMap: Record<string, keyof ManaPool> = {
            White: "W",
            Blue: "U",
            Black: "B",
            Red: "R",
            Green: "G",
          };
          manaKey = colorMap[chosenColor];
          colorName = chosenColor;
        } else {
          // Otherwise, parse the oracle text for a fixed mana symbol (e.g., Wild Growth)
          const oracleText = attachment.oracleText.toLowerCase();
          if (oracleText.includes("{w}")) {
            manaKey = "W";
            colorName = "White";
          } else if (oracleText.includes("{u}")) {
            manaKey = "U";
            colorName = "Blue";
          } else if (oracleText.includes("{b}")) {
            manaKey = "B";
            colorName = "Black";
          } else if (oracleText.includes("{r}")) {
            manaKey = "R";
            colorName = "Red";
          } else if (oracleText.includes("{g}")) {
            manaKey = "G";
            colorName = "Green";
          } else if (oracleText.includes("{c}")) {
            manaKey = "C";
            colorName = "Colorless";
          }
        }

        if (manaKey) {
          playerState.manaPool[manaKey]++;
          this.addLogEntry(state, events, {
            type: "action",
            player,
            message: `${attachment.name} added an additional ${colorName} mana`,
          });
        }
      }
    }

    events.push({
      type: "mana:changed",
      player,
      manaPool: { ...playerState.manaPool },
    });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Get mana color a card produces (simplified)
   */
  private getManaColorFromCard(card: ExtendedGameCard): keyof ManaPool {
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

    return "C"; // Default to colorless
  }

  /**
   * Activate a fetch land ability: pay costs (mana + tap + sacrifice) then put ability on stack.
   * Costs are paid immediately per MTG rules; the search resolves later from the stack.
   */
  activateFetchLand(
    state: FullPlaytestGameState,
    player: PlayerId,
    cardId: string,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];

    if (!card || card.isTapped || card.zone !== "battlefield") return events;

    const cardName = card.name;

    // Pay costs: mana cost (e.g., Myriad Landscape: {2})
    const manaCost = this.getFetchLandManaCost(card);
    if (manaCost) {
      events.push(...this.spendManaForCost(state, player, manaCost));
    }

    // Pay costs: tap the land
    card.isTapped = true;
    events.push({
      type: "card:tapped",
      cardId,
      cardName,
      player,
      isTapped: true,
    });

    // Pay costs: sacrifice the land (move to graveyard)
    events.push(...this.moveCard(state, cardId, "graveyard", player));

    this.addLogEntry(state, events, {
      type: "action",
      player,
      message: `${player === "player" ? "Player" : "Opponent"} sacrifices ${cardName}`,
    });

    // Extract the actual ability effect text from the card's oracle text
    const abilityText = this.getFetchLandEffectText(card) ||
      "Search your library for a basic land card, put it onto the battlefield tapped, then shuffle your library.";

    // Put the ability on the stack
    const stackItem: StackItem = {
      id: uuidv4(),
      type: "ability",
      sourceCardId: cardId,
      controller: player,
      targets: [],
      abilityText,
      abilityType: "activated",
    };

    events.push(...this.addToStack(state, stackItem));

    return events;
  }

  /**
   * Extract the effect text (after the colon) from a fetch land's activated ability.
   */
  private getFetchLandEffectText(card: ExtendedGameCard): string | null {
    if (!card.oracleText) return null;

    const cleanedText = card.oracleText.replace(/\([^)]*\)/g, "").trim();
    const lines = cleanedText.split("\n");

    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      if (
        lower.includes("sacrifice") &&
        lower.includes("search your library") &&
        lower.includes("basic land")
      ) {
        const colonIdx = this.findAbilityColon(line.trim());
        if (colonIdx === -1) continue;
        return line.trim().substring(colonIdx + 1).trim();
      }
    }

    return null;
  }

  /**
   * Extract the basic land type (Plains, Island, Swamp, Mountain, Forest) from a basic land card.
   */
  private getBasicLandType(card: ExtendedGameCard): string | null {
    if (!card.typeLine) return null;
    const match = card.typeLine.match(/\b(Plains|Island|Swamp|Mountain|Forest)\b/);
    return match ? match[1] : null;
  }

  /**
   * Activate a general activated ability on a permanent.
   * Pays all costs (tap, mana, counter removal, life, sacrifice) and puts
   * the ability on the stack.
   */
  activateAbility(
    state: FullPlaytestGameState,
    player: PlayerId,
    cardId: string,
    abilityIndex: number,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];

    if (!card || card.zone !== "battlefield") return events;

    const abilities = this.parseActivatedAbilities(card);
    const ability = abilities[abilityIndex];
    if (!ability) return events;

    const cardName = card.name;

    // Pay costs in order:

    // 1. Tap cost
    if (ability.costs.tapSelf) {
      card.isTapped = true;
      events.push({
        type: "card:tapped",
        cardId,
        cardName,
        player,
        isTapped: true,
      });
    }

    // 2. Mana cost
    if (ability.costs.manaCost) {
      events.push(...this.spendManaForCost(state, player, ability.costs.manaCost));
    }

    // 3. Remove counters
    if (ability.costs.removedCounters) {
      const { type, count } = ability.costs.removedCounters;
      card.counters[type] = (card.counters[type] || 0) - count;
      if (card.counters[type] <= 0) delete card.counters[type];
      events.push({
        type: "card:counters",
        cardId,
        counters: { ...card.counters },
      });
    }

    // 4. Pay life
    if (ability.costs.payLife !== null) {
      state[player].life -= ability.costs.payLife;
      events.push({
        type: "life:changed",
        player,
        life: state[player].life,
        change: -ability.costs.payLife,
        source: cardName,
      });
    }

    // 5. Sacrifice self (last, since it moves the card off battlefield)
    if (ability.costs.sacrificeSelf) {
      events.push(...this.moveCard(state, cardId, "graveyard", player));
    }

    // Log the activation
    this.addLogEntry(state, events, {
      type: "action",
      player,
      message: `${player === "player" ? "Player" : "Opponent"} activates ${cardName}: ${ability.effectText}`,
    });

    // Put ability on the stack
    const stackItem: StackItem = {
      id: uuidv4(),
      type: "ability",
      sourceCardId: cardId,
      controller: player,
      targets: [],
      abilityText: ability.effectText,
      abilityType: "activated",
    };

    events.push(...this.addToStack(state, stackItem));

    return events;
  }

  /**
   * Declare attackers
   */
  declareAttackers(
    state: FullPlaytestGameState,
    attackers: AttackerInfo[],
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    state.combat.attackers = attackers;

    // Tap all attacking creatures (unless vigilance)
    for (const attacker of attackers) {
      const card = state.cards[attacker.cardId];
      if (card && !card.keywords.includes("vigilance")) {
        card.isTapped = true;
        events.push({
          type: "card:tapped",
          cardId: attacker.cardId,
          cardName: card.name,
          player: state.activePlayer,
          isTapped: true,
        });
      }
    }

    events.push({ type: "combat:attackers", attackers });

    if (attackers.length > 0) {
      this.addLogEntry(state, events, {
        type: "combat",
        player: state.activePlayer,
        message: `${state.activePlayer === "player" ? "Player" : "Opponent"} attacks with ${attackers.length} creature(s)`,
      });
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Declare blockers
   */
  declareBlockers(
    state: FullPlaytestGameState,
    blockers: BlockerInfo[],
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    state.combat.blockers = blockers;
    events.push({ type: "combat:blockers", blockers });

    if (blockers.length > 0) {
      const defender: PlayerId =
        state.activePlayer === "player" ? "opponent" : "player";
      this.addLogEntry(state, events, {
        type: "combat",
        player: defender,
        message: `${defender === "player" ? "Player" : "Opponent"} blocks with ${blockers.length} creature(s)`,
      });
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  // =====================
  // Helper Methods
  // =====================

  /**
   * Move a card to a new zone
   */
  moveCard(
    state: FullPlaytestGameState,
    cardId: string,
    toZone: ExtendedGameCard["zone"],
    controller: PlayerId,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];

    if (!card) return events;

    const fromZone = card.zone;
    card.zone = toZone;
    card.controller = controller;

    // Clean up watches and copy state if card is leaving the battlefield
    if (fromZone === "battlefield" && toZone !== "battlefield") {
      // Return any cards exiled "until this card leaves the battlefield"
      events.push(...this.processLinkedExiles(state, cardId));

      this.cleanupWatchesForCard(state, cardId);

      // Reset copy characteristics — card reverts to its printed identity
      if (card.copyOf) {
        card.name = card.originalName!;
        card.imageUrl = card.originalImageUrl ?? null;
        card.copyOf = undefined;
        card.originalImageUrl = undefined;
        card.originalName = undefined;
      }

      // Revert MDFCs to front face when leaving battlefield
      this.revertToFrontFace(card);
    }

    // Update zone ordering arrays
    this.removeFromZoneOrder(state, cardId, fromZone, card.owner);
    this.addToZoneOrder(state, cardId, toZone, controller);

    events.push({
      type: "card:moved",
      cardId,
      cardName: card.name,
      player: controller,
      from: fromZone,
      to: toZone,
    });

    return events;
  }

  /**
   * Remove card from zone ordering
   */
  private removeFromZoneOrder(
    state: FullPlaytestGameState,
    cardId: string,
    zone: ExtendedGameCard["zone"],
    owner: PlayerId,
  ): void {
    const playerState = state[owner];

    switch (zone) {
      case "hand":
        const handIdx = playerState.handOrder.indexOf(cardId);
        if (handIdx > -1) playerState.handOrder.splice(handIdx, 1);
        break;
      case "library":
        const libIdx = playerState.libraryOrder.indexOf(cardId);
        if (libIdx > -1) playerState.libraryOrder.splice(libIdx, 1);
        break;
      case "graveyard":
        const gravIdx = playerState.graveyardOrder.indexOf(cardId);
        if (gravIdx > -1) playerState.graveyardOrder.splice(gravIdx, 1);
        break;
      case "exile":
        const exileIdx = playerState.exileOrder.indexOf(cardId);
        if (exileIdx > -1) playerState.exileOrder.splice(exileIdx, 1);
        break;
      case "command":
        const cmdIdx = playerState.commandZone.indexOf(cardId);
        if (cmdIdx > -1) playerState.commandZone.splice(cmdIdx, 1);
        break;
      case "battlefield":
        const bfIdx = state.battlefieldOrder[owner].indexOf(cardId);
        if (bfIdx > -1) state.battlefieldOrder[owner].splice(bfIdx, 1);
        break;
    }
  }

  /**
   * Add card to zone ordering
   */
  private addToZoneOrder(
    state: FullPlaytestGameState,
    cardId: string,
    zone: ExtendedGameCard["zone"],
    controller: PlayerId,
  ): void {
    const playerState = state[controller];

    switch (zone) {
      case "hand":
        playerState.handOrder.push(cardId);
        break;
      case "library":
        playerState.libraryOrder.push(cardId);
        break;
      case "graveyard":
        playerState.graveyardOrder.push(cardId);
        break;
      case "exile":
        playerState.exileOrder.push(cardId);
        break;
      case "command":
        playerState.commandZone.push(cardId);
        break;
      case "battlefield":
        state.battlefieldOrder[controller].push(cardId);
        break;
    }
  }

  /**
   * Draw a card
   */
  drawCard(state: FullPlaytestGameState, player: PlayerId): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const playerState = state[player];

    if (playerState.libraryOrder.length === 0) {
      // Player loses for trying to draw from empty library
      state.isGameOver = true;
      state.winner = player === "player" ? "opponent" : "player";
      state.gameOverReason = `${player === "player" ? "Player" : "Opponent"} attempted to draw from empty library`;
      events.push({
        type: "game:over",
        winner: state.winner,
        reason: state.gameOverReason,
      });
      return events;
    }

    const cardId = playerState.libraryOrder.shift()!;
    const card = state.cards[cardId];

    if (card) {
      card.zone = "hand";
      playerState.handOrder.push(cardId);
      events.push({
        type: "card:moved",
        cardId,
        cardName: card.name,
        player,
        from: "library",
        to: "hand",
      });

      this.addLogEntry(state, events, {
        type: "draw",
        player,
        message: `${player === "player" ? "Player" : "Opponent"} drew a card`,
      });
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Destroy a permanent
   */
  destroyPermanent(
    state: FullPlaytestGameState,
    cardId: string,
    reason: string,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];

    if (!card || card.zone !== "battlefield") return events;

    // Check indestructible
    if (
      card.keywords.includes("indestructible") &&
      !reason.includes("0 toughness")
    ) {
      return events;
    }

    // Detach any cards attached to this permanent (they'll be handled by SBAs)
    for (const attachmentId of card.attachments) {
      events.push(...this.detachCard(state, attachmentId));
    }

    // If this card was attached to something, remove from host's attachments
    if (card.attachedTo) {
      const host = state.cards[card.attachedTo];
      if (host) {
        host.attachments = host.attachments.filter((id) => id !== cardId);
      }
    }

    events.push({ type: "card:destroyed", cardId, reason });

    // Commanders can be moved to command zone instead of graveyard
    const destinationZone = card.isCommander ? "command" : "graveyard";
    events.push(...this.moveCard(state, cardId, destinationZone, card.owner));

    // Reset card state
    card.isTapped = false;
    card.damage = 0;
    card.counters = {};
    card.attachedTo = null;
    card.attachments = [];
    card.summoningSickness = false;

    this.addLogEntry(state, events, {
      type: "action",
      player: card.controller,
      message: `${card.name} was destroyed (${reason})`,
    });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Deal damage to a player
   */
  dealDamageToPlayer(
    state: FullPlaytestGameState,
    player: PlayerId,
    amount: number,
    source?: string,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const playerState = state[player];

    const oldLife = playerState.life;
    playerState.life -= amount;

    events.push({
      type: "life:changed",
      player,
      life: playerState.life,
      change: -amount,
      source,
    });

    this.addLogEntry(state, events, {
      type: "damage",
      player,
      message: `${player === "player" ? "Player" : "Opponent"} took ${amount} damage${source ? ` from ${source}` : ""}`,
    });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Deal damage to a creature
   */
  dealDamageToCreature(
    state: FullPlaytestGameState,
    cardId: string,
    amount: number,
    source?: string,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];

    if (!card || card.zone !== "battlefield") return events;

    card.damage += amount;
    events.push({ type: "card:damage", cardId, damage: card.damage, source });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Parse power or toughness value
   */
  private parsePowerToughness(value: string | null): number {
    if (!value) return 0;
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Add a log entry
   */
  addLogEntry(
    state: FullPlaytestGameState,
    events: PlaytestEvent[],
    entry: Omit<GameLogEntry, "id" | "timestamp">,
  ): void {
    const logEntry: GameLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    state.log.push(logEntry);
    events.push({ type: "game:log", entry: logEntry });
  }

  // =====================
  // Combat Damage (Phase 8 preview)
  // =====================

  /**
   * Calculate combat damage
   */
  calculateCombatDamage(
    state: FullPlaytestGameState,
    isFirstStrike: boolean,
  ): CombatDamageInfo[] {
    const damages: CombatDamageInfo[] = [];

    for (const attacker of state.combat.attackers) {
      const attackerCard = state.cards[attacker.cardId];
      if (!attackerCard || attackerCard.zone !== "battlefield") continue;

      const hasFirstStrike =
        attackerCard.keywords.includes("first strike") ||
        attackerCard.keywords.includes("double strike");
      const hasOnlyRegularStrike =
        !hasFirstStrike || attackerCard.keywords.includes("double strike");

      // Skip if wrong damage step
      if (isFirstStrike && !hasFirstStrike) continue;
      if (!isFirstStrike && !hasOnlyRegularStrike) continue;

      const power = this.parsePowerToughness(attackerCard.power);
      if (power <= 0) continue;

      // Find blockers for this attacker
      const blockers = state.combat.blockers.filter(
        (b) => b.blockingAttackerId === attacker.cardId,
      );

      if (blockers.length === 0) {
        // Unblocked - damage goes to defending player/planeswalker
        const targetType =
          typeof attacker.defendingTarget === "string" &&
          attacker.defendingTarget !== "player" &&
          attacker.defendingTarget !== "opponent"
            ? "card"
            : "player";
        damages.push({
          sourceId: attacker.cardId,
          targetId: attacker.defendingTarget,
          targetType,
          amount: power,
          isFirstStrike,
        });
      } else {
        // Blocked - damage goes to blockers
        // TODO: Implement damage assignment order and trample
        let remainingDamage = power;
        for (const blocker of blockers) {
          const blockerCard = state.cards[blocker.cardId];
          if (!blockerCard || blockerCard.zone !== "battlefield") continue;

          const toughness = this.parsePowerToughness(blockerCard.toughness);
          const damageToAssign = Math.min(
            remainingDamage,
            toughness - blockerCard.damage,
          );

          if (damageToAssign > 0) {
            damages.push({
              sourceId: attacker.cardId,
              targetId: blocker.cardId,
              targetType: "card",
              amount: damageToAssign,
              isFirstStrike,
            });
            remainingDamage -= damageToAssign;
          }
        }

        // Trample damage to player
        if (remainingDamage > 0 && attackerCard.keywords.includes("trample")) {
          damages.push({
            sourceId: attacker.cardId,
            targetId: attacker.defendingTarget,
            targetType: "player",
            amount: remainingDamage,
            isFirstStrike,
          });
        }
      }
    }

    // Blockers deal damage to attackers
    for (const blocker of state.combat.blockers) {
      const blockerCard = state.cards[blocker.cardId];
      if (!blockerCard || blockerCard.zone !== "battlefield") continue;

      const hasFirstStrike =
        blockerCard.keywords.includes("first strike") ||
        blockerCard.keywords.includes("double strike");
      const hasOnlyRegularStrike =
        !hasFirstStrike || blockerCard.keywords.includes("double strike");

      if (isFirstStrike && !hasFirstStrike) continue;
      if (!isFirstStrike && !hasOnlyRegularStrike) continue;

      const power = this.parsePowerToughness(blockerCard.power);
      if (power <= 0) continue;

      damages.push({
        sourceId: blocker.cardId,
        targetId: blocker.blockingAttackerId,
        targetType: "card",
        amount: power,
        isFirstStrike,
      });
    }

    return damages;
  }

  /**
   * Process combat damage
   */
  processCombatDamage(
    state: FullPlaytestGameState,
    damages: CombatDamageInfo[],
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    for (const damage of damages) {
      const sourceCard = state.cards[damage.sourceId];
      const sourceName = sourceCard?.name || "Unknown";

      if (damage.targetType === "player") {
        const playerId = damage.targetId as PlayerId;

        // Check for lifelink
        if (sourceCard?.keywords.includes("lifelink")) {
          const controller = sourceCard.controller;
          state[controller].life += damage.amount;
          events.push({
            type: "life:changed",
            player: controller,
            life: state[controller].life,
            change: damage.amount,
            source: `${sourceName} (lifelink)`,
          });
        }

        events.push(
          ...this.dealDamageToPlayer(
            state,
            playerId,
            damage.amount,
            sourceName,
          ),
        );
      } else {
        const targetCard = state.cards[damage.targetId];
        if (!targetCard) continue;

        // Check for lifelink
        if (sourceCard?.keywords.includes("lifelink")) {
          const controller = sourceCard.controller;
          state[controller].life += damage.amount;
          events.push({
            type: "life:changed",
            player: controller,
            life: state[controller].life,
            change: damage.amount,
            source: `${sourceName} (lifelink)`,
          });
        }

        // Check for deathtouch
        if (sourceCard?.keywords.includes("deathtouch") && damage.amount > 0) {
          // Mark for destruction (handled by SBAs)
          targetCard.damage = 9999; // Lethal
        } else {
          events.push(
            ...this.dealDamageToCreature(
              state,
              damage.targetId,
              damage.amount,
              sourceName,
            ),
          );
        }
      }

      // Check for watches that trigger on combat damage
      events.push(
        ...this.checkCombatDamageWatches(
          state,
          damage.sourceId,
          damage.targetId,
          damage.targetType,
          damage.amount,
        ),
      );
    }

    events.push({ type: "combat:damage", damages });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  // =====================
  // Attachment System
  // =====================

  /**
   * Parse "Enchant X" requirement from oracle text
   * Returns the target type and controller restriction
   */
  private parseEnchantRequirement(oracleText: string | null): {
    type:
      | "creature"
      | "land"
      | "artifact"
      | "enchantment"
      | "planeswalker"
      | "permanent";
    subtype?: string;
    controller?: "you" | "opponent";
  } | null {
    if (!oracleText) return null;

    const match = oracleText.match(/^Enchant\s+(.+)$/im);
    if (!match) return null;

    const target = match[1].toLowerCase();

    console.log(`[parseEnchantRequirement] Parsing oracle text: "${oracleText}"`);
    console.log(`[parseEnchantRequirement] Extracted enchant target: "${target}"`);

    // Determine type
    let type:
      | "creature"
      | "land"
      | "artifact"
      | "enchantment"
      | "planeswalker"
      | "permanent" = "permanent";
    let subtype: string | undefined;

    if (target.includes("creature")) type = "creature";
    else if (target.includes("land")) type = "land";
    else if (target.includes("artifact")) type = "artifact";
    else if (target.includes("enchantment")) type = "enchantment";
    else if (target.includes("planeswalker")) type = "planeswalker";
    // Check for land subtypes (Forest, Island, Plains, Swamp, Mountain)
    else if (
      target.includes("forest") ||
      target.includes("island") ||
      target.includes("plains") ||
      target.includes("swamp") ||
      target.includes("mountain")
    ) {
      type = "land";
      // Extract the specific subtype for filtering
      if (target.includes("forest")) subtype = "Forest";
      else if (target.includes("island")) subtype = "Island";
      else if (target.includes("plains")) subtype = "Plains";
      else if (target.includes("swamp")) subtype = "Swamp";
      else if (target.includes("mountain")) subtype = "Mountain";
    }

    // Determine controller restriction
    let controller: "you" | "opponent" | undefined;
    if (target.includes("you control")) controller = "you";
    else if (target.includes("opponent control")) controller = "opponent";

    const result = { type, subtype, controller };
    console.log(`[parseEnchantRequirement] Parsed requirement:`, result);

    return result;
  }

  /**
   * Get valid targets for an aura spell
   */
  getValidEnchantTargets(
    card: ExtendedGameCard,
    state: FullPlaytestGameState,
    caster: PlayerId,
  ): string[] {
    console.log(`[getValidEnchantTargets] Getting valid targets for ${card.name}`);
    const req = this.parseEnchantRequirement(card.oracleText);
    if (!req) {
      console.log(`[getValidEnchantTargets] No enchant requirement found for ${card.name}`);
      return [];
    }

    const validTargets = Object.values(state.cards)
      .filter((c) => {
        if (c.zone !== "battlefield") return false;

        // Check type requirement
        if (req.type !== "permanent") {
          const typeMap: Record<string, string> = {
            creature: "Creature",
            land: "Land",
            artifact: "Artifact",
            enchantment: "Enchantment",
            planeswalker: "Planeswalker",
          };
          if (!c.typeLine?.includes(typeMap[req.type])) return false;
        }

        // Check subtype requirement (e.g., Forest for "Enchant Forest")
        if (req.subtype) {
          if (!c.typeLine?.includes(req.subtype)) {
            return false;
          }
        }

        // Check controller restriction
        if (req.controller === "you" && c.controller !== caster) return false;
        if (req.controller === "opponent" && c.controller === caster)
          return false;

        // TODO: Check hexproof/protection via keywordAbilitiesService

        return true;
      })
      .map((c) => c.instanceId);

    console.log(`[getValidEnchantTargets] Found ${validTargets.length} valid targets for ${card.name}:`, validTargets);
    return validTargets;
  }

  /**
   * Attach a card (aura/equipment) to a permanent
   */
  private attachCard(
    state: FullPlaytestGameState,
    attachmentId: string,
    targetId: string,
    controller: PlayerId,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const attachment = state.cards[attachmentId];
    const target = state.cards[targetId];

    console.log(`[attachCard] Attempting to attach ${attachmentId} to ${targetId}`);
    console.log(`[attachCard] Attachment:`, attachment ? `${attachment.name} (zone: ${attachment.zone})` : "not found");
    console.log(`[attachCard] Target:`, target ? `${target.name} (zone: ${target.zone})` : "not found");

    if (!attachment || !target) {
      console.log(`[attachCard] Failed - attachment or target not found`);
      return events;
    }

    // Move attachment to battlefield if not already there
    if (attachment.zone !== "battlefield") {
      console.log(`[attachCard] Moving ${attachment.name} to battlefield`);
      events.push(
        ...this.moveCard(state, attachmentId, "battlefield", controller),
      );
    }

    // Set attachment relationship
    console.log(`[attachCard] Setting attachment relationship`);
    console.log(`[attachCard] Before - attachment.attachedTo:`, attachment.attachedTo);
    console.log(`[attachCard] Before - target.attachments:`, target.attachments);

    attachment.attachedTo = targetId;
    if (!target.attachments) {
      target.attachments = [];
    }
    target.attachments.push(attachmentId);

    console.log(`[attachCard] After - attachment.attachedTo:`, attachment.attachedTo);
    console.log(`[attachCard] After - target.attachments:`, target.attachments);

    events.push({
      type: "card:attached",
      cardId: attachmentId,
      attachedTo: targetId,
    } as PlaytestEvent);

    this.addLogEntry(state, events, {
      type: "action",
      player: controller,
      message: `${attachment.name} attached to ${target.name}`,
    });

    console.log(`[attachCard] Successfully attached ${attachment.name} to ${target.name}`);

    return events;
  }

  /**
   * Detach a card from its host
   */
  private detachCard(
    state: FullPlaytestGameState,
    attachmentId: string,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const attachment = state.cards[attachmentId];

    if (!attachment || !attachment.attachedTo) return events;

    const host = state.cards[attachment.attachedTo];
    if (host) {
      host.attachments = host.attachments.filter((id) => id !== attachmentId);
    }

    attachment.attachedTo = null;

    events.push({
      type: "card:attached",
      cardId: attachmentId,
      attachedTo: null,
    } as PlaytestEvent);

    return events;
  }

  /**
   * Choose a color for a card (e.g., Utopia Sprawl)
   * For AI, chooses from commander's color identity
   */
  private chooseColorForCard(
    state: FullPlaytestGameState,
    card: ExtendedGameCard,
    controller: PlayerId,
  ): string | null {
    // Get commander's color identity
    const playerState = state[controller];
    const commanders = playerState.commandZone
      .map((id) => state.cards[id])
      .filter((c) => c && c.isCommander);

    if (commanders.length === 0) {
      // No commander - default to green for Forests (Utopia Sprawl case)
      return "Green";
    }

    // Get all colors from commanders' color identities
    const validColors = new Set<string>();
    for (const commander of commanders) {
      for (const color of commander.colorIdentity) {
        // Map single-letter color codes to full names
        switch (color) {
          case "W":
            validColors.add("White");
            break;
          case "U":
            validColors.add("Blue");
            break;
          case "B":
            validColors.add("Black");
            break;
          case "R":
            validColors.add("Red");
            break;
          case "G":
            validColors.add("Green");
            break;
        }
      }
    }

    // Convert to array and choose first color (for AI simplicity)
    const colors = Array.from(validColors);
    if (colors.length === 0) {
      return "Green"; // Default fallback
    }

    // For AI: prioritize green for mana-producing enchantments on Forests
    if (
      card.oracleText?.toLowerCase().includes("enchant forest") &&
      colors.includes("Green")
    ) {
      return "Green";
    }

    // Otherwise, return first available color
    return colors[0];
  }

  // =====================
  // Copy Effects (Sculpting Steel, Clone, etc.)
  // =====================

  /**
   * Detect if a card has a copy-on-enter effect from oracle text
   */
  private isCopyEffect(card: ExtendedGameCard): { isCopy: boolean; copyType: string | null } {
    if (!card.oracleText) return { isCopy: false, copyType: null };
    const text = card.oracleText.toLowerCase();

    if (!text.includes('as a copy of')) return { isCopy: false, copyType: null };

    const isNonland = text.includes('nonland');

    // "enter(s) (the battlefield) as a copy of (any) (nonland) [type]"
    const typeMatch = text.match(/copy of (?:any )?(?:nonland )?(\w+)/);
    const copyType = typeMatch?.[1] || 'permanent';

    return { isCopy: true, copyType: isNonland ? 'nonland' : copyType };
  }

  /**
   * Select the best valid target for a copy effect
   * Heuristic: prefer controller's own permanents, pick highest CMC
   */
  private selectCopyTarget(
    state: FullPlaytestGameState,
    card: ExtendedGameCard,
    copyType: string,
  ): ExtendedGameCard | null {
    const candidates = Object.values(state.cards).filter((c) => {
      if (c.zone !== 'battlefield' || c.instanceId === card.instanceId) return false;
      const type = c.typeLine?.toLowerCase() || '';
      switch (copyType) {
        case 'artifact': return type.includes('artifact');
        case 'creature': return type.includes('creature');
        case 'enchantment': return type.includes('enchantment');
        case 'planeswalker': return type.includes('planeswalker');
        case 'nonland': return !type.includes('land');
        case 'permanent': return true;
        default: return type.includes(copyType);
      }
    });

    if (candidates.length === 0) return null;

    // Pick the best target by CMC regardless of controller —
    // copy effects shine when copying the strongest permanent on the board
    candidates.sort((a, b) => (b.cmc || 0) - (a.cmc || 0));
    return candidates[0];
  }

  /**
   * Apply copy effect: overwrite copiable characteristics (MTG rule 707.2)
   * Preserves identity fields (instanceId, scryfallId, owner, isCommander)
   */
  private applyCopyEffect(copyCard: ExtendedGameCard, target: ExtendedGameCard): void {
    // Save originals for UI overlay and cleanup
    copyCard.originalImageUrl = copyCard.imageUrl ?? undefined;
    copyCard.originalName = copyCard.name;
    copyCard.copyOf = target.instanceId;

    // Overwrite copiable values
    copyCard.name = target.name;
    copyCard.manaCost = target.manaCost;
    copyCard.cmc = target.cmc;
    copyCard.colors = [...target.colors];
    copyCard.colorIdentity = [...target.colorIdentity];
    copyCard.typeLine = target.typeLine;
    copyCard.oracleText = target.oracleText;
    copyCard.power = target.power;
    copyCard.toughness = target.toughness;
    copyCard.keywords = [...target.keywords];
    copyCard.imageUrl = target.imageUrl;
  }

  // =====================
  // Target Validation
  // =====================

  /**
   * Check if a spell requires targets to be cast
   */
  private requiresTargets(card: ExtendedGameCard): boolean {
    if (!card.oracleText) return false;

    const oracleTextLower = card.oracleText.toLowerCase();

    // Check for targeting keywords
    // Look for "target" followed by a noun (creature, player, permanent, etc.)
    const targetPatterns = [
      /target creature/i,
      /target player/i,
      /target opponent/i,
      /target permanent/i,
      /target artifact/i,
      /target enchantment/i,
      /target land/i,
      /target planeswalker/i,
      /target spell/i,
    ];

    for (const pattern of targetPatterns) {
      if (pattern.test(oracleTextLower)) {
        return true;
      }
    }

    // Check if it's an Aura (requires target on cast)
    if (card.typeLine?.includes("Aura")) {
      return true;
    }

    return false;
  }

  /**
   * Get valid targets for a spell
   * Returns an array of target objects { type: "card" | "player", id: string }
   */
  private getValidTargetsForSpell(
    card: ExtendedGameCard,
    state: FullPlaytestGameState,
    caster: PlayerId,
  ): { type: "card" | "player"; id: string }[] {
    if (!card.oracleText) return [];

    const targets: { type: "card" | "player"; id: string }[] = [];
    const oracleTextLower = card.oracleText.toLowerCase();

    // Handle Auras specially
    if (card.typeLine?.includes("Aura")) {
      const validCardIds = this.getValidEnchantTargets(card, state, caster);
      return validCardIds.map((id) => ({ type: "card" as const, id }));
    }

    // Parse target requirements from oracle text
    const isTargetCreature = /target creature/i.test(oracleTextLower);
    const isTargetPlayer = /target player/i.test(oracleTextLower);
    const isTargetOpponent = /target opponent/i.test(oracleTextLower);
    const isTargetPermanent = /target permanent/i.test(oracleTextLower);
    const isTargetArtifact = /target artifact/i.test(oracleTextLower);
    const isTargetEnchantment = /target enchantment/i.test(oracleTextLower);
    const isTargetLand = /target land/i.test(oracleTextLower);
    const isTargetPlaneswalker = /target planeswalker/i.test(oracleTextLower);

    // Find valid card targets
    if (
      isTargetCreature ||
      isTargetPermanent ||
      isTargetArtifact ||
      isTargetEnchantment ||
      isTargetLand ||
      isTargetPlaneswalker
    ) {
      for (const targetCard of Object.values(state.cards)) {
        if (targetCard.zone !== "battlefield") continue;

        // Check type restrictions
        if (isTargetCreature && !targetCard.typeLine?.includes("Creature"))
          continue;
        if (isTargetArtifact && !targetCard.typeLine?.includes("Artifact"))
          continue;
        if (isTargetEnchantment && !targetCard.typeLine?.includes("Enchantment"))
          continue;
        if (isTargetLand && !targetCard.typeLine?.includes("Land")) continue;
        if (
          isTargetPlaneswalker &&
          !targetCard.typeLine?.includes("Planeswalker")
        )
          continue;

        // Check controller restrictions
        // Some spells specify "target creature you control" or "target opponent's creature"
        const youControl = /target.*you control/i.test(oracleTextLower);
        const opponentControls = /target.*opponent controls/i.test(
          oracleTextLower,
        );

        if (youControl && targetCard.controller !== caster) continue;
        if (opponentControls && targetCard.controller === caster) continue;

        // TODO: Check hexproof/shroud/protection

        targets.push({ type: "card", id: targetCard.instanceId });
      }
    }

    // Find valid player targets
    if (isTargetPlayer) {
      targets.push({ type: "player", id: "player" });
      targets.push({ type: "player", id: "opponent" });
    } else if (isTargetOpponent) {
      const opponent: PlayerId = caster === "player" ? "opponent" : "player";
      targets.push({ type: "player", id: opponent });
    }

    return targets;
  }

  // =====================
  // Watch/Trigger System
  // =====================

  /**
   * Register a watch for a card's triggered ability
   */
  registerWatch(
    state: FullPlaytestGameState,
    watch: Omit<GameWatch, 'id'>
  ): string {
    const watchId = uuidv4();
    const newWatch: GameWatch = {
      ...watch,
      id: watchId,
    };

    console.log(`[registerWatch] Creating new watch:`, {
      watchId,
      sourceCardId: watch.sourceCardId,
      controller: watch.controller,
      triggerType: watch.triggerType,
      condition: watch.condition,
      effect: watch.effect,
      isActive: watch.isActive,
    });

    if (!state.watches) {
      console.log(`[registerWatch] Initializing state.watches array`);
      state.watches = [];
    }

    state.watches.push(newWatch);
    console.log(`[registerWatch] Watch registered successfully. Total watches: ${state.watches.length}`);
    return watchId;
  }

  /**
   * Register watches for a card based on its oracle text
   * This method identifies cards with triggered abilities and registers appropriate watches
   */
  registerWatchesForCard(
    state: FullPlaytestGameState,
    card: ExtendedGameCard
  ): void {
    console.log(`[registerWatchesForCard] Called for card: ${card.name} (instanceId: ${card.instanceId})`);

    if (!card.oracleText) {
      console.log(`[registerWatchesForCard] No oracle text for ${card.name}, skipping watch registration`);
      return;
    }

    const oracleText = card.oracleText.toLowerCase();
    console.log(`[registerWatchesForCard] Analyzing oracle text (lowercased): "${oracleText}"`);

    // Example: Cabbage Merchant
    // "Whenever an opponent casts a noncreature spell, create a Food token."
    const matchesCabbageMerchantName = card.name === "Cabbage Merchant";
    const matchesNoncreatureSpellTrigger = oracleText.includes("whenever an opponent casts a noncreature spell");
    console.log(`[registerWatchesForCard] Checking spell_cast trigger: name match=${matchesCabbageMerchantName}, text match=${matchesNoncreatureSpellTrigger}`);

    if (matchesCabbageMerchantName || matchesNoncreatureSpellTrigger) {
      console.log(`[registerWatchesForCard] Registering spell_cast watch for ${card.name}`);
      this.registerWatch(state, {
        sourceCardId: card.instanceId,
        controller: card.controller,
        triggerType: 'spell_cast',
        condition: {
          opponent: true,
          spellType: 'noncreature',
        },
        effect: {
          action: 'create_token',
          tokenType: 'Food',
          tokenCount: 1,
        },
        isActive: true,
      });
    }

    // Example: Cabbage Merchant (second ability)
    // "Whenever a creature deals combat damage to you, sacrifice a Food token."
    const matchesCombatDamageTrigger = oracleText.includes("whenever a creature deals combat damage to you");
    console.log(`[registerWatchesForCard] Checking combat_damage trigger: name match=${matchesCabbageMerchantName}, text match=${matchesCombatDamageTrigger}`);

    if (matchesCabbageMerchantName || matchesCombatDamageTrigger) {
      console.log(`[registerWatchesForCard] Registering combat_damage watch for ${card.name}`);
      this.registerWatch(state, {
        sourceCardId: card.instanceId,
        controller: card.controller,
        triggerType: 'combat_damage',
        condition: {
          damageSource: 'creature',
          damageTarget: 'player',
        },
        effect: {
          action: 'sacrifice',
          sacrificeType: 'Food',
        },
        isActive: true,
      });
    }

    // Pattern: "whenever [an/a] [subtype] creature you control deals combat damage to a player, draw a card"
    // Examples: Research Thief ("whenever an artifact creature you control deals combat damage to a player, draw a card")
    const combatDamageDrawMatch = oracleText.match(
      /whenever (?:an? )?(\w+ )?creature you control deals combat damage to a player, draw a card/
    );
    if (combatDamageDrawMatch) {
      const subtype = combatDamageDrawMatch[1]?.trim(); // e.g. "artifact"
      console.log(`[registerWatchesForCard] Registering combat_damage draw watch for ${card.name} (subtype filter: ${subtype || 'none'})`);
      this.registerWatch(state, {
        sourceCardId: card.instanceId,
        controller: card.controller,
        triggerType: 'combat_damage',
        condition: {
          opponent: false, // source creature must be controlled by watch controller
          damageSource: 'creature',
          damageSourceSubtype: subtype ? subtype.charAt(0).toUpperCase() + subtype.slice(1) : undefined,
          damageTarget: 'player',
        },
        effect: {
          action: 'draw_card',
          drawCount: 1,
        },
        isActive: true,
      });
    }

    // Add more card patterns here as needed

    console.log(`[registerWatchesForCard] Finished processing ${card.name}. Total watches in state: ${state.watches?.length ?? 0}`);
  }

  /**
   * Process linked exiles when a source card leaves the battlefield.
   * Returns exiled cards to their designated zones (e.g. "until ~ leaves the battlefield" effects).
   */
  private processLinkedExiles(
    state: FullPlaytestGameState,
    sourceCardId: string,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    if (!state.linkedExiles || state.linkedExiles.length === 0) return events;

    const toReturn = state.linkedExiles.filter(
      (le) => le.sourceCardId === sourceCardId,
    );
    if (toReturn.length === 0) return events;

    // Remove processed entries first to avoid re-triggering during moveCard
    state.linkedExiles = state.linkedExiles.filter(
      (le) => le.sourceCardId !== sourceCardId,
    );

    const sourceCard = state.cards[sourceCardId];
    const sourceName = sourceCard?.name || "a permanent";

    for (const linked of toReturn) {
      const exiledCard = state.cards[linked.exiledCardId];
      if (!exiledCard || exiledCard.zone !== "exile") continue;

      events.push(
        ...this.moveCard(state, linked.exiledCardId, linked.returnZone, exiledCard.owner),
      );

      this.addLogEntry(state, events, {
        type: "ability",
        player: exiledCard.owner,
        message: `${exiledCard.name} returns to the ${linked.returnZone} (${sourceName} left the battlefield)`,
      });
    }

    return events;
  }

  /**
   * Remove all watches associated with a specific card
   */
  cleanupWatchesForCard(
    state: FullPlaytestGameState,
    cardId: string
  ): void {
    if (!state.watches) {
      state.watches = [];
      return;
    }

    state.watches = state.watches.filter(
      watch => watch.sourceCardId !== cardId
    );
  }

  /**
   * Check for watches that trigger when a spell is cast
   */
  checkSpellCastWatches(
    state: FullPlaytestGameState,
    caster: PlayerId,
    card: ExtendedGameCard
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    console.log(`[checkSpellCastWatches] Called for spell: ${card.name} cast by ${caster}`);
    console.log(`[checkSpellCastWatches] Card type line: ${card.typeLine}`);
    console.log(`[checkSpellCastWatches] Total watches in state: ${state.watches?.length ?? 0}`);

    if (!state.watches) {
      console.log(`[checkSpellCastWatches] No watches array, initializing empty`);
      state.watches = [];
      return events;
    }

    const relevantWatches = state.watches.filter(
      watch => watch.isActive && watch.triggerType === 'spell_cast'
    );
    console.log(`[checkSpellCastWatches] Found ${relevantWatches.length} active spell_cast watches`);

    for (const watch of relevantWatches) {
      console.log(`[checkSpellCastWatches] Evaluating watch:`, {
        watchId: watch.id,
        sourceCardId: watch.sourceCardId,
        controller: watch.controller,
        condition: watch.condition,
      });

      // Check if this watch should trigger
      const shouldTrigger = this.doesWatchTrigger(watch, state, {
        type: 'spell_cast',
        caster,
        card,
      });
      console.log(`[checkSpellCastWatches] doesWatchTrigger returned: ${shouldTrigger}`);

      if (!shouldTrigger) {
        continue;
      }

      // Execute the watch effect
      console.log(`[checkSpellCastWatches] Executing watch effect for ${watch.id}`);
      events.push(...this.executeWatchEffect(state, watch));
    }

    console.log(`[checkSpellCastWatches] Returning ${events.length} events`);
    return events;
  }

  /**
   * Check for watches that trigger when combat damage is dealt
   */
  checkCombatDamageWatches(
    state: FullPlaytestGameState,
    sourceCardId: string,
    targetId: string,
    targetType: 'player' | 'card',
    amount: number
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    if (!state.watches) {
      state.watches = [];
      return events;
    }

    const relevantWatches = state.watches.filter(
      watch => watch.isActive && watch.triggerType === 'combat_damage'
    );

    for (const watch of relevantWatches) {
      // Check if this watch should trigger
      if (!this.doesWatchTrigger(watch, state, {
        type: 'combat_damage',
        sourceCardId,
        targetId,
        targetType,
        amount,
      })) {
        continue;
      }

      // Execute the watch effect
      events.push(...this.executeWatchEffect(state, watch));
    }

    return events;
  }

  /**
   * Determine if a watch should trigger based on the event
   */
  private doesWatchTrigger(
    watch: GameWatch,
    state: FullPlaytestGameState,
    event: {
      type: 'spell_cast' | 'combat_damage';
      caster?: PlayerId;
      card?: ExtendedGameCard;
      sourceCardId?: string;
      targetId?: string;
      targetType?: 'player' | 'card';
      amount?: number;
    }
  ): boolean {
    const condition = watch.condition;

    console.log(`[doesWatchTrigger] Evaluating watch ${watch.id} for event type: ${event.type}`);
    console.log(`[doesWatchTrigger] Watch controller: ${watch.controller}, condition:`, condition);
    console.log(`[doesWatchTrigger] Event details:`, {
      caster: event.caster,
      cardName: event.card?.name,
      cardTypeLine: event.card?.typeLine,
    });

    // Check opponent condition
    if (condition.opponent !== undefined) {
      if (event.type === 'spell_cast' && event.caster) {
        const isOpponent = event.caster !== watch.controller;
        console.log(`[doesWatchTrigger] Opponent check: condition.opponent=${condition.opponent}, caster=${event.caster}, watchController=${watch.controller}, isOpponent=${isOpponent}`);
        if (condition.opponent && !isOpponent) {
          console.log(`[doesWatchTrigger] FAILED: Expected opponent but caster is not opponent`);
          return false;
        }
        if (!condition.opponent && isOpponent) {
          console.log(`[doesWatchTrigger] FAILED: Expected non-opponent but caster is opponent`);
          return false;
        }
      }
      if (event.type === 'combat_damage' && event.sourceCardId) {
        const sourceCard = state.cards[event.sourceCardId];
        const isOpponent = sourceCard?.controller !== watch.controller;
        if (condition.opponent && !isOpponent) return false;
        if (!condition.opponent && isOpponent) return false;
      }
    }

    // Check player condition
    if (condition.player && event.caster) {
      if (event.caster !== condition.player) {
        console.log(`[doesWatchTrigger] FAILED: Player condition not met`);
        return false;
      }
    }

    // For spell_cast triggers
    if (event.type === 'spell_cast' && event.card) {
      if (condition.spellType) {
        const typeLine = event.card.typeLine?.toLowerCase() || '';
        console.log(`[doesWatchTrigger] Checking spellType: condition=${condition.spellType}, typeLine="${typeLine}"`);

        switch (condition.spellType) {
          case 'creature':
            if (!typeLine.includes('creature')) {
              console.log(`[doesWatchTrigger] FAILED: Expected creature spell`);
              return false;
            }
            break;
          case 'noncreature':
            if (typeLine.includes('creature')) {
              console.log(`[doesWatchTrigger] FAILED: Expected noncreature but spell is creature`);
              return false;
            }
            console.log(`[doesWatchTrigger] PASSED: Spell is noncreature`);
            break;
          case 'instant':
            if (!typeLine.includes('instant')) return false;
            break;
          case 'sorcery':
            if (!typeLine.includes('sorcery')) return false;
            break;
          case 'artifact':
            if (!typeLine.includes('artifact')) return false;
            break;
          case 'enchantment':
            if (!typeLine.includes('enchantment')) return false;
            break;
        }
      }
    }

    // For combat_damage triggers
    if (event.type === 'combat_damage') {
      if (condition.damageSource === 'creature' && event.sourceCardId) {
        const sourceCard = state.cards[event.sourceCardId];
        if (!sourceCard?.typeLine?.includes('Creature')) return false;

        // Check subtype (e.g. "Artifact" for "artifact creature you control")
        if (condition.damageSourceSubtype) {
          if (!sourceCard.typeLine?.includes(condition.damageSourceSubtype)) return false;
        }
      }

      if (condition.damageTarget) {
        if (condition.damageTarget === 'player' && event.targetType !== 'player') {
          return false;
        }
        if (condition.damageTarget === 'creature' && event.targetType === 'card') {
          const targetCard = state.cards[event.targetId || ''];
          if (!targetCard?.typeLine?.includes('Creature')) return false;
        }
      }

      // Check if damage is dealt to the watch controller (for "deals combat damage to you" patterns).
      // Skip when opponent is explicitly false (meaning our creature deals damage to a player).
      if (event.targetType === 'player' && event.targetId && condition.opponent !== false) {
        if (event.targetId !== watch.controller) return false;
      }

      if (condition.minValue !== undefined && event.amount !== undefined) {
        if (event.amount < condition.minValue) return false;
      }
      if (condition.maxValue !== undefined && event.amount !== undefined) {
        if (event.amount > condition.maxValue) return false;
      }
    }

    console.log(`[doesWatchTrigger] All conditions passed, returning true`);
    return true;
  }

  /**
   * Execute the effect of a triggered watch
   */
  private executeWatchEffect(
    state: FullPlaytestGameState,
    watch: GameWatch
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const effect = watch.effect;
    const sourceCard = state.cards[watch.sourceCardId];

    if (!sourceCard) return events;

    // Log the trigger
    this.addLogEntry(state, events, {
      type: 'ability',
      player: watch.controller,
      message: `${sourceCard.name}'s ability triggered`,
    });

    switch (effect.action) {
      case 'create_token':
        if (effect.tokenType && effect.tokenCount) {
          // Note: You'll need to implement token creation
          // This is a placeholder for the token creation logic
          this.addLogEntry(state, events, {
            type: 'ability',
            player: watch.controller,
            message: `Created ${effect.tokenCount} ${effect.tokenType} token(s)`,
          });
        }
        break;

      case 'sacrifice':
        if (effect.sacrificeType) {
          // Find a card of the specified type to sacrifice
          const cardsToSacrifice = Object.values(state.cards).filter(
            card =>
              card.controller === watch.controller &&
              card.zone === 'battlefield' &&
              card.typeLine?.includes(effect.sacrificeType!)
          );

          if (cardsToSacrifice.length > 0) {
            const cardToSacrifice = cardsToSacrifice[0];
            events.push(
              ...this.moveCard(
                state,
                cardToSacrifice.instanceId,
                'graveyard',
                watch.controller
              )
            );
            this.addLogEntry(state, events, {
              type: 'ability',
              player: watch.controller,
              message: `Sacrificed ${cardToSacrifice.name}`,
            });
          }
        }
        break;

      case 'deal_damage':
        if (effect.damageAmount && effect.damageTarget) {
          // Implement damage dealing logic
          this.addLogEntry(state, events, {
            type: 'damage',
            player: watch.controller,
            message: `${sourceCard.name} dealt ${effect.damageAmount} damage`,
          });
        }
        break;

      case 'draw_card':
        if (effect.drawCount) {
          for (let i = 0; i < effect.drawCount; i++) {
            events.push(...this.drawCard(state, watch.controller));
          }
        }
        break;

      case 'add_mana':
        // Implement mana addition logic
        this.addLogEntry(state, events, {
          type: 'ability',
          player: watch.controller,
          message: `Added mana`,
        });
        break;

      case 'add_counter':
        if (effect.counterType && effect.counterAmount) {
          const currentCount = sourceCard.counters[effect.counterType] || 0;
          sourceCard.counters[effect.counterType] = currentCount + effect.counterAmount;
          events.push({
            type: 'card:counters',
            cardId: sourceCard.instanceId,
            counters: { ...sourceCard.counters },
          });
        }
        break;
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }
}
