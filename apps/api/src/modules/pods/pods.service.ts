import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, IsNull, Not, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { Pod } from '../../entities/pod.entity';
import { PodMember, PodRole } from '../../entities/pod-member.entity';
import { PodInvite } from '../../entities/pod-invite.entity';
import { User } from '../../entities/user.entity';
import { Deck } from '../../entities/deck.entity';
import { DeckCard } from '../../entities/deck-card.entity';
import { PodOfflineMember } from '../../entities/pod-offline-member.entity';
import { EventOfflineRsvp } from '../../entities/event-offline-rsvp.entity';
import { EventRsvp } from '../../entities/event-rsvp.entity';
import { PodGameResult } from '../../entities/pod-game-result.entity';
import { ConfigService } from '@nestjs/config';
import { DecksService } from '../decks/decks.service';
import { EmailService } from '../email/email.service';
import { podInviteEmailHtml } from '../email/templates/pod-invite.template';

@Injectable()
export class PodsService {
  constructor(
    @InjectRepository(Pod) private podRepo: Repository<Pod>,
    @InjectRepository(PodMember) private memberRepo: Repository<PodMember>,
    @InjectRepository(PodInvite) private inviteRepo: Repository<PodInvite>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Deck) private deckRepo: Repository<Deck>,
    @InjectRepository(DeckCard) private deckCardRepo: Repository<DeckCard>,
    @InjectRepository(PodOfflineMember) private offlineMemberRepo: Repository<PodOfflineMember>,
    @InjectRepository(EventOfflineRsvp) private offlineRsvpRepo: Repository<EventOfflineRsvp>,
    @InjectRepository(EventRsvp) private rsvpRepo: Repository<EventRsvp>,
    @InjectRepository(PodGameResult) private gameResultRepo: Repository<PodGameResult>,
    private decksService: DecksService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  // ==================== Helpers ====================

  private generateInviteCode(): string {
    return randomBytes(6).toString('base64url').slice(0, 8);
  }

  async requireMembership(podId: string, userId: string): Promise<PodMember> {
    const member = await this.memberRepo.findOne({
      where: { podId, userId },
    });
    if (!member) {
      throw new NotFoundException('Pod not found');
    }
    return member;
  }

  async requireAdmin(podId: string, userId: string): Promise<PodMember> {
    const member = await this.requireMembership(podId, userId);
    if (member.role !== 'admin' && member.role !== 'owner') {
      throw new ForbiddenException('Admin access required');
    }
    return member;
  }

  async requireOwner(podId: string, userId: string): Promise<PodMember> {
    const member = await this.requireMembership(podId, userId);
    if (member.role !== 'owner') {
      throw new ForbiddenException('Owner access required');
    }
    return member;
  }

  // ==================== Pod CRUD ====================

  async createPod(
    name: string,
    description: string | null,
    userId: string,
  ) {
    const pod = this.podRepo.create({
      name,
      description,
      createdById: userId,
      inviteCode: this.generateInviteCode(),
    });
    await this.podRepo.save(pod);

    // Auto-join creator as owner
    const member = this.memberRepo.create({
      podId: pod.id,
      userId,
      role: 'owner' as PodRole,
    });
    await this.memberRepo.save(member);

    return {
      id: pod.id,
      name: pod.name,
      description: pod.description,
      coverImage: pod.coverImage,
      inviteCode: pod.inviteCode,
      memberCount: 1,
      role: 'owner' as PodRole,
      nextEventAt: null,
      createdAt: pod.createdAt.toISOString(),
    };
  }

