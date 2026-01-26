import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { CollectionCard } from '../../entities/collection-card.entity';
import { Deck } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { CardsModule } from '../cards/cards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollectionCard, Deck, DeckCard]),
    CardsModule,
  ],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
