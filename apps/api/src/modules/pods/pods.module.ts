import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pod } from '../../entities/pod.entity';
import { PodMember } from '../../entities/pod-member.entity';
import { PodInvite } from '../../entities/pod-invite.entity';
import { PodEvent } from '../../entities/pod-event.entity';
import { EventRsvp } from '../../entities/event-rsvp.entity';
import { PodOfflineMember } from '../../entities/pod-offline-member.entity';
import { EventOfflineRsvp } from '../../entities/event-offline-rsvp.entity';
import { PodGameResult } from '../../entities/pod-game-result.entity';
import { EventChatMessage } from '../../entities/event-chat-message.entity';
import { User } from '../../entities/user.entity';
import { Deck } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { PodsController } from './pods.controller';
import { PodsService } from './pods.service';
import { PodsEventsService } from './pods-events.service';
import { PodsOfflineMembersService } from './pods-offline-members.service';
import { PodsEventsCronService } from './pods-events-cron.service';
import { EventChatService } from './event-chat.service';
import { DecksModule } from '../decks/decks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pod,
      PodMember,
      PodInvite,
      PodEvent,
      EventRsvp,
      PodOfflineMember,
      EventOfflineRsvp,
      PodGameResult,
      EventChatMessage,
      User,
      Deck,
      DeckCard,
    ]),
    DecksModule,
  ],
  controllers: [PodsController],
  providers: [PodsService, PodsEventsService, PodsOfflineMembersService, PodsEventsCronService, EventChatService],
  exports: [PodsService],
})
export class PodsModule {}
