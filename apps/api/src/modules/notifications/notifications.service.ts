import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import Expo, { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { DevicePushToken } from "../../entities/device-push-token.entity";
import { PodMember } from "../../entities/pod-member.entity";
import { EventRsvp, RsvpStatus } from "../../entities/event-rsvp.entity";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private expo: Expo;

  constructor(
    @InjectRepository(DevicePushToken)
    private pushTokenRepo: Repository<DevicePushToken>,
    @InjectRepository(PodMember)
    private memberRepo: Repository<PodMember>,
    @InjectRepository(EventRsvp)
    private rsvpRepo: Repository<EventRsvp>,
  ) {
    this.expo = new Expo();
  }

  // ========== Token Management ==========

  async registerToken(
    userId: string,
    token: string,
    platform?: string,
  ): Promise<DevicePushToken> {
    if (!Expo.isExpoPushToken(token)) {
      throw new Error(`Invalid Expo push token: ${token}`);
    }

    const existing = await this.pushTokenRepo.findOne({
      where: { userId, token },
    });

    if (existing) {
      existing.platform = platform ?? existing.platform;
      return this.pushTokenRepo.save(existing);
    }

    const entity = this.pushTokenRepo.create({
      userId,
      token,
      platform: platform ?? null,
    });
    return this.pushTokenRepo.save(entity);
  }

  async unregisterToken(userId: string, token: string): Promise<boolean> {
    const result = await this.pushTokenRepo.delete({ userId, token });
    return (result.affected ?? 0) > 0;
  }

  async unregisterAllTokensForUser(userId: string): Promise<void> {
    await this.pushTokenRepo.delete({ userId });
  }

  // ========== Notification Sending ==========

  async notifyNewEvent(params: {
    podId: string;
    eventId: string;
    eventName: string;
    podName: string;
    creatorUserId: string;
  }): Promise<void> {
    const { podId, eventId, eventName, podName, creatorUserId } = params;

    const members = await this.memberRepo.find({ where: { podId } });
    const recipientUserIds = members
      .map((m) => m.userId)
      .filter((id) => id !== creatorUserId);

    if (recipientUserIds.length === 0) return;

    const tokens = await this.pushTokenRepo.find({
      where: { userId: In(recipientUserIds) },
    });

    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      sound: "default" as const,
      title: `You've been invited to an event for ${podName}`,
      body: eventName,
      data: { type: "event", podId, eventId },
    }));

    await this.sendPushNotifications(messages);
  }

  async notifyEventReminder(params: {
    podId: string;
    eventId: string;
    eventName: string;
    podName: string;
    startsAt: Date;
  }): Promise<void> {
    const { podId, eventId, eventName, podName, startsAt } = params;

    const acceptedRsvps = await this.rsvpRepo.find({
      where: { eventId, status: "accepted" },
    });

    const recipientUserIds = acceptedRsvps.map((r) => r.userId);
    if (recipientUserIds.length === 0) return;

    const tokens = await this.pushTokenRepo.find({
      where: { userId: In(recipientUserIds) },
    });

    if (tokens.length === 0) return;

    const timeStr = startsAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      sound: "default" as const,
      title: `Reminder: ${eventName}`,
      body: `Starting at ${timeStr} today in ${podName}`,
      data: { type: "event", podId, eventId },
    }));

    await this.sendPushNotifications(messages);
  }

  async notifyRsvpUpdate(params: {
    podId: string;
    eventId: string;
    eventName: string;
    podName: string;
    userId: string;
    status: RsvpStatus;
  }): Promise<void> {
    const { podId, eventId, eventName, podName, userId, status } = params;

    const member = await this.memberRepo.findOne({
      where: { podId, userId },
      relations: ["user"],
    });
    const userName = member?.user?.displayName ?? "Someone";

    const members = await this.memberRepo.find({ where: { podId } });
    const recipientUserIds = members
      .map((m) => m.userId)
      .filter((id) => id !== userId);

    if (recipientUserIds.length === 0) return;

    const tokens = await this.pushTokenRepo.find({
      where: { userId: In(recipientUserIds) },
    });

    if (tokens.length === 0) return;

    const title =
      status === "accepted"
        ? `${userName} is going to ${eventName}`
        : `${userName} can't make it to ${eventName}`;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      sound: "default" as const,
      title,
      body: podName,
      data: { type: "event", podId, eventId },
    }));

    await this.sendPushNotifications(messages);
  }

  async notifyChatMessage(params: {
    podId: string;
    eventId: string;
    eventName: string;
    podName: string;
    senderUserId: string;
    senderDisplayName: string;
    messageContent: string;
  }): Promise<void> {
    const {
      podId,
      eventId,
      eventName,
      podName,
      senderUserId,
      senderDisplayName,
      messageContent,
    } = params;

    const members = await this.memberRepo.find({ where: { podId } });
    const recipientUserIds = members
      .map((m) => m.userId)
      .filter((id) => id !== senderUserId);

    if (recipientUserIds.length === 0) return;

    const tokens = await this.pushTokenRepo.find({
      where: { userId: In(recipientUserIds) },
    });

    if (tokens.length === 0) return;

    const body =
      messageContent.length > 100
        ? messageContent.slice(0, 100) + '…'
        : messageContent;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title: `${senderDisplayName} in ${eventName}`,
      body,
      data: { type: 'event', podId, eventId },
    }));

    await this.sendPushNotifications(messages);
  }

  // ========== Internal ==========

  private async sendPushNotifications(
    messages: ExpoPushMessage[],
  ): Promise<void> {
    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] =
          await this.expo.sendPushNotificationsAsync(chunk);

        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === "error") {
            this.logger.warn(
              `Push notification error: ${ticket.message} (${ticket.details?.error})`,
            );
            if (ticket.details?.error === "DeviceNotRegistered") {
              const failedToken = (chunk[i] as any).to as string;
              await this.pushTokenRepo.delete({ token: failedToken });
              this.logger.log(`Removed invalid push token: ${failedToken}`);
            }
          }
        }
      } catch (error) {
        this.logger.error("Failed to send push notification chunk:", error);
      }
    }
  }
}
