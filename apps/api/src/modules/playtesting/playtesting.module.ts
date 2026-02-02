import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaytestingController } from './playtesting.controller';
import { PlaytestingService } from './playtesting.service';
import { GameEngineService } from './game-engine.service';
import { KeywordAbilitiesService } from './keyword-abilities.service';
import { AIOpponentService } from './ai-opponent.service';
import { GameLoopService } from './game-loop.service';
import { Deck } from '../../entities/deck.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Deck])],
  controllers: [PlaytestingController],
  providers: [
    PlaytestingService,
    GameEngineService,
    KeywordAbilitiesService,
    AIOpponentService,
    GameLoopService,
  ],
  exports: [
    PlaytestingService,
    GameEngineService,
    KeywordAbilitiesService,
    AIOpponentService,
    GameLoopService,
  ],
})
export class PlaytestingModule {}
