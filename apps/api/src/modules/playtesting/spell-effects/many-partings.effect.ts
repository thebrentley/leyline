import type {
  FullPlaytestGameState,
  PlayerId,
  StackItem,
} from '@leyline/shared';
import type { PlaytestEvent } from '../game-engine.service';
import type { SpellEffect } from './spell-effect.interface';
import { TokensService } from '../tokens.service';
import { SearchService } from '../search.service';
import { GameEngineService } from '../game-engine.service';
import { LandSelectionService } from '../land-selection.service';

/**
 * Many Partings
 * {G}
 * Sorcery
 * "Search your library for a basic land card, reveal it, put it into your hand,
 * then shuffle. Create a Food token."
 */
export class ManyPartingsEffect implements SpellEffect {
  cardName = 'Many Partings';

  constructor(
    private tokensService: TokensService,
    private searchService: SearchService,
    private gameEngine: GameEngineService,
    private landSelection: LandSelectionService,
  ) {}

  async execute(
    state: FullPlaytestGameState,
    stackItem: StackItem,
    controller: PlayerId,
  ): Promise<PlaytestEvent[]> {
    const events: PlaytestEvent[] = [];

    // Part 1: Search library for a basic land card using intelligent selection
    const basicLands = this.searchService.searchLibrary(
      state,
      controller,
      {
        supertype: 'Basic',
        type: 'Land',
      },
      0, // Get all basic lands
    );

    if (basicLands.length > 0) {
      // Use LLM to select the best land
      const selectedLandId = await this.landSelection.selectBestLand(
        state,
        controller,
        basicLands,
      );

      if (selectedLandId) {
        const land = state.cards[selectedLandId];

        if (land) {
          // Reveal the card (add to log)
          this.gameEngine.addLogEntry(state, events, {
            type: 'action',
            player: controller,
            message: `${controller === 'player' ? 'Player' : 'Opponent'} reveals ${land.name}`,
          });

          // Move the land from library to hand
          const moveEvents = this.gameEngine.moveCard(
            state,
            selectedLandId,
            'hand',
            controller,
          );
          events.push(...moveEvents);

          // Shuffle the library
          this.shuffleLibrary(state, controller);
          events.push({
            type: 'zone:shuffled',
            zone: 'library',
            player: controller,
          });

          this.gameEngine.addLogEntry(state, events, {
            type: 'action',
            player: controller,
            message: `${controller === 'player' ? 'Player' : 'Opponent'} shuffles their library`,
          });
        }
      }
    } else {
      // No basic lands found - still shuffle
      this.gameEngine.addLogEntry(state, events, {
        type: 'action',
        player: controller,
        message: `${controller === 'player' ? 'Player' : 'Opponent'} searches but finds no basic lands`,
      });

      this.shuffleLibrary(state, controller);
      events.push({
        type: 'zone:shuffled',
        zone: 'library',
        player: controller,
      });
    }

    // Part 2: Create a Food token
    try {
      const foodTokenIds = await this.tokensService.createTokens(
        state,
        'food',
        controller,
        1,
      );

      if (foodTokenIds.length > 0) {
        events.push({
          type: 'token:created',
          tokenIds: foodTokenIds,
          tokenName: 'Food',
          controller: controller,
        });

        this.gameEngine.addLogEntry(state, events, {
          type: 'action',
          player: controller,
          message: `${controller === 'player' ? 'Player' : 'Opponent'} creates a Food token`,
        });
      }
    } catch (error) {
      // If Food token doesn't exist in database yet, log a warning
      console.warn('Food token not found in database:', error);
      this.gameEngine.addLogEntry(state, events, {
        type: 'action',
        player: controller,
        message: `(Food token creation pending - token not in database yet)`,
      });
    }

    return events;
  }

  /**
   * Shuffle a player's library
   */
  private shuffleLibrary(state: FullPlaytestGameState, player: PlayerId): void {
    const library = state[player].libraryOrder;

    // Fisher-Yates shuffle
    for (let i = library.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [library[i], library[j]] = [library[j], library[i]];
    }
  }
}
