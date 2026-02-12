import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PodOfflineMember } from '../../entities/pod-offline-member.entity';
import { EventOfflineRsvp } from '../../entities/event-offline-rsvp.entity';
import { PodMember } from '../../entities/pod-member.entity';
import { PodEvent } from '../../entities/pod-event.entity';
import { RsvpStatus } from '../../entities/event-rsvp.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class PodsOfflineMembersService {
  constructor(
    @InjectRepository(PodOfflineMember)
    private offlineMemberRepo: Repository<PodOfflineMember>,
    @InjectRepository(EventOfflineRsvp)
    private offlineRsvpRepo: Repository<EventOfflineRsvp>,
    @InjectRepository(PodMember)
    private memberRepo: Repository<PodMember>,
    @InjectRepository(PodEvent)
    private eventRepo: Repository<PodEvent>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // ==================== Helpers ====================

  async requireAdmin(podId: string, userId: string): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { podId, userId },
    });
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
      throw new ForbiddenException('Admin access required');
    }
  }

  // ==================== Offline Member Management ====================

  async addOfflineMember(
    podId: string,
    userId: string,
    data: {
      name: string;
      email?: string;
      notes?: string;
    },
  ) {
    await this.requireAdmin(podId, userId);

    // Normalize email to lowercase for consistent matching
    const normalizedEmail = data.email?.toLowerCase().trim() || null;

    const offlineMember = this.offlineMemberRepo.create({
      podId,
      name: data.name.trim(),
      email: normalizedEmail,
      notes: data.notes?.trim() || null,
      addedById: userId,
    });

    await this.offlineMemberRepo.save(offlineMember);

    return {
      id: offlineMember.id,
      name: offlineMember.name,
      email: offlineMember.email,
      notes: offlineMember.notes,
      linkedUserId: null,
      linkedAt: null,
      createdAt: offlineMember.createdAt.toISOString(),
    };
  }

  async getOfflineMembers(podId: string, userId: string) {
    // Verify user is a member of the pod
    const member = await this.memberRepo.findOne({
      where: { podId, userId },
    });
    if (!member) {
      throw new NotFoundException('Pod not found');
    }

    const offlineMembers = await this.offlineMemberRepo.find({
      where: { podId },
      relations: ['linkedUser'],
      order: { createdAt: 'ASC' },
    });

    return offlineMembers.map((om) => ({
      id: om.id,
      name: om.name,
      email: om.email,
      notes: om.notes,
      linkedUserId: om.linkedUserId,
      linkedUser: om.linkedUser
        ? {
            id: om.linkedUser.id,
            email: om.linkedUser.email,
            displayName: om.linkedUser.displayName,
          }
        : null,
      linkedAt: om.linkedAt?.toISOString() || null,
      createdAt: om.createdAt.toISOString(),
    }));
  }

  async updateOfflineMember(
    podId: string,
    offlineMemberId: string,
    userId: string,
    data: {
      name?: string;
      email?: string;
      notes?: string;
    },
  ) {
    await this.requireAdmin(podId, userId);

    const offlineMember = await this.offlineMemberRepo.findOne({
      where: { id: offlineMemberId, podId },
    });

    if (!offlineMember) {
      throw new NotFoundException('Offline member not found');
    }

    if (data.name !== undefined) {
      offlineMember.name = data.name.trim();
    }
    if (data.email !== undefined) {
      offlineMember.email = data.email?.toLowerCase().trim() || null;
    }
    if (data.notes !== undefined) {
      offlineMember.notes = data.notes?.trim() || null;
    }

    await this.offlineMemberRepo.save(offlineMember);

    return {
      id: offlineMember.id,
      name: offlineMember.name,
      email: offlineMember.email,
      notes: offlineMember.notes,
      linkedUserId: offlineMember.linkedUserId,
      linkedAt: offlineMember.linkedAt?.toISOString() || null,
      createdAt: offlineMember.createdAt.toISOString(),
    };
  }

  async removeOfflineMember(
    podId: string,
    offlineMemberId: string,
    userId: string,
  ) {
    await this.requireAdmin(podId, userId);

    const offlineMember = await this.offlineMemberRepo.findOne({
      where: { id: offlineMemberId, podId },
    });

    if (!offlineMember) {
      throw new NotFoundException('Offline member not found');
    }

    await this.offlineMemberRepo.remove(offlineMember);

    return { success: true };
  }

  async linkOfflineMember(
    podId: string,
    offlineMemberId: string,
    targetUserId: string,
    adminUserId: string,
  ) {
    await this.requireAdmin(podId, adminUserId);

    const offlineMember = await this.offlineMemberRepo.findOne({
      where: { id: offlineMemberId, podId },
    });

    if (!offlineMember) {
      throw new NotFoundException('Offline member not found');
    }

    if (offlineMember.linkedUserId) {
      throw new BadRequestException('Offline member already linked');
    }

    // Verify target user exists
    const targetUser = await this.userRepo.findOne({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Verify target user is a member of the pod
    const targetMember = await this.memberRepo.findOne({
      where: { podId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new BadRequestException('Target user is not a member of this pod');
    }

    offlineMember.linkedUserId = targetUserId;
    offlineMember.linkedAt = new Date();
    await this.offlineMemberRepo.save(offlineMember);

    return {
      id: offlineMember.id,
      linkedUserId: offlineMember.linkedUserId,
      linkedAt: offlineMember.linkedAt.toISOString(),
    };
  }

  // ==================== Offline RSVP Management ====================

  async setOfflineRsvp(
    eventId: string,
    offlineMemberId: string,
    userId: string,
    status: RsvpStatus,
    comment?: string,
  ) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['pod'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    await this.requireAdmin(event.podId, userId);

    const offlineMember = await this.offlineMemberRepo.findOne({
      where: { id: offlineMemberId, podId: event.podId },
    });

    if (!offlineMember) {
      throw new NotFoundException('Offline member not found');
    }

    let rsvp = await this.offlineRsvpRepo.findOne({
      where: { eventId, offlineMemberId },
    });

    if (rsvp) {
      rsvp.status = status;
      rsvp.comment = comment?.trim() || null;
      rsvp.setById = userId;
    } else {
      rsvp = this.offlineRsvpRepo.create({
        eventId,
        offlineMemberId,
        status,
        comment: comment?.trim() || null,
        setById: userId,
      });
    }

    await this.offlineRsvpRepo.save(rsvp);

    return {
      id: rsvp.id,
      eventId: rsvp.eventId,
      offlineMemberId: rsvp.offlineMemberId,
      status: rsvp.status,
      comment: rsvp.comment,
      createdAt: rsvp.createdAt.toISOString(),
      updatedAt: rsvp.updatedAt.toISOString(),
    };
  }

  async removeOfflineRsvp(
    eventId: string,
    offlineMemberId: string,
    userId: string,
  ) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['pod'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    await this.requireAdmin(event.podId, userId);

    const rsvp = await this.offlineRsvpRepo.findOne({
      where: { eventId, offlineMemberId },
    });

    if (!rsvp) {
      throw new NotFoundException('RSVP not found');
    }

    await this.offlineRsvpRepo.remove(rsvp);

    return { success: true };
  }

  // ==================== Auto-Linking ====================

  async autoLinkOnJoin(podId: string, userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.email) {
      return;
    }

    const normalizedEmail = user.email.toLowerCase().trim();

    // Find offline member with matching email (not already linked)
    const offlineMember = await this.offlineMemberRepo.findOne({
      where: {
        podId,
        email: normalizedEmail,
        linkedUserId: IsNull(),
      },
    });

    if (offlineMember) {
      offlineMember.linkedUserId = userId;
      offlineMember.linkedAt = new Date();
      await this.offlineMemberRepo.save(offlineMember);
    }
  }
}
