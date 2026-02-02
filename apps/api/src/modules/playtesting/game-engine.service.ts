import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
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
} from '@decktutor/shared';

@Injectable()
export class GameEngineService {
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
        type: 'phase:changed',
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
  private getNextStep(phase: GamePhase, step: GameStep): {
    phase: GamePhase;
    step: GameStep;
    newTurn: boolean;
  } {
    // Turn structure: Beginning (untap -> upkeep -> draw) -> Pre-combat Main ->
    // Combat (beginning -> attackers -> blockers -> first_strike -> damage -> end) ->
    // Post-combat Main -> Ending (end -> cleanup)

    switch (phase) {
      case 'beginning':
        switch (step) {
          case 'untap':
            return { phase: 'beginning', step: 'upkeep', newTurn: false };
          case 'upkeep':
            return { phase: 'beginning', step: 'draw', newTurn: false };
          case 'draw':
            return { phase: 'precombat_main', step: 'main', newTurn: false };
        }
        break;

      case 'precombat_main':
        return { phase: 'combat', step: 'beginning_of_combat', newTurn: false };

      case 'combat':
        switch (step) {
          case 'beginning_of_combat':
            return { phase: 'combat', step: 'declare_attackers', newTurn: false };
          case 'declare_attackers':
            return { phase: 'combat', step: 'declare_blockers', newTurn: false };
          case 'declare_blockers':
            // Check if there are first strikers
            return { phase: 'combat', step: 'first_strike_damage', newTurn: false };
          case 'first_strike_damage':
            return { phase: 'combat', step: 'combat_damage', newTurn: false };
          case 'combat_damage':
            return { phase: 'combat', step: 'end_of_combat', newTurn: false };
          case 'end_of_combat':
            return { phase: 'postcombat_main', step: 'main', newTurn: false };
        }
        break;

      case 'postcombat_main':
        return { phase: 'ending', step: 'end', newTurn: false };

      case 'ending':
        switch (step) {
          case 'end':
            return { phase: 'ending', step: 'cleanup', newTurn: false };
          case 'cleanup':
            return { phase: 'beginning', step: 'untap', newTurn: true };
        }
        break;
    }

    // Fallback (shouldn't reach here)
    return { phase: 'beginning', step: 'untap', newTurn: true };
  }

