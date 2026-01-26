import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsInt, IsOptional, Min, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { CollectionService } from './collection.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

class AddToCollectionDto {
  @IsString()
  scryfallId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  foilQuantity?: number;
}

class LinkedDeckCardDto {
  @IsString()
  deckId: string;

  @IsString()
  deckName: string;
}

class UpdateCollectionCardDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  foilQuantity?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => LinkedDeckCardDto)
  linkedDeckCard?: LinkedDeckCardDto | null;
}

class BulkImportOptionsDto {
  @IsOptional()
  @IsBoolean()
  autoLink?: boolean;
}

class BulkImportDto {
  @IsArray()
  @IsString({ each: true })
  lines: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BulkImportOptionsDto)
  options?: BulkImportOptionsDto;
}

@Controller('collection')
@UseGuards(JwtAuthGuard)
export class CollectionController {
  constructor(private collectionService: CollectionService) {}

  @Get()
  async getCollection(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.collectionService.getUserCollection(user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      search,
    });
  }

  @Get('stats')
  async getStats(@CurrentUser() user: CurrentUserPayload) {
    return this.collectionService.getCollectionStats(user.userId);
  }

  @Post()
  async addToCollection(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AddToCollectionDto,
  ) {
    return this.collectionService.addToCollection(user.userId, dto);
  }

  @Post('link-all')
  async linkAllToDecks(@CurrentUser() user: CurrentUserPayload) {
    return this.collectionService.linkAllToDecks(user.userId);
  }

  @Post('bulk-import')
  async bulkImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkImportDto,
  ) {
    return this.collectionService.bulkImport(user.userId, dto.lines, dto.options);
  }

  @Put(':id')
  async updateCard(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateCollectionCardDto,
  ) {
    return this.collectionService.updateCollectionCard(id, user.userId, dto);
  }

  @Delete(':id')
  async removeCard(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.collectionService.removeFromCollection(id, user.userId);
    return { success: true };
  }
}
