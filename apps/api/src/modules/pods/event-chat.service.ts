import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EventChatMessage } from '../../entities/event-chat-message.entity';
import { PodEvent } from '../../entities/pod-event.entity';
import { PodsService } from './pods.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventChatService {
  constructor(
    @InjectRepository(EventChatMessage)
    private chatMessageRepo: Repository<EventChatMessage>,
    @InjectRepository(PodEvent)
    private eventRepo: Repository<PodEvent>,
    private podsService: PodsService,
    private eventsGateway: EventsGateway,
    private notificationsService: NotificationsService,
  ) {}

  async sendMessage(
    podId: string,
    eventId: string,
    userId: string,
    content: string,
  ) {
    await this.podsService.requireMembership(podId, userId);

    const event = await this.eventRepo.findOne({
      where: { id: eventId, podId },
      relations: ['pod'],
    });
    if (!event) throw new NotFoundException('Event not found');

    const message = this.chatMessageRepo.create({
      eventId,
      userId,
      content: content.trim(),
    });
    const saved = await this.chatMessageRepo.save(message);

    const full = await this.chatMessageRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    const payload = {
      id: full!.id,
      eventId: full!.eventId,
      userId: full!.userId,
      displayName: full!.user.displayName,
      profilePicture: full!.user.profilePicture,
      content: full!.content,
      isSystem: false,
      createdAt: full!.createdAt.toISOString(),
    };

    this.eventsGateway.emitToEventRoom(eventId, 'event:chat:message', payload);

    this.notificationsService
      .notifyChatMessage({
        podId,
        eventId,
        eventName: event.name,
        podName: event.pod.name,
        senderUserId: userId,
        senderDisplayName: full!.user.displayName ?? 'Unknown',
        messageContent: content.trim(),
      })
      .catch((err) =>
        console.error('Failed to send chat notification:', err),
      );

    return payload;
  }

  async sendSystemMessage(eventId: string, userId: string, content: string) {
    const message = this.chatMessageRepo.create({
      eventId,
      userId,
      content,
      isSystem: true,
    });
    const saved = await this.chatMessageRepo.save(message);

    const full = await this.chatMessageRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    const payload = {
      id: full!.id,
      eventId: full!.eventId,
      userId: full!.userId,
      displayName: full!.user.displayName,
      profilePicture: full!.user.profilePicture,
      content: full!.content,
      isSystem: true,
      createdAt: full!.createdAt.toISOString(),
    };

    this.eventsGateway.emitToEventRoom(eventId, 'event:chat:message', payload);

    return payload;
  }

  async getMessages(
    podId: string,
    eventId: string,
    userId: string,
    options?: { before?: string; limit?: number },
  ) {
    await this.podsService.requireMembership(podId, userId);

    const limit = Math.min(options?.limit ?? 50, 100);

    const where: any = { eventId };
    if (options?.before) {
      where.createdAt = LessThan(new Date(options.before));
    }

    const messages = await this.chatMessageRepo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    // Reverse to return oldest-first for display
    messages.reverse();

    return {
      messages: messages.map((m) => ({
        id: m.id,
        eventId: m.eventId,
        userId: m.userId,
        displayName: m.user.displayName,
        profilePicture: m.user.profilePicture,
        content: m.content,
        isSystem: m.isSystem,
        createdAt: m.createdAt.toISOString(),
      })),
      hasMore,
    };
  }
}