  /**
   * Start a new turn
   */
  private startNewTurn(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    // Switch active player
    state.activePlayer = state.activePlayer === 'player' ? 'opponent' : 'player';
    state.turnNumber++;

    // Reset land plays
    state.player.landPlaysRemaining = 1;
    state.opponent.landPlaysRemaining = 1;

    // Set phase to beginning/untap
    state.phase = 'beginning';
    state.step = 'untap';

    events.push({
      type: 'turn:started',
      turnNumber: state.turnNumber,
      activePlayer: state.activePlayer,
    });

    events.push({
      type: 'phase:changed',
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
      case 'untap':
        // Untap all permanents controlled by active player
        events.push(...this.untapStep(state));
        // No priority during untap, automatically advance
        events.push(...this.advancePhase(state));
        break;

      case 'upkeep':
        // Priority starts with active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
        break;

      case 'draw':
        // Active player draws (skip on turn 1 in 2-player)
        if (state.turnNumber > 1 || state.activePlayer === 'opponent') {
          events.push(...this.drawCard(state, state.activePlayer));
        }
        // Priority to active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
        break;

      case 'main':
        // Main phase - priority to active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
        break;

      case 'beginning_of_combat':
        // Combat begins
        state.combat.isActive = true;
        state.combat.attackers = [];
        state.combat.blockers = [];
        state.combat.damageAssignmentOrder = {};
        events.push({ type: 'combat:started' });
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
        break;

      case 'declare_attackers':
        // Wait for attacker declaration, then priority
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
        break;

      case 'declare_blockers':
        // Wait for blocker declaration, then priority
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
        break;

      case 'first_strike_damage':
      case 'combat_damage': {
        // Deal combat damage when entering the step
        const isFirstStrike = state.step === 'first_strike_damage';
        const damages = this.calculateCombatDamage(state, isFirstStrike);
        if (damages.length > 0) {
          events.push(...this.processCombatDamage(state, damages));
          events.push({ type: 'combat:damage', damages });
        }
        // Then priority to active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
        break;
      }

      case 'end_of_combat':
        events.push({ type: 'combat:ended' });
        state.combat.isActive = false;
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
        break;

      case 'end':
        // End step - priority to active player
        state.priorityPlayer = state.activePlayer;
        this.resetPriorityPasses(state);
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
        break;

      case 'cleanup':
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
      if (card.controller === activePlayer && card.zone === 'battlefield') {
        // Clear summoning sickness for all creatures at the start of your turn
        if (card.summoningSickness) {
          card.summoningSickness = false;
        }
        // Untap tapped permanents
        if (card.isTapped) {
          card.isTapped = false;
          events.push({ type: 'card:tapped', cardId: card.instanceId, cardName: card.name, player: activePlayer, isTapped: false });
        }
      }
    }

    this.addLogEntry(state, events, {
      type: 'phase',
      player: activePlayer,
      message: `${activePlayer === 'player' ? 'Player' : 'Opponent'} untaps all permanents`,
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
        events.push(...this.moveCard(state, cardId, 'graveyard', activePlayer));
      }
    }

    // Remove damage from creatures
    for (const card of Object.values(state.cards)) {
      if (card.zone === 'battlefield' && card.damage > 0) {
        card.damage = 0;
        events.push({ type: 'card:damage', cardId: card.instanceId, damage: 0 });
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
  passPriority(state: FullPlaytestGameState, player: PlayerId): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const otherPlayer: PlayerId = player === 'player' ? 'opponent' : 'player';

    // Mark this player as passed
    state[player].hasPassedPriority = true;

    // Check if other player has also passed
    if (state[otherPlayer].hasPassedPriority) {
      // Both players passed
      if (state.stack.length > 0) {
        // Resolve top of stack
        events.push(...this.resolveTopOfStack(state));
        // Reset priority passes, active player gets priority
        this.resetPriorityPasses(state);
        state.priorityPlayer = state.activePlayer;
        events.push({ type: 'priority:changed', player: state.priorityPlayer });
      } else {
        // Empty stack, advance to next phase/step
        events.push(...this.advancePhase(state));
      }
    } else {
      // Other player gets priority
      state.priorityPlayer = otherPlayer;
      events.push({ type: 'priority:changed', player: otherPlayer });
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
    events.push({ type: 'stack:added', item });

    // Reset priority passes, active player gets priority
    this.resetPriorityPasses(state);
    state.priorityPlayer = state.activePlayer;
    events.push({ type: 'priority:changed', player: state.priorityPlayer });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Resolve the top item on the stack
   */
  resolveTopOfStack(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    if (state.stack.length === 0) {
      return events;
    }

    const item = state.stack.pop()!;
    events.push({ type: 'stack:resolved', itemId: item.id });

    // Handle resolution based on type
    if (item.type === 'spell') {
      events.push(...this.resolveSpell(state, item));
    } else if (item.type === 'ability') {
      events.push(...this.resolveAbility(state, item));
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Resolve a spell (placeholder - will be expanded in Phase 9)
   */
  private resolveSpell(state: FullPlaytestGameState, item: StackItem): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[item.sourceCardId];

    if (!card) return events;

    // Check if it's a permanent spell
    const isPermanent =
      card.typeLine?.includes('Creature') ||
      card.typeLine?.includes('Artifact') ||
      card.typeLine?.includes('Enchantment') ||
      card.typeLine?.includes('Planeswalker') ||
      card.typeLine?.includes('Land');

    if (isPermanent) {
      // Move to battlefield
      events.push(...this.moveCard(state, card.instanceId, 'battlefield', item.controller));

      // Apply summoning sickness to creatures
      if (card.typeLine?.includes('Creature') && !card.keywords.includes('haste')) {
        card.summoningSickness = true;
      }
    } else {
      // Instant or sorcery - move to graveyard after resolution
      events.push(...this.moveCard(state, card.instanceId, 'graveyard', card.owner));
    }

    this.addLogEntry(state, events, {
      type: 'play',
      player: item.controller,
      message: `${item.controller === 'player' ? 'Player' : 'Opponent'} resolved ${card.name}`,
    });

    return events;
  }

  /**
   * Resolve an ability (placeholder - will be expanded in Phase 9)
   */
  private resolveAbility(state: FullPlaytestGameState, item: StackItem): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    this.addLogEntry(state, events, {
      type: 'ability',
      player: item.controller,
      message: `${item.controller === 'player' ? 'Player' : 'Opponent'} resolved ability: ${item.abilityText || 'unknown'}`,
    });

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

    // Keep checking until no more SBAs are performed
    while (sbaPerformed) {
      sbaPerformed = false;

      // Check player life totals
      if (state.player.life <= 0 && !state.isGameOver) {
        state.isGameOver = true;
        state.winner = 'opponent';
        state.gameOverReason = 'Player life reached 0';
        events.push({ type: 'game:over', winner: 'opponent', reason: state.gameOverReason });
        sbaPerformed = true;
      }

      if (state.opponent.life <= 0 && !state.isGameOver) {
        state.isGameOver = true;
        state.winner = 'player';
        state.gameOverReason = 'Opponent life reached 0';
        events.push({ type: 'game:over', winner: 'player', reason: state.gameOverReason });
        sbaPerformed = true;
      }

      // Check poison counters
      if (state.player.poisonCounters >= 10 && !state.isGameOver) {
        state.isGameOver = true;
        state.winner = 'opponent';
        state.gameOverReason = 'Player received 10 poison counters';
        events.push({ type: 'game:over', winner: 'opponent', reason: state.gameOverReason });
        sbaPerformed = true;
      }

      if (state.opponent.poisonCounters >= 10 && !state.isGameOver) {
        state.isGameOver = true;
        state.winner = 'player';
        state.gameOverReason = 'Opponent received 10 poison counters';
        events.push({ type: 'game:over', winner: 'player', reason: state.gameOverReason });
        sbaPerformed = true;
      }

      // Check creatures with lethal damage or 0 toughness
      for (const card of Object.values(state.cards)) {
        if (card.zone === 'battlefield' && card.typeLine?.includes('Creature')) {
          const toughness = this.parsePowerToughness(card.toughness);
          const effectiveToughness = toughness + (card.counters['+1/+1'] || 0) - (card.counters['-1/-1'] || 0);

          // Check lethal damage
          if (card.damage >= effectiveToughness && !card.keywords.includes('indestructible')) {
            events.push(...this.destroyPermanent(state, card.instanceId, 'lethal damage'));
            sbaPerformed = true;
          }

          // Check 0 or less toughness
          if (effectiveToughness <= 0) {
            events.push(...this.destroyPermanent(state, card.instanceId, '0 toughness'));
            sbaPerformed = true;
          }
        }

        // Check planeswalkers with 0 loyalty
        if (card.zone === 'battlefield' && card.typeLine?.includes('Planeswalker')) {
          const loyalty = card.counters['loyalty'] || 0;
          if (loyalty <= 0) {
            events.push(...this.destroyPermanent(state, card.instanceId, '0 loyalty'));
            sbaPerformed = true;
          }
        }
      }

      // Check legend rule
      events.push(...this.checkLegendRule(state));
      if (events.some((e) => e.type === 'card:destroyed')) {
        sbaPerformed = true;
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
  private checkLegendRule(state: FullPlaytestGameState): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const legendsByController: Record<PlayerId, Map<string, string[]>> = {
      player: new Map(),
      opponent: new Map(),
    };

    // Group legends by controller and name
    for (const card of Object.values(state.cards)) {
      if (card.zone === 'battlefield' && card.typeLine?.includes('Legendary')) {
        const map = legendsByController[card.controller];
        if (!map.has(card.name)) {
          map.set(card.name, []);
        }
        map.get(card.name)!.push(card.instanceId);
      }
    }

    // Destroy duplicates (keep first, destroy rest)
    for (const controller of ['player', 'opponent'] as PlayerId[]) {
      for (const [name, instanceIds] of legendsByController[controller]) {
        if (instanceIds.length > 1) {
          // Keep first, destroy rest
          for (let i = 1; i < instanceIds.length; i++) {
            events.push(...this.destroyPermanent(state, instanceIds[i], 'legend rule'));
          }
        }
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
  getAvailableActions(state: FullPlaytestGameState, player: PlayerId): GameAction[] {
    const actions: GameAction[] = [];
    const playerState = state[player];

    // Can always pass priority
    actions.push({ type: 'pass_priority' });

    // Can always concede
    actions.push({ type: 'concede' });

    // Check if it's a main phase for the active player
    const isMainPhase = state.step === 'main' && state.activePlayer === player;
    const canPlaySorcerySpeed = isMainPhase && state.stack.length === 0;

    // Play land (only during main phase, if haven't played one this turn)
    if (canPlaySorcerySpeed && playerState.landPlaysRemaining > 0) {
      for (const cardId of playerState.handOrder) {
        const card = state.cards[cardId];
        if (card && card.typeLine?.includes('Land')) {
          actions.push({ type: 'play_land', cardId });
        }
      }
    }

    // Cast spells from hand
    for (const cardId of playerState.handOrder) {
      const card = state.cards[cardId];
      if (!card || card.typeLine?.includes('Land')) continue;

      const isInstant = card.typeLine?.includes('Instant') || card.keywords.includes('flash');

      if (isInstant || canPlaySorcerySpeed) {
        // Check if can afford mana cost (simplified - just check if enough total mana)
        if (this.canAffordManaCost(state, player, card.manaCost)) {
          actions.push({ type: 'cast_spell', cardId });
        }
      }
    }

    // Activate abilities of permanents
    for (const card of Object.values(state.cards)) {
      if (card.controller === player && card.zone === 'battlefield') {
        // Tap for mana (lands and mana creatures)
        if (this.canTapForMana(card) && !card.isTapped) {
          actions.push({ type: 'tap_for_mana', cardId: card.instanceId });
        }

        // Other activated abilities would be parsed from oracle text
        // This will be expanded in Phase 9
      }
    }

    // Combat actions
    if (state.step === 'declare_attackers' && state.activePlayer === player) {
      const possibleAttackers = this.getPossibleAttackers(state, player);
      if (possibleAttackers.length > 0) {
        // Generate combinations of attackers (simplified - just allow declaring all or none for now)
        const attackerInfos: AttackerInfo[] = possibleAttackers.map((cardId) => ({
          cardId,
          attackingPlayerId: player,
          defendingTarget: player === 'player' ? 'opponent' : 'player',
        }));
        actions.push({ type: 'declare_attackers', attackers: attackerInfos });
        actions.push({ type: 'declare_attackers', attackers: [] }); // No attack
      }
    }

    if (state.step === 'declare_blockers' && state.activePlayer !== player) {
      const possibleBlockers = this.getPossibleBlockers(state, player);
      if (possibleBlockers.length > 0 && state.combat.attackers.length > 0) {
        // This will be expanded in Phase 8 for proper blocking
        actions.push({ type: 'declare_blockers', blockers: [] });
      }
    }

    return actions;
  }

  /**
   * Check if a player can afford a mana cost
   */
  private canAffordManaCost(state: FullPlaytestGameState, player: PlayerId, manaCost: string | null): boolean {
    if (!manaCost) return true;

    const playerState = state[player];

    // Count mana already in the pool
    let totalMana = Object.values(playerState.manaPool).reduce((sum, val) => sum + val, 0);

    // Add mana available from untapped sources
    for (const card of Object.values(state.cards)) {
      if (card.controller === player && card.zone === 'battlefield' && !card.isTapped) {
        if (this.canTapForMana(card)) {
          totalMana++;
        }
      }
    }

    // Parse CMC from mana cost (simplified)
    const cmc = this.parseManaCostCMC(manaCost);
    return totalMana >= cmc;
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
   * Check if a card can tap for mana
   */
  private canTapForMana(card: ExtendedGameCard): boolean {
    // Basic lands
    if (card.typeLine?.includes('Basic Land')) return true;

    // Non-basic lands that tap for mana
    if (card.typeLine?.includes('Land') && card.oracleText?.includes('Add')) return true;

    // Mana dorks
    if (card.oracleText?.includes('{T}: Add')) return true;

    return false;
  }

  /**
   * Get creatures that can attack
   */
  private getPossibleAttackers(state: FullPlaytestGameState, player: PlayerId): string[] {
    const attackers: string[] = [];

    for (const card of Object.values(state.cards)) {
      if (
        card.controller === player &&
        card.zone === 'battlefield' &&
        card.typeLine?.includes('Creature') &&
        !card.isTapped &&
        !card.summoningSickness &&
        !card.keywords.includes('defender')
      ) {
        attackers.push(card.instanceId);
      }
    }

    return attackers;
  }

  /**
   * Get creatures that can block
   */
  private getPossibleBlockers(state: FullPlaytestGameState, player: PlayerId): string[] {
    const blockers: string[] = [];

    for (const card of Object.values(state.cards)) {
      if (
        card.controller === player &&
        card.zone === 'battlefield' &&
        card.typeLine?.includes('Creature') &&
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
  playLand(state: FullPlaytestGameState, player: PlayerId, cardId: string): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const playerState = state[player];
    const card = state.cards[cardId];

    if (!card || playerState.landPlaysRemaining <= 0) {
      return events;
    }

    playerState.landPlaysRemaining--;
    events.push(...this.moveCard(state, cardId, 'battlefield', player));

    this.addLogEntry(state, events, {
      type: 'play',
      player,
      message: `${player === 'player' ? 'Player' : 'Opponent'} played ${card.name}`,
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
    targets?: { type: 'card' | 'player'; id: string }[],
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];

    if (!card) return events;

    // Spend mana from pool for the spell's cost
    events.push(...this.spendManaForCost(state, player, card.manaCost));

    // Move to stack
    card.zone = 'stack';
    const playerState = state[player];
    const handIndex = playerState.handOrder.indexOf(cardId);
    if (handIndex > -1) {
      playerState.handOrder.splice(handIndex, 1);
    }

    // Create stack item
    const stackItem: StackItem = {
      id: uuidv4(),
      type: 'spell',
      sourceCardId: cardId,
      controller: player,
      targets: targets || [],
      cardName: card.name,
      manaCost: card.manaCost || undefined,
    };

    events.push(...this.addToStack(state, stackItem));

    this.addLogEntry(state, events, {
      type: 'play',
      player,
      message: `${player === 'player' ? 'Player' : 'Opponent'} cast ${card.name}`,
    });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Spend mana from pool to pay a cost (simplified - doesn't enforce color requirements)
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
    let remaining = cmc;

    // Parse colored mana requirements from cost
    const coloredRequired: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    const colorMatches = manaCost.match(/\{([WUBRG])\}/g);
    if (colorMatches) {
      for (const match of colorMatches) {
        const color = match.charAt(1);
        coloredRequired[color]++;
      }
    }

    // Spend colored mana first (to satisfy color requirements)
    for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
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
      for (const color of ['C', 'W', 'U', 'B', 'R', 'G'] as const) {
        const available = playerState.manaPool[color];
        const toSpend = Math.min(remaining, available);
        if (toSpend > 0) {
          playerState.manaPool[color] -= toSpend;
          remaining -= toSpend;
        }
        if (remaining <= 0) break;
      }
    }

    events.push({ type: 'mana:changed', player, manaPool: { ...playerState.manaPool } });
    return events;
  }

  /**
   * Tap a permanent for mana
   */
  tapForMana(state: FullPlaytestGameState, player: PlayerId, cardId: string): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];
    const playerState = state[player];

    if (!card || card.isTapped) return events;

    card.isTapped = true;
    events.push({ type: 'card:tapped', cardId, cardName: card.name, player, isTapped: true });

    // Add mana to pool (simplified - assume 1 mana of appropriate color)
    const manaColor = this.getManaColorFromCard(card);
    playerState.manaPool[manaColor]++;
    events.push({ type: 'mana:changed', player, manaPool: { ...playerState.manaPool } });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Get mana color a card produces (simplified)
   */
  private getManaColorFromCard(card: ExtendedGameCard): keyof ManaPool {
    const typeLine = card.typeLine?.toLowerCase() || '';
    const oracleText = card.oracleText?.toLowerCase() || '';

    if (typeLine.includes('plains') || oracleText.includes('add {w}')) return 'W';
    if (typeLine.includes('island') || oracleText.includes('add {u}')) return 'U';
    if (typeLine.includes('swamp') || oracleText.includes('add {b}')) return 'B';
    if (typeLine.includes('mountain') || oracleText.includes('add {r}')) return 'R';
    if (typeLine.includes('forest') || oracleText.includes('add {g}')) return 'G';

    return 'C'; // Default to colorless
  }

  /**
   * Declare attackers
   */
  declareAttackers(state: FullPlaytestGameState, attackers: AttackerInfo[]): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    state.combat.attackers = attackers;

    // Tap all attacking creatures (unless vigilance)
    for (const attacker of attackers) {
      const card = state.cards[attacker.cardId];
      if (card && !card.keywords.includes('vigilance')) {
        card.isTapped = true;
        events.push({ type: 'card:tapped', cardId: attacker.cardId, cardName: card.name, player: state.activePlayer, isTapped: true });
      }
    }

    events.push({ type: 'combat:attackers', attackers });

    if (attackers.length > 0) {
      this.addLogEntry(state, events, {
        type: 'combat',
        player: state.activePlayer,
        message: `${state.activePlayer === 'player' ? 'Player' : 'Opponent'} attacks with ${attackers.length} creature(s)`,
      });
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Declare blockers
   */
  declareBlockers(state: FullPlaytestGameState, blockers: BlockerInfo[]): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    state.combat.blockers = blockers;
    events.push({ type: 'combat:blockers', blockers });

    if (blockers.length > 0) {
      const defender: PlayerId = state.activePlayer === 'player' ? 'opponent' : 'player';
      this.addLogEntry(state, events, {
        type: 'combat',
        player: defender,
        message: `${defender === 'player' ? 'Player' : 'Opponent'} blocks with ${blockers.length} creature(s)`,
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
    toZone: ExtendedGameCard['zone'],
    controller: PlayerId,
  ): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];

    if (!card) return events;

    const fromZone = card.zone;
    card.zone = toZone;
    card.controller = controller;

    // Update zone ordering arrays
    this.removeFromZoneOrder(state, cardId, fromZone, card.owner);
    this.addToZoneOrder(state, cardId, toZone, controller);

    events.push({ type: 'card:moved', cardId, cardName: card.name, player: controller, from: fromZone, to: toZone });

    return events;
  }

  /**
   * Remove card from zone ordering
   */
  private removeFromZoneOrder(
    state: FullPlaytestGameState,
    cardId: string,
    zone: ExtendedGameCard['zone'],
    owner: PlayerId,
  ): void {
    const playerState = state[owner];

    switch (zone) {
      case 'hand':
        const handIdx = playerState.handOrder.indexOf(cardId);
        if (handIdx > -1) playerState.handOrder.splice(handIdx, 1);
        break;
      case 'library':
        const libIdx = playerState.libraryOrder.indexOf(cardId);
        if (libIdx > -1) playerState.libraryOrder.splice(libIdx, 1);
        break;
      case 'graveyard':
        const gravIdx = playerState.graveyardOrder.indexOf(cardId);
        if (gravIdx > -1) playerState.graveyardOrder.splice(gravIdx, 1);
        break;
      case 'exile':
        const exileIdx = playerState.exileOrder.indexOf(cardId);
        if (exileIdx > -1) playerState.exileOrder.splice(exileIdx, 1);
        break;
      case 'command':
        const cmdIdx = playerState.commandZone.indexOf(cardId);
        if (cmdIdx > -1) playerState.commandZone.splice(cmdIdx, 1);
        break;
      case 'battlefield':
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
    zone: ExtendedGameCard['zone'],
    controller: PlayerId,
  ): void {
    const playerState = state[controller];

    switch (zone) {
      case 'hand':
        playerState.handOrder.push(cardId);
        break;
      case 'library':
        playerState.libraryOrder.push(cardId);
        break;
      case 'graveyard':
        playerState.graveyardOrder.push(cardId);
        break;
      case 'exile':
        playerState.exileOrder.push(cardId);
        break;
      case 'command':
        playerState.commandZone.push(cardId);
        break;
      case 'battlefield':
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
      state.winner = player === 'player' ? 'opponent' : 'player';
      state.gameOverReason = `${player === 'player' ? 'Player' : 'Opponent'} attempted to draw from empty library`;
      events.push({ type: 'game:over', winner: state.winner, reason: state.gameOverReason });
      return events;
    }

    const cardId = playerState.libraryOrder.shift()!;
    const card = state.cards[cardId];

    if (card) {
      card.zone = 'hand';
      playerState.handOrder.push(cardId);
      events.push({ type: 'card:moved', cardId, cardName: card.name, player, from: 'library', to: 'hand' });

      this.addLogEntry(state, events, {
        type: 'draw',
        player,
        message: `${player === 'player' ? 'Player' : 'Opponent'} drew a card`,
      });
    }

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Destroy a permanent
   */
  destroyPermanent(state: FullPlaytestGameState, cardId: string, reason: string): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const card = state.cards[cardId];

    if (!card || card.zone !== 'battlefield') return events;

    // Check indestructible
    if (card.keywords.includes('indestructible') && !reason.includes('0 toughness')) {
      return events;
    }

    events.push({ type: 'card:destroyed', cardId, reason });
    events.push(...this.moveCard(state, cardId, 'graveyard', card.owner));

    // Reset card state
    card.isTapped = false;
    card.damage = 0;
    card.counters = {};
    card.attachedTo = null;
    card.attachments = [];
    card.summoningSickness = false;

    this.addLogEntry(state, events, {
      type: 'action',
      player: card.controller,
      message: `${card.name} was destroyed (${reason})`,
    });

    state.updatedAt = new Date().toISOString();
    return events;
  }

  /**
   * Deal damage to a player
   */
  dealDamageToPlayer(state: FullPlaytestGameState, player: PlayerId, amount: number, source?: string): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];
    const playerState = state[player];

    const oldLife = playerState.life;
    playerState.life -= amount;

    events.push({
      type: 'life:changed',
      player,
      life: playerState.life,
      change: -amount,
      source,
    });

    this.addLogEntry(state, events, {
      type: 'damage',
      player,
      message: `${player === 'player' ? 'Player' : 'Opponent'} took ${amount} damage${source ? ` from ${source}` : ''}`,
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

    if (!card || card.zone !== 'battlefield') return events;

    card.damage += amount;
    events.push({ type: 'card:damage', cardId, damage: card.damage, source });

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
  private addLogEntry(
    state: FullPlaytestGameState,
    events: PlaytestEvent[],
    entry: Omit<GameLogEntry, 'id' | 'timestamp'>,
  ): void {
    const logEntry: GameLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    state.log.push(logEntry);
    events.push({ type: 'game:log', entry: logEntry });
  }

  // =====================
  // Combat Damage (Phase 8 preview)
  // =====================

  /**
   * Calculate combat damage
   */
  calculateCombatDamage(state: FullPlaytestGameState, isFirstStrike: boolean): CombatDamageInfo[] {
    const damages: CombatDamageInfo[] = [];

    for (const attacker of state.combat.attackers) {
      const attackerCard = state.cards[attacker.cardId];
      if (!attackerCard || attackerCard.zone !== 'battlefield') continue;

      const hasFirstStrike = attackerCard.keywords.includes('first strike') || attackerCard.keywords.includes('double strike');
      const hasOnlyRegularStrike = !hasFirstStrike || attackerCard.keywords.includes('double strike');

      // Skip if wrong damage step
      if (isFirstStrike && !hasFirstStrike) continue;
      if (!isFirstStrike && !hasOnlyRegularStrike) continue;

      const power = this.parsePowerToughness(attackerCard.power);
      if (power <= 0) continue;

      // Find blockers for this attacker
      const blockers = state.combat.blockers.filter((b) => b.blockingAttackerId === attacker.cardId);

      if (blockers.length === 0) {
        // Unblocked - damage goes to defending player/planeswalker
        const targetType = typeof attacker.defendingTarget === 'string' && attacker.defendingTarget !== 'player' && attacker.defendingTarget !== 'opponent' ? 'card' : 'player';
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
          if (!blockerCard || blockerCard.zone !== 'battlefield') continue;

          const toughness = this.parsePowerToughness(blockerCard.toughness);
          const damageToAssign = Math.min(remainingDamage, toughness - blockerCard.damage);

          if (damageToAssign > 0) {
            damages.push({
              sourceId: attacker.cardId,
              targetId: blocker.cardId,
              targetType: 'card',
              amount: damageToAssign,
              isFirstStrike,
            });
            remainingDamage -= damageToAssign;
          }
        }

        // Trample damage to player
        if (remainingDamage > 0 && attackerCard.keywords.includes('trample')) {
          damages.push({
            sourceId: attacker.cardId,
            targetId: attacker.defendingTarget,
            targetType: 'player',
            amount: remainingDamage,
            isFirstStrike,
          });
        }
      }
    }

    // Blockers deal damage to attackers
    for (const blocker of state.combat.blockers) {
      const blockerCard = state.cards[blocker.cardId];
      if (!blockerCard || blockerCard.zone !== 'battlefield') continue;

      const hasFirstStrike = blockerCard.keywords.includes('first strike') || blockerCard.keywords.includes('double strike');
      const hasOnlyRegularStrike = !hasFirstStrike || blockerCard.keywords.includes('double strike');

      if (isFirstStrike && !hasFirstStrike) continue;
      if (!isFirstStrike && !hasOnlyRegularStrike) continue;

      const power = this.parsePowerToughness(blockerCard.power);
      if (power <= 0) continue;

      damages.push({
        sourceId: blocker.cardId,
        targetId: blocker.blockingAttackerId,
        targetType: 'card',
        amount: power,
        isFirstStrike,
      });
    }

    return damages;
  }

  /**
   * Process combat damage
   */
  processCombatDamage(state: FullPlaytestGameState, damages: CombatDamageInfo[]): PlaytestEvent[] {
    const events: PlaytestEvent[] = [];

    for (const damage of damages) {
      const sourceCard = state.cards[damage.sourceId];
      const sourceName = sourceCard?.name || 'Unknown';

      if (damage.targetType === 'player') {
        const playerId = damage.targetId as PlayerId;

        // Check for lifelink
        if (sourceCard?.keywords.includes('lifelink')) {
          const controller = sourceCard.controller;
          state[controller].life += damage.amount;
          events.push({
            type: 'life:changed',
            player: controller,
            life: state[controller].life,
            change: damage.amount,
            source: `${sourceName} (lifelink)`,
          });
        }

        events.push(...this.dealDamageToPlayer(state, playerId, damage.amount, sourceName));
      } else {
        const targetCard = state.cards[damage.targetId];
        if (!targetCard) continue;

        // Check for lifelink
        if (sourceCard?.keywords.includes('lifelink')) {
          const controller = sourceCard.controller;
          state[controller].life += damage.amount;
          events.push({
            type: 'life:changed',
            player: controller,
            life: state[controller].life,
            change: damage.amount,
            source: `${sourceName} (lifelink)`,
          });
        }

        // Check for deathtouch
        if (sourceCard?.keywords.includes('deathtouch') && damage.amount > 0) {
          // Mark for destruction (handled by SBAs)
          targetCard.damage = 9999; // Lethal
        } else {
          events.push(...this.dealDamageToCreature(state, damage.targetId, damage.amount, sourceName));
        }
      }
    }

    events.push({ type: 'combat:damage', damages });

    state.updatedAt = new Date().toISOString();
    return events;
  }
}
