import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PodEvent } from '../../entities/pod-event.entity';
import { NotificationsService } from './notifications.service';

@Injectable()
export class EventReminderCronService {
  private readonly logger = new Logger(EventReminderCronService.name);

  constructor(
    @InjectRepository(PodEvent)
    private eventRepo: Repository<PodEvent>,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('0 */15 * * * *')
  async sendEventReminders() {
    const now = new Date();
    const fiveHoursFromNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    const events = await this.eventRepo.find({
      where: {
        status: 'upcoming',
        reminderSent: false,
        startsAt: Between(now, fiveHoursFromNow),
      },
      relations: ['pod'],
    });

    if (events.length === 0) return;

    this.logger.log(`Sending reminders for ${events.length} upcoming events`);

    for (const event of events) {
      try {
        await this.notificationsService.notifyEventReminder({
          podId: event.podId,
          eventId: event.id,
          eventName: event.name,
          podName: event.pod.name,
          startsAt: event.startsAt,
        });

        await this.eventRepo.update(event.id, { reminderSent: true });

        this.logger.log(
          `Sent reminder for event "${event.name}" (${event.id})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send reminder for event ${event.id}:`,
          error,
        );
      }
    }
  }
}
