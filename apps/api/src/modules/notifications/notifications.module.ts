import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicePushToken } from '../../entities/device-push-token.entity';
import { PodMember } from '../../entities/pod-member.entity';
import { EventRsvp } from '../../entities/event-rsvp.entity';
import { PodEvent } from '../../entities/pod-event.entity';
import { NotificationsService } from './notifications.service';
import { EventReminderCronService } from './event-reminder-cron.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([DevicePushToken, PodMember, EventRsvp, PodEvent]),
  ],
  providers: [NotificationsService, EventReminderCronService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