  async getUserPods(userId: string) {
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['pod'],
    });

    const results = await Promise.all(
      memberships.map(async (m) => {
        const [onlineCount, offlineCount] = await Promise.all([
          this.memberRepo.count({ where: { podId: m.podId } }),
          this.offlineMemberRepo.count({
            where: { podId: m.podId, linkedUserId: IsNull() },
          }),
        ]);
        const memberCount = onlineCount + offlineCount;

        // Get next upcoming event
        const nextEvent = await this.podRepo.manager
          .createQueryBuilder('pod_events', 'e')
          .where('e.pod_id = :podId', { podId: m.podId })
          .andWhere('e.starts_at > NOW()')
          .orderBy('e.starts_at', 'ASC')
          .limit(1)
          .getRawOne();

        return {
          id: m.pod.id,
          name: m.pod.name,
          description: m.pod.description,
          coverImage: m.pod.coverImage,
          memberCount,
          role: m.role,
          nextEventAt: nextEvent?.e_starts_at?.toISOString() ?? null,
          createdAt: m.pod.createdAt.toISOString(),
        };
      }),
    );

    return results;
  }

  async getPod(podId: string, userId: string) {
    const membership = await this.requireMembership(podId, userId);

    const pod = await this.podRepo.findOne({
      where: { id: podId },
    });
    if (!pod) throw new NotFoundException('Pod not found');

    const members = await this.memberRepo.find({
      where: { podId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });

    // Include pending invites for admins
    let pendingInvites: Array<{
      id: string;
      inviteId: string;
      displayName: string | null;
      email: string;
      isEmailInvite: boolean;
      invitedAt: string;
    }> = [];
    if (membership.role === 'admin' || membership.role === 'owner') {
      const invites = await this.inviteRepo.find({
        where: { podId, status: 'pending' },
        relations: ['invitee'],
        order: { createdAt: 'DESC' },
      });
      pendingInvites = invites.map((inv) => ({
        id: inv.inviteeId ?? inv.id,
        inviteId: inv.id,
        displayName: inv.invitee?.displayName ?? null,
        email: inv.invitee?.email ?? inv.inviteeEmail ?? '',
        isEmailInvite: !!inv.inviteeEmail,
        invitedAt: inv.createdAt.toISOString(),
      }));
    }

    return {
      id: pod.id,
      name: pod.name,
      description: pod.description,
      coverImage: pod.coverImage,
      inviteCode: membership.role === 'admin' || membership.role === 'owner' ? pod.inviteCode : null,
      memberCount: members.length + await this.offlineMemberRepo.count({
        where: { podId, linkedUserId: IsNull() },
      }),
      role: membership.role,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        displayName: m.user.displayName,
        email: m.user.email,
        profilePicture: m.user.profilePicture,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      pendingInvites,
      createdAt: pod.createdAt.toISOString(),
    };
  }

  async updatePod(
    podId: string,
    userId: string,
    data: { name?: string; description?: string; coverImage?: string },
  ) {
    await this.requireAdmin(podId, userId);
    await this.podRepo.update(podId, data);
    return { success: true };
  }

  async deletePod(podId: string, userId: string) {
    await this.requireOwner(podId, userId);
    await this.podRepo.delete(podId);
    return { success: true };
  }

  // ==================== Invite Code ====================

  async joinByCode(inviteCode: string, userId: string) {
    const pod = await this.podRepo.findOne({
      where: { inviteCode },
    });
    if (!pod) throw new NotFoundException('Invalid invite code');

    const existing = await this.memberRepo.findOne({
      where: { podId: pod.id, userId },
    });
    if (existing) throw new ConflictException('Already a member of this pod');

    const member = this.memberRepo.create({
      podId: pod.id,
      userId,
      role: 'member' as PodRole,
    });
    await this.memberRepo.save(member);

    // Merge offline member if email matches (converts RSVPs, deletes offline record)
    await this.mergeOfflineMember(pod.id, userId);

    return {
      podId: pod.id,
      podName: pod.name,
      role: 'member' as PodRole,
    };
  }

  private async mergeOfflineMember(podId: string, userId: string): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user || !user.email) {
        return;
      }

      const normalizedEmail = user.email.toLowerCase().trim();

      const offlineMember = await this.offlineMemberRepo.findOne({
        where: {
          podId,
          email: normalizedEmail,
          linkedUserId: IsNull(),
        },
      });

      if (!offlineMember) return;

      // Backfill game results: attribute offline member's games to the real user
      await this.backfillGameResults(offlineMember.id, userId);

      // Convert offline RSVPs to regular RSVPs
      const offlineRsvps = await this.offlineRsvpRepo.find({
        where: { offlineMemberId: offlineMember.id },
      });

      for (const offlineRsvp of offlineRsvps) {
        const existingRsvp = await this.rsvpRepo.findOne({
          where: { eventId: offlineRsvp.eventId, userId },
        });

        if (!existingRsvp) {
          const rsvp = this.rsvpRepo.create({
            eventId: offlineRsvp.eventId,
            userId,
            status: offlineRsvp.status,
            comment: offlineRsvp.comment,
          });
          await this.rsvpRepo.save(rsvp);
        }
      }

      // Delete the offline member (cascades to offline RSVPs)
      await this.offlineMemberRepo.remove(offlineMember);
    } catch (error) {
      // Don't fail pod join if merge fails
      console.error('Error merging offline member:', error);
    }
  }

  private async backfillGameResults(
    offlineMemberId: string,
    linkedUserId: string,
  ): Promise<void> {
    // Update players JSONB: set userId on entries matching this offlineMemberId
    await this.gameResultRepo.query(
      `UPDATE pod_game_results
       SET players = (
         SELECT jsonb_agg(
           CASE
             WHEN elem->>'offlineMemberId' = $1
             THEN jsonb_set(elem, '{userId}', to_jsonb($2::text))
             ELSE elem
           END
         )
         FROM jsonb_array_elements(players) AS elem
       )
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(players) AS elem
         WHERE elem->>'offlineMemberId' = $1
       )`,
      [offlineMemberId, linkedUserId],
    );

    // Update winnerUserId for games where this offline member won
    await this.gameResultRepo.query(
      `UPDATE pod_game_results
       SET winner_user_id = $2
       WHERE winner_offline_member_id = $1::uuid
         AND winner_user_id IS NULL`,
      [offlineMemberId, linkedUserId],
    );
  }

  async regenerateInviteCode(podId: string, userId: string) {
    await this.requireAdmin(podId, userId);
    const newCode = this.generateInviteCode();
    await this.podRepo.update(podId, { inviteCode: newCode });
    return { inviteCode: newCode };
  }

  // ==================== Direct Invites ====================

  async inviteUser(podId: string, inviterId: string, inviteeId: string) {
    await this.requireAdmin(podId, inviterId);

    // Check invitee exists
    const invitee = await this.userRepo.findOne({ where: { id: inviteeId } });
    if (!invitee) throw new NotFoundException('User not found');

    // Check not already a member
    const existingMember = await this.memberRepo.findOne({
      where: { podId, userId: inviteeId },
    });
    if (existingMember) throw new ConflictException('User is already a member');

    // Check no pending invite
    const existingInvite = await this.inviteRepo.findOne({
      where: { podId, inviteeId, status: 'pending' },
    });
    if (existingInvite) throw new ConflictException('Invite already sent');

    const invite = this.inviteRepo.create({
      podId,
      inviterId,
      inviteeId,
    });
    await this.inviteRepo.save(invite);

    return {
      id: invite.id,
      podId: invite.podId,
      inviteeId: invite.inviteeId,
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
    };
  }

  async getUserInvites(userId: string) {
    const invites = await this.inviteRepo.find({
      where: { inviteeId: userId, status: 'pending' },
      relations: ['pod', 'inviter'],
      order: { createdAt: 'DESC' },
    });

    const results = await Promise.all(
      invites.map(async (inv) => {
        const [onlineCount, offlineCount] = await Promise.all([
          this.memberRepo.count({ where: { podId: inv.podId } }),
          this.offlineMemberRepo.count({
            where: { podId: inv.podId, linkedUserId: IsNull() },
          }),
        ]);
        const memberCount = onlineCount + offlineCount;
        return {
          id: inv.id,
          pod: {
            id: inv.pod.id,
            name: inv.pod.name,
            description: inv.pod.description,
            memberCount,
          },
          inviter: {
            displayName: inv.inviter.displayName,
            email: inv.inviter.email,
          },
          createdAt: inv.createdAt.toISOString(),
        };
      }),
    );

    return results;
  }

  async respondToInvite(inviteId: string, userId: string, accept: boolean) {
    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId, inviteeId: userId, status: 'pending' },
    });
    if (!invite) throw new NotFoundException('Invite not found');

    if (accept) {
      // Check not already a member (could have joined via code in the meantime)
      const existing = await this.memberRepo.findOne({
        where: { podId: invite.podId, userId },
      });
      if (!existing) {
        const member = this.memberRepo.create({
          podId: invite.podId,
          userId,
          role: 'member' as PodRole,
        });
        await this.memberRepo.save(member);
      }

      // Merge offline member if email matches
      await this.mergeOfflineMember(invite.podId, userId);

      invite.status = 'accepted';
    } else {
      invite.status = 'declined';
    }

    await this.inviteRepo.save(invite);
    return { success: true };
  }

  // ==================== Email Invites ====================

  private generateInviteToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async inviteByEmail(podId: string, inviterId: string, email: string) {
    await this.requireAdmin(podId, inviterId);

    const pod = await this.podRepo.findOne({ where: { id: podId } });
    if (!pod) throw new NotFoundException('Pod not found');

    const inviter = await this.userRepo.findOne({ where: { id: inviterId } });
    if (!inviter) throw new NotFoundException('Inviter not found');

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email belongs to an existing user
    const existingUser = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Check not already a member
      const existingMember = await this.memberRepo.findOne({
        where: { podId, userId: existingUser.id },
      });
      if (existingMember) throw new ConflictException('User is already a member');
    }

    // Check no pending invite for this email/user
    const existingInvite = await this.inviteRepo.findOne({
      where: existingUser
        ? { podId, inviteeId: existingUser.id, status: 'pending' }
        : { podId, inviteeEmail: normalizedEmail, status: 'pending' },
    });
    if (existingInvite) throw new ConflictException('Invite already sent');

    const inviteToken = this.generateInviteToken();
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = this.inviteRepo.create({
      podId,
      inviterId,
      inviteeId: existingUser?.id ?? null,
      inviteeEmail: normalizedEmail,
      inviteToken,
      tokenExpiresAt,
    });
    await this.inviteRepo.save(invite);

    // Send email
    const appUrl = this.configService.get('APP_URL', 'https://app.mtgleyline.com');
    const acceptUrl = `${appUrl}/invite/${inviteToken}`;
    const html = podInviteEmailHtml({
      podName: pod.name,
      inviterName: inviter.displayName || inviter.email,
      acceptUrl,
    });
    await this.emailService.sendEmail(
      normalizedEmail,
      `You're invited to ${pod.name} on Leyline`,
      html,
    );

    return {
      id: invite.id,
      podId: invite.podId,
      inviteeEmail: invite.inviteeEmail,
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
    };
  }

  async getInviteByToken(token: string) {
    const invite = await this.inviteRepo.findOne({
      where: { inviteToken: token },
      relations: ['pod', 'inviter'],
    });
    if (!invite) throw new NotFoundException('Invite not found');

    const expired = invite.tokenExpiresAt && invite.tokenExpiresAt < new Date();

    return {
      inviteId: invite.id,
      podName: invite.pod.name,
      podDescription: invite.pod.description,
      inviterName: invite.inviter.displayName || invite.inviter.email,
      status: invite.status,
      expired: !!expired,
    };
  }

  async acceptInviteByToken(token: string, userId: string) {
    const invite = await this.inviteRepo.findOne({
      where: { inviteToken: token, status: 'pending' },
    });
    if (!invite) throw new NotFoundException('Invite not found or already used');

    if (invite.tokenExpiresAt && invite.tokenExpiresAt < new Date()) {
      throw new BadRequestException('Invite has expired');
    }

    // Check not already a member
    const existing = await this.memberRepo.findOne({
      where: { podId: invite.podId, userId },
    });
    if (!existing) {
      const member = this.memberRepo.create({
        podId: invite.podId,
        userId,
        role: 'member' as PodRole,
      });
      await this.memberRepo.save(member);
    }

    // Merge offline member if email matches
    await this.mergeOfflineMember(invite.podId, userId);

    // Update invite
    invite.status = 'accepted';
    invite.inviteeId = userId;
    await this.inviteRepo.save(invite);

    return { success: true, podId: invite.podId };
  }

  async rescindInvite(podId: string, inviteId: string, userId: string) {
    await this.requireAdmin(podId, userId);

    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId, podId, status: 'pending' },
    });
    if (!invite) throw new NotFoundException('Invite not found');

    await this.inviteRepo.remove(invite);
    return { success: true };
  }

  async resendInviteEmail(podId: string, inviteId: string, userId: string) {
    await this.requireAdmin(podId, userId);

    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId, podId, status: 'pending' },
      relations: ['pod', 'inviter'],
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (!invite.inviteeEmail) throw new BadRequestException('Invite has no email');

    // Regenerate token
    invite.inviteToken = this.generateInviteToken();
    invite.tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.inviteRepo.save(invite);

    const appUrl = this.configService.get('APP_URL', 'https://app.mtgleyline.com');
    const acceptUrl = `${appUrl}/invite/${invite.inviteToken}`;
    const html = podInviteEmailHtml({
      podName: invite.pod.name,
      inviterName: invite.inviter.displayName || invite.inviter.email,
      acceptUrl,
    });
    await this.emailService.sendEmail(
      invite.inviteeEmail,
      `You're invited to ${invite.pod.name} on Leyline`,
      html,
    );

    return { success: true };
  }

  // ==================== Member Management ====================

  async removeMember(podId: string, adminUserId: string, targetUserId: string) {
    await this.requireAdmin(podId, adminUserId);

    if (adminUserId === targetUserId) {
      throw new BadRequestException('Cannot remove yourself. Use leave instead.');
    }

    const target = await this.memberRepo.findOne({
      where: { podId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Member not found');

    if (target.role === 'owner') {
      throw new BadRequestException('Cannot remove the pod owner.');
    }

    await this.memberRepo.remove(target);
    return { success: true };
  }

  async promoteMember(podId: string, adminUserId: string, targetUserId: string) {
    await this.requireAdmin(podId, adminUserId);

    const target = await this.memberRepo.findOne({
      where: { podId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Member not found');

    if (target.role === 'admin') {
      throw new ConflictException('User is already an admin');
    }

    if (target.role === 'owner') {
      throw new ConflictException('Cannot promote the owner');
    }

    target.role = 'admin';
    await this.memberRepo.save(target);
    return { success: true };
  }

  async demoteMember(podId: string, adminUserId: string, targetUserId: string) {
    await this.requireAdmin(podId, adminUserId);

    const target = await this.memberRepo.findOne({
      where: { podId, userId: targetUserId },
    });
    if (!target) throw new NotFoundException('Member not found');

    if (target.role === 'member') {
      throw new ConflictException('User is already a member');
    }

    if (target.role === 'owner') {
      throw new ConflictException('Cannot demote the owner');
    }

    target.role = 'member';
    await this.memberRepo.save(target);
    return { success: true };
  }

  async leavePod(podId: string, userId: string) {
    const member = await this.requireMembership(podId, userId);

    if (member.role === 'owner') {
      throw new BadRequestException(
        'Cannot leave as the pod owner. Delete the pod or transfer ownership first.',
      );
    }

    if (member.role === 'admin') {
      const adminCount = await this.memberRepo.count({
        where: { podId, role: 'admin' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot leave as the sole admin. Promote another member first.',
        );
      }
    }

    await this.memberRepo.remove(member);
    return { success: true };
  }

  // ==================== User Search & Profile ====================

  async searchUsers(query: string, currentUserId: string, podId?: string) {
    if (!query || query.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }

    // Collect user IDs to exclude: current user + existing pod members
    const excludeIds = [currentUserId];

    if (podId) {
      const members = await this.memberRepo.find({
        where: { podId },
        select: ['userId'],
      });
      excludeIds.push(...members.map((m) => m.userId));
    }

    const users = await this.userRepo.find({
      where: [
        { displayName: ILike(`%${query}%`), id: Not(In(excludeIds)) },
        { email: ILike(`%${query}%`), id: Not(In(excludeIds)) },
      ],
      take: 20,
      select: ['id', 'displayName', 'email'],
    });

    return users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
    }));
  }

  async getUserProfile(userId: string, viewerId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    // Determine visibility based on relationship
    let allowedVisibilities: Array<'public' | 'pod' | 'private'>;

    if (viewerId === userId) {
      // Viewing own profile: show all decks
      allowedVisibilities = ['public', 'pod', 'private'];
    } else {
      // Check if they share a pod
      const sharedPods = await this.memberRepo
        .createQueryBuilder('m1')
        .innerJoin(
          PodMember,
          'm2',
          'm1.podId = m2.podId AND m2.userId = :viewerId',
          { viewerId },
        )
        .where('m1.userId = :userId', { userId })
        .getCount();

      if (sharedPods > 0) {
        // Pod member: show public + pod decks
        allowedVisibilities = ['public', 'pod'];
      } else {
        // Stranger: show only public decks
        allowedVisibilities = ['public'];
      }
    }

    const decks = await this.deckRepo
      .createQueryBuilder('deck')
      .where('deck.userId = :userId', { userId })
      .andWhere('deck.visibility IN (:...visibilities)', {
        visibilities: allowedVisibilities,
      })
      .leftJoinAndSelect('deck.cards', 'cards')
      .leftJoinAndSelect('cards.card', 'card')
      .leftJoinAndSelect('deck.deckScore', 'deckScore')
      .orderBy('deck.updatedAt', 'DESC')
      .getMany();

    const publicDecks = decks.map((deck) => {
      const commanders = deck.cards
        .filter((dc) => dc.isCommander && dc.card)
        .map((dc) => dc.card.name);

      const colors = [
        ...new Set(
          deck.cards
            .filter((dc) => dc.isCommander && dc.card?.colorIdentity)
            .flatMap((dc) => dc.card.colorIdentity || []),
        ),
      ];

      const commanderCard = deck.cards.find(
        (dc) => dc.isCommander && dc.card,
      );
      const commanderImageCrop =
        commanderCard?.card?.imageArtCrop ?? null;

      return {
        id: deck.id,
        name: deck.name,
        format: deck.format,
        cardCount: deck.cards.reduce((sum, dc) => sum + dc.quantity, 0),
        commanders,
        colors,
        commanderImageCrop,
        scores: deck.deckScore
          ? {
              power: deck.deckScore.power,
              salt: deck.deckScore.salt,
              fear: deck.deckScore.fear,
              airtime: deck.deckScore.airtime,
            }
          : null,
      };
    });

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt.toISOString(),
      publicDecks,
    };
  }

  async getMemberDecks(podId: string, requestingUserId: string, targetUserId: string) {
    await this.requireMembership(podId, requestingUserId);
    return this.decksService.getUserDecks(targetUserId);
  }
}
