import { IsString, IsOptional, IsObject, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import type { GameAction, GameConfig, FullPlaytestGameState } from '@leyline/shared';

export class StartGameDto {
  @IsString()
  player1DeckId: string;

  @IsString()
  player2DeckId: string;

  @IsOptional()
  @IsObject()
  config?: Partial<GameConfig>;
}

export class GameActionDto {
  @IsString()
  deckId: string;

  @IsObject()
  action: GameAction;
}

export class PauseGameDto {
  @IsString()
  deckId: string;
}

export class ResumeGameDto {
  @IsString()
  deckId: string;
}

export class StopGameDto {
  @IsString()
  deckId: string;
}

export class ContinueGameDto {
  @IsObject()
  gameState: FullPlaytestGameState;
}
