import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { DecksService } from './decks.service';
import { SyncQueueService } from './sync-queue.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('decks')
@UseGuards(JwtAuthGuard)
export class DecksController {
  constructor(
    private decksService: DecksService,
    private syncQueueService: SyncQueueService,
  ) {}

  @Get()
  async getUserDecks(@CurrentUser() user: CurrentUserPayload) {
    return this.decksService.getUserDecks(user.userId);
  }

  @Get('archidekt')
  async listArchidektDecks(@CurrentUser() user: CurrentUserPayload) {
    return this.decksService.listArchidektDecks(user.userId);
  }

  @Get('sync/status')
  async getSyncStatus() {
    return this.syncQueueService.getQueueStatus();
  }

  @Get(':id')
  async getDeck(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.getDeckWithCards(id, user.userId);
  }

  @Post('sync/:archidektId')
  async syncFromArchidekt(
    @Param('archidektId') archidektId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // Find or create deck, then queue for sync
    const deck = await this.decksService.findOrCreateDeck(
      parseInt(archidektId, 10),
      user.userId,
    );
    await this.syncQueueService.queueSync(deck.id, deck.archidektId, user.userId);
    return { 
      id: deck.id, 
      name: deck.name, 
      syncStatus: 'pending',
      message: 'Deck queued for sync',
    };
  }

  @Post('sync-all')
  async syncAllFromArchidekt(@CurrentUser() user: CurrentUserPayload) {
    return this.syncQueueService.queueSyncAll(user.userId);
  }

  @Post(':id/cards')
  async addCardToDeck(
    @Param('id') id: string,
    @Body() body: { scryfallId: string; quantity: number },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.addCardToDeckByScryfallId(
      id,
      body.scryfallId,
      body.quantity,
      user.userId
    );
  }

  @Delete(':id/cards/:cardName')
  async removeCardFromDeck(
    @Param('id') id: string,
    @Param('cardName') cardName: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.removeCardFromDeck(
      id,
      decodeURIComponent(cardName),
      user.userId
    );
  }

  @Patch(':id/cards/quantity')
  async updateCardQuantity(
    @Param('id') id: string,
    @Body() body: { cardName: string; delta: number },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.updateCardQuantity(id, body.cardName, body.delta, user.userId);
  }

  @Patch(':id/cards/tag')
  async updateCardTag(
    @Param('id') id: string,
    @Body() body: { cardName: string; tag: string | null },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.updateCardTag(id, body.cardName, body.tag, user.userId);
  }

  @Patch(':id/cards/commander')
  async setCardCommander(
    @Param('id') id: string,
    @Body() body: { cardName: string; isCommander: boolean },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.setCardCommander(id, body.cardName, body.isCommander, user.userId);
  }

  @Patch(':id/cards/category')
  async setCardCategory(
    @Param('id') id: string,
    @Body() body: { cardName: string; category: 'mainboard' | 'sideboard' },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.setCardCategory(id, body.cardName, body.category, user.userId);
  }

  @Patch(':id/cards/edition')
  async changeCardEdition(
    @Param('id') id: string,
    @Body() body: { cardName: string; scryfallId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.changeCardEdition(id, body.cardName, body.scryfallId, user.userId);
  }

  @Post(':id/cards/link')
  async linkCardToCollection(
    @Param('id') id: string,
    @Body() body: { cardName: string; collectionCardId?: string; forceUnlink?: boolean },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.linkCardToCollection(
      id,
      body.cardName,
      user.userId,
      body.collectionCardId,
      body.forceUnlink
    );
  }

  @Post(':id/cards/unlink')
  async unlinkCardFromCollection(
    @Param('id') id: string,
    @Body() body: { cardName: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.unlinkCardFromCollection(id, body.cardName, user.userId);
  }

  @Post(':id/color-tags')
  async addColorTag(
    @Param('id') id: string,
    @Body() body: { name: string; color: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.addColorTag(id, body.name, body.color, user.userId);
  }

  @Patch(':id/color-tags/:tagName')
  async updateColorTag(
    @Param('id') id: string,
    @Param('tagName') tagName: string,
    @Body() body: { name: string; color: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.updateColorTag(id, decodeURIComponent(tagName), body.name, body.color, user.userId);
  }

  @Delete(':id/color-tags/:tagName')
  async deleteColorTag(
    @Param('id') id: string,
    @Param('tagName') tagName: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.deleteColorTag(id, decodeURIComponent(tagName), user.userId);
  }

  // ==================== Version History ====================

  @Get(':id/versions')
  async getVersions(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.getVersions(id, user.userId);
  }

  @Get(':id/versions/:versionId')
  async getVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.getVersion(versionId, user.userId);
  }

  @Post(':id/versions/:versionId/revert')
  async revertToVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.decksService.revertToVersion(versionId, user.userId);
  }

  @Delete(':id')
  async deleteDeck(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.decksService.deleteDeck(id, user.userId);
    return { success: true };
  }
}
