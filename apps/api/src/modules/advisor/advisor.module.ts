import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';
import { ChatSession } from '../../entities/chat-session.entity';
import { Deck } from '../../entities/deck.entity';
import { DecksModule } from '../decks/decks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, Deck]),
    DecksModule,
  ],
  controllers: [AdvisorController],
  providers: [AdvisorService],
  exports: [AdvisorService],
})
export class AdvisorModule {}
