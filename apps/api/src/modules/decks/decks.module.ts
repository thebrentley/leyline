import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';
import { SyncQueueService } from './sync-queue.service';
import { Deck } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { DeckVersion } from '../../entities/deck-version.entity';
import { CollectionCard } from '../../entities/collection-card.entity';
import { ColorTag } from '../../entities/color-tag.entity';
import { CardsModule } from '../cards/cards.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deck, DeckCard, DeckVersion, CollectionCard, ColorTag]),
    CardsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [DecksController],
  providers: [DecksService, SyncQueueService],
  exports: [DecksService, SyncQueueService],
})
export class DecksModule {}
