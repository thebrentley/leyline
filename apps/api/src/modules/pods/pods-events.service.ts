import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull, Not } from 'typeorm';
import { PodEvent } from '../../entities/pod-event.entity';
import { EventRsvp, RsvpStatus } from '../../entities/event-rsvp.entity';
import { EventOfflineRsvp } from '../../entities/event-offline-rsvp.entity';
import { PodOfflineMember } from '../../entities/pod-offline-member.entity';
import { PodMember } from '../../entities/pod-member.entity';
import { PodGameResult } from '../../entities/pod-game-result.entity';
import { PodsService } from './pods.service';

@Injectable()
export class PodsEventsService {
  constructor(
    @InjectRepository(PodEvent) private eventRepo: Repository<PodEvent>,
    @InjectRepository(EventRsvp) private rsvpRepo: Repository<EventRsvp>,
    @InjectRepository(EventOfflineRsvp) private offlineRsvpRepo: Repository<EventOfflineRsvp>,
    @InjectRepository(PodOfflineMember) private offlineMemberRepo: Repository<PodOfflineMember>,
    @InjectRepository(PodMember) private memberRepo: Repository<PodMember>,
    @InjectRepository(PodGameResult) private gameResultRepo: Repository<PodGameResult>,
    private podsService: PodsService,
  ) {}

