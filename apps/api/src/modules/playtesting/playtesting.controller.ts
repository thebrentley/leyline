import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { PlaytestingService } from './playtesting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { StartGameDto, PauseGameDto, ResumeGameDto, ContinueGameDto } from './dto/game-action.dto';

@Controller('playtesting')
@UseGuards(JwtAuthGuard)
export class PlaytestingController {
  constructor(private playtestingService: PlaytestingService) {}

  @Get('status')
  async getStatus(@CurrentUser() user: CurrentUserPayload) {
    return this.playtestingService.getStatus(user.userId);
  }

  /**
   * Start a new AI vs AI playtest game
   * Takes two deck IDs - one for each AI player
   */
  @Post('start')
  async startGame(
    @Body() body: StartGameDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const gameState = await this.playtestingService.startGame(
      body.player1DeckId,
      body.player2DeckId,
      user.userId,
      body.config,
    );
    return {
      success: true,
      sessionId: gameState.sessionId,
      gameState,
    };
  }

  /**
   * Legacy endpoint: Start a game with a single deck (opponent uses same deck)
   * @deprecated Use POST /start with two deck IDs instead
   */
  @Post('start/:deckId')
  async startGameLegacy(
    @Param('deckId') deckId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // For backwards compatibility, use same deck for both players
    const gameState = await this.playtestingService.startGame(
      deckId,
      deckId,
      user.userId,
    );
    return {
      success: true,
      sessionId: gameState.sessionId,
      gameState,
    };
  }

  /**
   * Get the current game state for a deck
   */
  @Get('game/:deckId')
  async getGameState(
    @Param('deckId') deckId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const gameState = this.playtestingService.getGameState(deckId);
    if (!gameState) {
      return { success: false, gameState: null };
    }
    return { success: true, gameState };
  }

  /**
   * Check if a game is currently running
   */
  @Get('running/:deckId')
  async isGameRunning(
    @Param('deckId') deckId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const running = this.playtestingService.isGameRunning(deckId);
    return { success: true, running };
  }

  /**
   * Pause a running game
   */
  @Post('pause/:deckId')
  async pauseGame(
    @Param('deckId') deckId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const paused = this.playtestingService.pauseGame(deckId);
    return { success: paused };
  }

  /**
   * Resume a paused game
   */
  @Post('resume/:deckId')
  async resumeGame(
    @Param('deckId') deckId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const resumed = this.playtestingService.resumeGame(deckId);
    return { success: resumed };
  }

  /**
   * Continue a game from a saved state
   * Loads the full game state and queues any incoming messages until ready
   */
  @Post('continue')
  async continueGame(
    @Body() body: ContinueGameDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const gameState = await this.playtestingService.continueGame(
      body.gameState,
      user.userId,
    );
    return {
      success: true,
      sessionId: gameState.sessionId,
      gameState,
    };
  }

  /**
   * Check if a game is currently loading (for action queueing)
   */
  @Get('loading/:deckId')
  async isGameLoading(
    @Param('deckId') deckId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const loading = this.playtestingService.isGameLoading(deckId);
    return { success: true, loading };
  }

  /**
   * End the current playtest game for a deck
   */
  @Delete('game/:deckId')
  async endGame(
    @Param('deckId') deckId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const ended = this.playtestingService.endGame(deckId);
    return { success: ended };
  }
}
