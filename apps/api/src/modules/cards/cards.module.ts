import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { Card } from '../../entities/card.entity';
import { SearchParserService } from './search-parser.service';
import { SearchBuilderService } from './search-builder.service';

@Module({
  imports: [TypeOrmModule.forFeature([Card])],
  controllers: [CardsController],
  providers: [CardsService, SearchParserService, SearchBuilderService],
  exports: [CardsService],
})
export class CardsModule {}
