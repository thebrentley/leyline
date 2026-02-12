import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, Not } from 'typeorm';
import { PodEvent } from '../../entities/pod-event.entity';

@Injectable()
export class PodsEventsCronService {
  private readonly logger = new Logger(PodsEventsCronService.name);

  constructor(
    @InjectRepository(PodEvent) private eventRepo: Repository<PodEvent>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async markPastEventsAsCompleted() {
    const now = new Date();

    // Events with an end time that has passed
    const withEndTime = await this.eventRepo
      .createQueryBuilder()
      .update(PodEvent)
      .set({ status: 'completed' })
      .where('status = :status', { status: 'upcoming' })
      .andWhere('ends_at IS NOT NULL')
      .andWhere('ends_at < :now', { now })
      .execute();

    // Events without an end time where the start time has passed
    const withoutEndTime = await this.eventRepo
      .createQueryBuilder()
      .update(PodEvent)
      .set({ status: 'completed' })
      .where('status = :status', { status: 'upcoming' })
      .andWhere('ends_at IS NULL')
      .andWhere('starts_at < :now', { now })
      .execute();

    const total = (withEndTime.affected ?? 0) + (withoutEndTime.affected ?? 0);
    if (total > 0) {
      this.logger.log(`Marked ${total} past events as completed`);
    }
  }
}
