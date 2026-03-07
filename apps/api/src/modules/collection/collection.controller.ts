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
import { IsString, IsInt, IsOptional, Min, ValidateNested, IsArray, IsBoolean, ArrayMaxSize } from 'class-validator';
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

  @IsOptional()
  @IsString()
  folderId?: string;
}

class LinkedDeckCardDto {
  @IsString()
  deckId: string;

  @IsString()
  deckName: string;

  @IsInt()
  @Min(1)
  quantity: number;
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkedDeckCardDto)
  linkedDeckCards?: LinkedDeckCardDto[] | null;
}

class BulkImportOptionsDto {
  @IsOptional()
  @IsBoolean()
  autoLink?: boolean;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  deckId?: string;

  @IsOptional()
  @IsBoolean()
  overrideSet?: boolean;

  @IsOptional()
  @IsBoolean()
  addMissing?: boolean;
}

class BulkImportDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  lines: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BulkImportOptionsDto)
  options?: BulkImportOptionsDto;
}

class LinkToDeckDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  scryfallIds: string[];

  @IsString()
  deckId: string;

  @IsOptional()
  @IsBoolean()
  overrideSet?: boolean;

  @IsOptional()
  @IsBoolean()
  addMissing?: boolean;
}

class CreateFolderDto {
  @IsString()
  name: string;
}

class RenameFolderDto {
  @IsString()
  name: string;
}

class MoveCardsDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  cardIds: string[];

  @IsOptional()
  @IsString()
  folderId?: string | null;
}

class BulkDeleteDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  cardIds: string[];
}

@Controller('collection')
@UseGuards(JwtAuthGuard)
export class CollectionController {
  constructor(private collectionService: CollectionService) {}

  // ==================== Folder endpoints (before :id routes) ====================

  @Get('folders')
  async getFolders(@CurrentUser() user: CurrentUserPayload) {
    return this.collectionService.getUserFolders(user.userId);
  }

  @Post('folders')
  async createFolder(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateFolderDto,
  ) {
    return this.collectionService.createFolder(user.userId, dto.name);
  }

  @Put('folders/:folderId')
  async renameFolder(
    @Param('folderId') folderId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RenameFolderDto,
  ) {
    return this.collectionService.renameFolder(folderId, user.userId, dto.name);
  }

  @Delete('folders/:folderId')
  async deleteFolder(
    @Param('folderId') folderId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.collectionService.deleteFolder(folderId, user.userId);
    return { success: true };
  }

  @Post('folders/move')
  async moveCards(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: MoveCardsDto,
  ) {
    return this.collectionService.moveCardsToFolder(
      user.userId,
      dto.cardIds,
      dto.folderId ?? null,
    );
  }

  @Post('bulk-delete')
  async bulkDelete(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkDeleteDto,
  ) {
    return this.collectionService.bulkRemove(user.userId, dto.cardIds);
  }

  // ==================== Deck groups ====================

  @Get('deck-groups')
  async getDeckGroups(@CurrentUser() user: CurrentUserPayload) {
    return this.collectionService.getDeckGroups(user.userId);
  }

  // ==================== Collection endpoints ====================

  @Get('all-ids')
  async getAllIds(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('folderId') folderId?: string,
    @Query('deckId') deckId?: string,
  ) {
    return this.collectionService.getAllCardIds(user.userId, {
      search: search || undefined,
      folderId: folderId || undefined,
      deckId: deckId || undefined,
    });
  }

  @Get('stats')
  async getStats(
    @CurrentUser() user: CurrentUserPayload,
    @Query('folderId') folderId?: string,
    @Query('deckId') deckId?: string,
  ) {
    return this.collectionService.getCollectionStats(user.userId, {
      folderId: folderId || undefined,
      deckId: deckId || undefined,
    });
  }

  @Get()
  async getCollection(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('folderId') folderId?: string,
    @Query('deckId') deckId?: string,
    @Query('sort') sort?: string,
  ) {
    const validSorts = ['name', 'value', 'date'] as const;
    const sortValue = validSorts.includes(sort as any) ? (sort as 'name' | 'value' | 'date') : undefined;
    return this.collectionService.getUserCollection(user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      search,
      folderId: folderId || undefined,
      deckId: deckId || undefined,
      sort: sortValue,
    });
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

  @Post('link-to-deck')
  async linkToDeck(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: LinkToDeckDto,
  ) {
    return this.collectionService.linkImportedToDeck(
      user.userId,
      dto.scryfallIds,
      dto.deckId,
      { overrideSet: dto.overrideSet, addMissing: dto.addMissing },
    );
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
