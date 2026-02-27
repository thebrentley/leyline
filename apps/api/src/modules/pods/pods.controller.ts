import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PodsService } from './pods.service';
import { PodsEventsService } from './pods-events.service';
import { PodsOfflineMembersService } from './pods-offline-members.service';
import { EventChatService } from './event-chat.service';
import { RsvpStatus } from '../../entities/event-rsvp.entity';

@Controller('pods')
@UseGuards(JwtAuthGuard)
export class PodsController {
  constructor(
    private podsService: PodsService,
    private podsEventsService: PodsEventsService,
    private offlineMembersService: PodsOfflineMembersService,
    private eventChatService: EventChatService,
  ) {}

  // ==================== Pod CRUD ====================

  @Post()
  async createPod(
    @Body() body: { name: string; description?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.createPod(
      body.name,
      body.description ?? null,
      user.userId,
    );
  }

  @Get()
  async getUserPods(@CurrentUser() user: CurrentUserPayload) {
    return this.podsService.getUserPods(user.userId);
  }

  // Static routes must come before parameterized routes
  @Get('invites/pending')
  async getPendingInvites(@CurrentUser() user: CurrentUserPayload) {
    return this.podsService.getUserInvites(user.userId);
  }

  @Get('users/search')
  async searchUsers(
    @Query('q') query: string,
    @Query('podId') podId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.searchUsers(query, user.userId, podId);
  }

  @Get('users/:userId/profile')
  async getUserProfile(
    @Param('userId') userId: string,
    @CurrentUser() viewer: CurrentUserPayload,
  ) {
    return this.podsService.getUserProfile(userId, viewer.userId);
  }

  // ==================== Email Invites ====================

  @Public()
  @Get('invite-token/:token')
  async getInviteByToken(@Param('token') token: string) {
    return this.podsService.getInviteByToken(token);
  }

  @Post('invite-token/:token/accept')
  async acceptInviteByToken(
    @Param('token') token: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.acceptInviteByToken(token, user.userId);
  }

  @Get(':podId')
  async getPod(
    @Param('podId') podId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.getPod(podId, user.userId);
  }

  @Patch(':podId')
  async updatePod(
    @Param('podId') podId: string,
    @Body() body: { name?: string; description?: string; coverImage?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.updatePod(podId, user.userId, body);
  }

  @Delete(':podId')
  async deletePod(
    @Param('podId') podId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.deletePod(podId, user.userId);
  }

  // ==================== Invite Code ====================

  @Post('join/:inviteCode')
  async joinByCode(
    @Param('inviteCode') inviteCode: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.joinByCode(inviteCode, user.userId);
  }

  @Post(':podId/invite-code/regenerate')
  async regenerateInviteCode(
    @Param('podId') podId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.regenerateInviteCode(podId, user.userId);
  }

  // ==================== Direct Invites ====================

  @Post(':podId/invites')
  async inviteUser(
    @Param('podId') podId: string,
    @Body() body: { userId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.inviteUser(podId, user.userId, body.userId);
  }

  @Post('invites/:inviteId/respond')
  async respondToInvite(
    @Param('inviteId') inviteId: string,
    @Body() body: { accept: boolean },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.respondToInvite(inviteId, user.userId, body.accept);
  }

  @Post(':podId/invite-email')
  async inviteByEmail(
    @Param('podId') podId: string,
    @Body() body: { email: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.inviteByEmail(podId, user.userId, body.email);
  }

  @Delete(':podId/invites/:inviteId')
  async rescindInvite(
    @Param('podId') podId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.rescindInvite(podId, inviteId, user.userId);
  }

  @Post(':podId/invites/:inviteId/resend')
  async resendInviteEmail(
    @Param('podId') podId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.resendInviteEmail(podId, inviteId, user.userId);
  }

  // ==================== Member Management ====================

  @Delete(':podId/members/:userId')
  async removeMember(
    @Param('podId') podId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.removeMember(podId, user.userId, targetUserId);
  }

  @Patch(':podId/members/:userId/promote')
  async promoteMember(
    @Param('podId') podId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.promoteMember(podId, user.userId, targetUserId);
  }

  @Patch(':podId/members/:userId/demote')
  async demoteMember(
    @Param('podId') podId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.demoteMember(podId, user.userId, targetUserId);
  }

  @Post(':podId/leave')
  async leavePod(
    @Param('podId') podId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.leavePod(podId, user.userId);
  }

  // ==================== Offline Members ====================

  @Post(':podId/offline-members')
  async addOfflineMember(
    @Param('podId') podId: string,
    @Body() body: { name: string; email?: string; notes?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.offlineMembersService.addOfflineMember(podId, user.userId, body);
  }

  @Get(':podId/offline-members')
  async getOfflineMembers(
    @Param('podId') podId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.offlineMembersService.getOfflineMembers(podId, user.userId);
  }

  @Patch(':podId/offline-members/:offlineMemberId')
  async updateOfflineMember(
    @Param('podId') podId: string,
    @Param('offlineMemberId') offlineMemberId: string,
    @Body() body: { name?: string; email?: string; notes?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.offlineMembersService.updateOfflineMember(
      podId,
      offlineMemberId,
      user.userId,
      body,
    );
  }

  @Delete(':podId/offline-members/:offlineMemberId')
  async removeOfflineMember(
    @Param('podId') podId: string,
    @Param('offlineMemberId') offlineMemberId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.offlineMembersService.removeOfflineMember(
      podId,
      offlineMemberId,
      user.userId,
    );
  }

  @Patch(':podId/offline-members/:offlineMemberId/link')
  async linkOfflineMember(
    @Param('podId') podId: string,
    @Param('offlineMemberId') offlineMemberId: string,
    @Body() body: { userId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.offlineMembersService.linkOfflineMember(
      podId,
      offlineMemberId,
      body.userId,
      user.userId,
    );
  }

  // ==================== Events ====================

  @Post(':podId/events')
  async createEvent(
    @Param('podId') podId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      location?: string;
      startsAt: string;
      endsAt?: string;
    },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.createEvent(podId, user.userId, body);
  }

  @Get(':podId/events')
  async getEvents(
    @Param('podId') podId: string,
    @Query('upcoming') upcoming: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.getEvents(
      podId,
      user.userId,
      upcoming === 'true',
    );
  }

  @Get(':podId/events/:eventId')
  async getEvent(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.getEvent(podId, eventId, user.userId);
  }

  @Patch(':podId/events/:eventId')
  async updateEvent(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      location?: string;
      startsAt?: string;
      endsAt?: string;
    },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.updateEvent(podId, eventId, user.userId, body);
  }

  @Delete(':podId/events/:eventId')
  async deleteEvent(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.deleteEvent(podId, eventId, user.userId);
  }

  @Post(':podId/events/:eventId/rsvp')
  async rsvp(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @Body() body: { status: RsvpStatus; comment?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.rsvp(
      podId,
      eventId,
      user.userId,
      body.status,
      body.comment,
    );
  }

  @Delete(':podId/events/:eventId/rsvp')
  async removeRsvp(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.removeRsvp(podId, eventId, user.userId);
  }

  // ==================== Offline Member RSVPs ====================

  @Post(':podId/events/:eventId/offline-rsvps/:offlineMemberId')
  async setOfflineRsvp(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @Param('offlineMemberId') offlineMemberId: string,
    @Body() body: { status: RsvpStatus; comment?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.offlineMembersService.setOfflineRsvp(
      eventId,
      offlineMemberId,
      user.userId,
      body.status,
      body.comment,
    );
  }

  @Delete(':podId/events/:eventId/offline-rsvps/:offlineMemberId')
  async removeOfflineRsvp(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @Param('offlineMemberId') offlineMemberId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.offlineMembersService.removeOfflineRsvp(
      eventId,
      offlineMemberId,
      user.userId,
    );
  }

  // ==================== Event Chat ====================

  @Get(':podId/events/:eventId/chat')
  async getChatMessages(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @Query('before') before: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.eventChatService.getMessages(podId, eventId, user.userId, {
      before,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post(':podId/events/:eventId/chat')
  async sendChatMessage(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @Body() body: { content: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.eventChatService.sendMessage(
      podId,
      eventId,
      user.userId,
      body.content,
    );
  }

  // ==================== Member Decks ====================

  @Get(':podId/members/:userId/decks')
  async getMemberDecks(
    @Param('podId') podId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsService.getMemberDecks(podId, user.userId, userId);
  }

  // ==================== Insights ====================

  @Get(':podId/insights/member-stats')
  async getMemberStats(
    @Param('podId') podId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.getMemberStats(podId, user.userId);
  }

  @Get(':podId/insights/deck-stats')
  async getDeckStats(
    @Param('podId') podId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.getDeckStats(podId, user.userId);
  }

  // ==================== Game Results ====================

  @Post(':podId/events/:eventId/game-results')
  async saveGameResult(
    @Param('podId') podId: string,
    @Param('eventId') eventId: string,
    @Body()
    body: {
      startedAt: string;
      endedAt: string;
      winnerUserId: string | null;
      players: Array<{
        userId: string | null;
        deckName: string | null;
        deckId: string | null;
        finalLife: number;
        finalPoison: number;
        finalCommanderTax: number;
        commanderDamage: { [playerId: number]: number };
        deathOrder: number | null;
        isWinner: boolean;
      }>;
    },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.podsEventsService.saveGameResult(
      podId,
      eventId,
      user.userId,
      body,
    );
  }
}