  async createEvent(
    podId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      location?: string;
      startsAt: string;
      endsAt?: string;
    },
  ) {
    await this.podsService.requireMembership(podId, userId);

    const event = this.eventRepo.create({
      podId,
      createdById: userId,
      name: data.name,
      description: data.description ?? null,
      location: data.location ?? null,
      startsAt: new Date(data.startsAt),
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
    });
    await this.eventRepo.save(event);

    return {
      id: event.id,
      name: event.name,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
    };
  }

  async getEvents(podId: string, userId: string, upcoming?: boolean) {
    await this.podsService.requireMembership(podId, userId);

    const where: Record<string, unknown> = { podId, status: Not('completed') };
    if (upcoming) {
      where.startsAt = MoreThan(new Date());
    }

    const events = await this.eventRepo.find({
      where,
      relations: ['createdBy', 'rsvps'],
      order: { startsAt: 'ASC' },
    });

    const [onlineCount, offlineCount] = await Promise.all([
      this.memberRepo.count({ where: { podId } }),
      this.offlineMemberRepo.count({ where: { podId, linkedUserId: IsNull() } }),
    ]);
    const totalMembers = onlineCount + offlineCount;

    const eventIds = events.map((e) => e.id);
    const offlineRsvps = eventIds.length
      ? await this.offlineRsvpRepo.find({ where: eventIds.map((id) => ({ eventId: id })) })
      : [];
    const offlineRsvpsByEvent = new Map<string, EventOfflineRsvp[]>();
    for (const r of offlineRsvps) {
      const list = offlineRsvpsByEvent.get(r.eventId) ?? [];
      list.push(r);
      offlineRsvpsByEvent.set(r.eventId, list);
    }

    return events.map((event) => {
      const accepted = event.rsvps.filter((r) => r.status === 'accepted').length;
      const declined = event.rsvps.filter((r) => r.status === 'declined').length;
      const myRsvp = event.rsvps.find((r) => r.userId === userId);

      const eventOfflineRsvps = offlineRsvpsByEvent.get(event.id) ?? [];
      const offlineAccepted = eventOfflineRsvps.filter((r) => r.status === 'accepted').length;
      const offlineDeclined = eventOfflineRsvps.filter((r) => r.status === 'declined').length;

      return {
        id: event.id,
        name: event.name,
        description: event.description,
        location: event.location,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
        status: event.status,
        createdBy: {
          displayName: event.createdBy?.displayName ?? null,
        },
        rsvpCounts: {
          accepted: accepted + offlineAccepted,
          declined: declined + offlineDeclined,
          pending: totalMembers - (accepted + offlineAccepted) - (declined + offlineDeclined),
        },
        myRsvp: (myRsvp?.status as RsvpStatus) ?? null,
        createdAt: event.createdAt.toISOString(),
      };
    });
  }

  async getEvent(podId: string, eventId: string, userId: string) {
    await this.podsService.requireMembership(podId, userId);

    const event = await this.eventRepo.findOne({
      where: { id: eventId, podId },
      relations: ['createdBy', 'rsvps', 'rsvps.user'],
    });
    if (!event) throw new NotFoundException('Event not found');

    const members = await this.memberRepo.find({
      where: { podId },
      relations: ['user'],
    });

    // Get offline members and their RSVPs
    const offlineMembers = await this.offlineMemberRepo.find({
      where: { podId, linkedUserId: IsNull() }, // Only show non-linked offline members
    });

    const offlineRsvps = await this.offlineRsvpRepo.find({
      where: { eventId },
      relations: ['offlineMember', 'setBy'],
    });

    const respondedUserIds = new Set(event.rsvps.map((r) => r.userId));
    const notResponded = members
      .filter((m) => !respondedUserIds.has(m.userId))
      .map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        email: m.user.email,
        profilePicture: m.user.profilePicture,
      }));

    const respondedOfflineIds = new Set(offlineRsvps.map((r) => r.offlineMemberId));
    const offlineNotResponded = offlineMembers
      .filter((om) => !respondedOfflineIds.has(om.id))
      .map((om) => ({
        offlineMemberId: om.id,
        name: om.name,
      }));

    return {
      id: event.id,
      name: event.name,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      status: event.status,
      createdBy: {
        id: event.createdById,
        displayName: event.createdBy?.displayName ?? null,
      },
      rsvps: event.rsvps.map((r) => ({
        userId: r.userId,
        displayName: r.user.displayName,
        email: r.user.email,
        profilePicture: r.user.profilePicture,
        status: r.status,
        comment: r.comment,
        updatedAt: r.updatedAt.toISOString(),
      })),
      offlineRsvps: offlineRsvps.map((r) => ({
        offlineMemberId: r.offlineMemberId,
        name: r.offlineMember.name,
        status: r.status,
        comment: r.comment,
        setBy: {
          id: r.setById,
          displayName: r.setBy.displayName,
        },
        updatedAt: r.updatedAt.toISOString(),
      })),
      notResponded,
      offlineNotResponded,
      createdAt: event.createdAt.toISOString(),
    };
  }

  async updateEvent(
    podId: string,
    eventId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      location?: string;
      startsAt?: string;
      endsAt?: string;
    },
  ) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId, podId },
    });
    if (!event) throw new NotFoundException('Event not found');

    // Must be event creator or pod admin
    if (event.createdById !== userId) {
      await this.podsService.requireAdmin(podId, userId);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
    if (data.endsAt !== undefined) updateData.endsAt = new Date(data.endsAt);

    await this.eventRepo.update(eventId, updateData);
    return { success: true };
  }

  async deleteEvent(podId: string, eventId: string, userId: string) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId, podId },
    });
    if (!event) throw new NotFoundException('Event not found');

    // Must be event creator or pod admin
    if (event.createdById !== userId) {
      await this.podsService.requireAdmin(podId, userId);
    }

    await this.eventRepo.remove(event);
    return { success: true };
  }

  async rsvp(
    podId: string,
    eventId: string,
    userId: string,
    status: RsvpStatus,
    comment?: string,
  ) {
    await this.podsService.requireMembership(podId, userId);

    const event = await this.eventRepo.findOne({
      where: { id: eventId, podId },
    });
    if (!event) throw new NotFoundException('Event not found');

    let rsvp = await this.rsvpRepo.findOne({
      where: { eventId, userId },
    });

    if (rsvp) {
      rsvp.status = status;
      rsvp.comment = comment ?? null;
    } else {
      rsvp = this.rsvpRepo.create({
        eventId,
        userId,
        status,
        comment: comment ?? null,
      });
    }

    await this.rsvpRepo.save(rsvp);
    return { success: true, status: rsvp.status, comment: rsvp.comment };
  }

  async removeRsvp(podId: string, eventId: string, userId: string) {
    await this.podsService.requireMembership(podId, userId);

    const rsvp = await this.rsvpRepo.findOne({
      where: { eventId, userId },
    });
    if (!rsvp) throw new NotFoundException('RSVP not found');

    await this.rsvpRepo.remove(rsvp);
    return { success: true };
  }

  async saveGameResult(
    podId: string,
    eventId: string,
    userId: string,
    data: {
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
  ) {
    await this.podsService.requireMembership(podId, userId);

    const event = await this.eventRepo.findOne({
      where: { id: eventId, podId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const result = this.gameResultRepo.create({
      podEventId: eventId,
      createdById: userId,
      startedAt: new Date(data.startedAt),
      endedAt: new Date(data.endedAt),
      winnerUserId: data.winnerUserId,
      players: data.players,
    });

    await this.gameResultRepo.save(result);
    return { success: true, id: result.id };
  }
}
