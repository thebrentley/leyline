import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import axios from 'axios';
import { User } from '../../entities/user.entity';
import { PodOfflineMember } from '../../entities/pod-offline-member.entity';
import { PodMember, PodRole } from '../../entities/pod-member.entity';
import { EventOfflineRsvp } from '../../entities/event-offline-rsvp.entity';
import { EventRsvp } from '../../entities/event-rsvp.entity';
import { PodGameResult } from '../../entities/pod-game-result.entity';
import { PodInvite } from '../../entities/pod-invite.entity';
import { Setting, SETTING_KEYS } from '../../entities/setting.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { SettingsService } from '../settings/settings.service';
import { EmailService } from '../email/email.service';
import { passwordResetEmailHtml } from '../email/templates/password-reset.template';

interface JwtPayload {
  sub: string;
  email: string;
}

interface ArchidektAuthResult {
  success: boolean;
  token?: string;
  userId?: number;
  username?: string;
  error?: string;
}

export interface SanitizedUser {
  id: string;
  email: string;
  displayName: string | null;
  profilePicture: string | null;
  archidektId: number | null;
  archidektUsername: string | null;
  archidektConnectedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly ARCHIDEKT_API = 'https://archidekt.com/api';
  private readonly SALT_ROUNDS = 10;
  private lastArchidektRequest = 0;
  private readonly ARCHIDEKT_RATE_LIMIT_MS = 500;
  private resetRateLimit = new Map<string, number>();

  private async archidektRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastArchidektRequest;
    if (elapsed < this.ARCHIDEKT_RATE_LIMIT_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.ARCHIDEKT_RATE_LIMIT_MS - elapsed),
      );
    }
    this.lastArchidektRequest = Date.now();
  }

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PodOfflineMember)
    private offlineMemberRepo: Repository<PodOfflineMember>,
    @InjectRepository(PodMember)
    private podMemberRepo: Repository<PodMember>,
    @InjectRepository(EventOfflineRsvp)
    private offlineRsvpRepo: Repository<EventOfflineRsvp>,
    @InjectRepository(EventRsvp)
    private rsvpRepo: Repository<EventRsvp>,
    @InjectRepository(PodGameResult)
    private gameResultRepo: Repository<PodGameResult>,
    @InjectRepository(PodInvite)
    private podInviteRepo: Repository<PodInvite>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
    private settingsService: SettingsService,
    private emailService: EmailService,
  ) {}

  // ==================== Local Authentication ====================

  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ accessToken: string; user: SanitizedUser }> {
    // Normalize email to prevent case-sensitive duplicates and login mismatches
    email = email.toLowerCase().trim();

    // Check if email already exists
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const user = this.userRepository.create({
      email,
      passwordHash,
      displayName: displayName || null,
    });

    await this.userRepository.save(user);

    // Merge any offline member records with matching email
    await this.mergeOfflineMembers(user.id, email);

    // Auto-accept any pending pod invites for this email
    await this.acceptPendingEmailInvites(user.id, email);

    // Generate JWT
    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: await this.sanitizeUser(user),
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: SanitizedUser }> {
    // Normalize email to match stored format (always lowercase/trimmed)
    email = email.toLowerCase().trim();

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: await this.sanitizeUser(user),
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async getMe(userId: string): Promise<SanitizedUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async updateProfile(
    userId: string,
    updates: { displayName?: string; profilePicture?: string },
  ): Promise<SanitizedUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (updates.displayName !== undefined) {
      user.displayName = updates.displayName || null;
    }

    if (updates.profilePicture !== undefined) {
      user.profilePicture = updates.profilePicture || null;
    }

    await this.userRepository.save(user);

    return this.sanitizeUser(user);
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.userRepository.remove(user);
  }

  // ==================== Password Reset ====================

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: 60s cooldown per email
    const now = Date.now();
    const lastRequest = this.resetRateLimit.get(normalizedEmail);
    if (lastRequest && now - lastRequest < 60_000) {
      return;
    }
    this.resetRateLimit.set(normalizedEmail, now);

    const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      return; // Silent — prevent email enumeration
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.userRepository.save(user);

    const apiBaseUrl = this.getApiBaseUrl();
    const resetUrl = `${apiBaseUrl}/api/auth/reset-password?token=${token}`;
    const html = passwordResetEmailHtml({ resetUrl });
    await this.emailService.sendEmail(user.email, 'Reset your Leyline password', html);
  }

  async validateResetToken(token: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { resetToken: token } });
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      return null;
    }
    return user;
  }

  async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
    const user = await this.validateResetToken(token);
    if (!user) {
      return { success: false, message: 'This reset link has expired or is invalid.' };
    }

    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters.' };
    }

    user.passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
    user.resetToken = null;
    user.resetTokenExpiresAt = null;
    await this.userRepository.save(user);

    return { success: true, message: 'Your password has been reset successfully.' };
  }

  getApiBaseUrl(): string {
    return this.configService.get<string>('API_BASE_URL', 'http://localhost:3001');
  }

  // ==================== Archidekt Connection ====================

  async connectArchidekt(
    userId: string,
    archidektUsername: string,
    archidektPassword: string,
  ): Promise<SanitizedUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Authenticate with Archidekt
    const result = await this.authenticateWithArchidekt(
      archidektUsername,
      archidektPassword,
    );

    if (!result.success || !result.token) {
      throw new BadRequestException(
        result.error || 'Failed to connect to Archidekt',
      );
    }

    // Check if this Archidekt account is already connected to another user
    const existingUserId = await this.findUserByArchidektId(result.userId!);
    if (existingUserId && existingUserId !== userId) {
      throw new ConflictException(
        'This Archidekt account is already connected to another user',
      );
    }

    // Store Archidekt connection in settings
    await this.settingsService.setArchidektSettings(userId, {
      archidektId: result.userId!,
      archidektUsername: result.username || archidektUsername,
      archidektEmail: archidektUsername,
      archidektToken: result.token,
      archidektPassword: this.encryptionService.encrypt(archidektPassword),
      archidektConnectedAt: new Date(),
    });

    return this.sanitizeUser(user);
  }

  async disconnectArchidekt(userId: string): Promise<SanitizedUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Clear all Archidekt settings
    await this.settingsService.clearArchidektSettings(userId);

    return this.sanitizeUser(user);
  }

  /**
   * Auto-refresh Archidekt token using stored credentials
   * Returns the new token or null if refresh failed
   */
  async autoRefreshArchidektToken(userId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      console.log('[Archidekt] Auto-refresh: User not found');
      return null;
    }

    const archidektSettings = await this.settingsService.getArchidektSettings(userId);

    if (!archidektSettings.archidektEmail || !archidektSettings.archidektPassword) {
      console.log('[Archidekt] Auto-refresh: No stored credentials (email or password missing)');
      return null;
    }

    try {
      console.log('[Archidekt] Auto-refreshing token for:', archidektSettings.archidektEmail);

      const decryptedPassword = this.encryptionService.decrypt(archidektSettings.archidektPassword);
      const result = await this.authenticateWithArchidekt(
        archidektSettings.archidektEmail,
        decryptedPassword,
      );

      if (!result.success || !result.token) {
        console.log('[Archidekt] Auto-refresh failed:', result.error);
        return null;
      }

      // Update token in settings
      await this.settingsService.updateArchidektToken(userId, result.token);

      console.log('[Archidekt] Token auto-refreshed successfully');
      return result.token;
    } catch (error: any) {
      console.error('[Archidekt] Auto-refresh error:', error.message);
      return null;
    }
  }

  async refreshArchidektToken(
    userId: string,
    archidektUsername: string,
    archidektPassword: string,
  ): Promise<SanitizedUser> {
    // Same as connect, but ensures user already has Archidekt connected
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const archidektSettings = await this.settingsService.getArchidektSettings(userId);
    if (!archidektSettings.archidektId) {
      throw new BadRequestException('Archidekt is not connected');
    }

    const result = await this.authenticateWithArchidekt(
      archidektUsername,
      archidektPassword,
    );

    if (!result.success || !result.token) {
      throw new BadRequestException(
        result.error || 'Failed to refresh Archidekt token',
      );
    }

    await this.settingsService.updateArchidektToken(userId, result.token);

    return this.sanitizeUser(user);
  }

  async getArchidektStatus(userId: string): Promise<{
    connected: boolean;
    username: string | null;
    connectedAt: Date | null;
    tokenValid: boolean;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const archidektSettings = await this.settingsService.getArchidektSettings(userId);
    const connected = !!archidektSettings.archidektId && !!archidektSettings.archidektToken;
    let tokenValid = false;

    // Verify token is still valid by making a test request
    if (connected && archidektSettings.archidektToken) {
      try {
        await this.archidektRateLimit();

        const response = await axios.get(
          `${this.ARCHIDEKT_API}/rest-auth/user/`,
          {
            headers: {
              Authorization: `JWT ${archidektSettings.archidektToken}`,
              Accept: 'application/json',
            },
            timeout: 5000,
          },
        );
        tokenValid = response.status === 200;
      } catch {
        tokenValid = false;
      }

      // Auto-refresh if token expired but stored credentials exist
      if (!tokenValid) {
        const newToken = await this.autoRefreshArchidektToken(userId);
        if (newToken) {
          tokenValid = true;
        }
      }
    }

    return {
      connected,
      username: archidektSettings.archidektUsername,
      connectedAt: archidektSettings.archidektConnectedAt,
      tokenValid,
    };
  }

  /**
   * Get Archidekt token for a user (used by other services like DecksService)
   */
  async getArchidektToken(userId: string): Promise<string | null> {
    const settings = await this.settingsService.getArchidektSettings(userId);
    return settings.archidektToken;
  }

  /**
   * Get Archidekt ID for a user
   */
  async getArchidektId(userId: string): Promise<number | null> {
    const settings = await this.settingsService.getArchidektSettings(userId);
    return settings.archidektId;
  }

  // ==================== Offline Member Merge ====================

  /**
   * Find all unlinked offline members matching this email, add the user
   * as a pod member, convert offline RSVPs to regular RSVPs, then delete
   * the offline member records.
   */
  async mergeOfflineMembers(userId: string, email: string): Promise<void> {
    try {
      const normalizedEmail = email.toLowerCase().trim();

      const offlineMembers = await this.offlineMemberRepo.find({
        where: {
          email: normalizedEmail,
          linkedUserId: IsNull(),
        },
      });

      if (offlineMembers.length === 0) {
        console.log(`[mergeOfflineMembers] No unlinked offline members found for email: ${normalizedEmail}`);
        return;
      }

      console.log(`[mergeOfflineMembers] Found ${offlineMembers.length} offline member(s) for email: ${normalizedEmail}`);

      for (const offlineMember of offlineMembers) {
        // 1. Add user as pod member (if not already)
        const existingMembership = await this.podMemberRepo.findOne({
          where: { podId: offlineMember.podId, userId },
        });

        if (!existingMembership) {
          const member = this.podMemberRepo.create({
            podId: offlineMember.podId,
            userId,
            role: 'member' as PodRole,
          });
          await this.podMemberRepo.save(member);
        }

        // 2. Backfill game results before deleting the offline member
        await this.backfillGameResults(offlineMember.id, userId);

        // 3. Convert offline RSVPs to regular RSVPs
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

        // 4. Delete the offline member (cascades to offline RSVPs)
        await this.offlineMemberRepo.remove(offlineMember);

        console.log(`[mergeOfflineMembers] Merged offline member ${offlineMember.id} (pod: ${offlineMember.podId}) into user ${userId}`);
      }
    } catch (error) {
      // Don't fail registration if merge fails
      console.error('[mergeOfflineMembers] Error merging offline members:', error);
    }
  }

  private async acceptPendingEmailInvites(userId: string, email: string): Promise<void> {
    try {
      const normalizedEmail = email.toLowerCase().trim();

      const pendingInvites = await this.podInviteRepo.find({
        where: { inviteeEmail: normalizedEmail, status: 'pending' },
      });

      if (pendingInvites.length === 0) return;

      for (const invite of pendingInvites) {
        // Ensure user is a pod member
        const existingMember = await this.podMemberRepo.findOne({
          where: { podId: invite.podId, userId },
        });

        if (!existingMember) {
          const member = this.podMemberRepo.create({
            podId: invite.podId,
            userId,
            role: 'member' as PodRole,
          });
          await this.podMemberRepo.save(member);
        }

        // Mark invite as accepted
        invite.status = 'accepted';
        invite.inviteeId = userId;
        await this.podInviteRepo.save(invite);
      }

      console.log(`[acceptPendingEmailInvites] Accepted ${pendingInvites.length} invite(s) for ${normalizedEmail}`);
    } catch (error) {
      // Don't fail registration if invite acceptance fails
      console.error('[acceptPendingEmailInvites] Error:', error);
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

  // ==================== Helpers ====================

  /**
   * Find user ID by Archidekt ID (to check for duplicate connections)
   */
  private async findUserByArchidektId(archidektId: number): Promise<string | null> {
    const settingRepo = this.userRepository.manager.getRepository(Setting);
    const found = await settingRepo.findOne({
      where: {
        key: SETTING_KEYS.ARCHIDEKT_ID,
        value: archidektId.toString(),
      },
    });

    return found?.userId ?? null;
  }

  private async authenticateWithArchidekt(
    email: string,
    password: string,
  ): Promise<ArchidektAuthResult> {
    console.log('[Archidekt] Starting authentication for:', email);

    try {
      await this.archidektRateLimit();

      const loginUrl = `${this.ARCHIDEKT_API}/rest-auth/login/`;
      console.log('[Archidekt] POST to:', loginUrl);

      const response = await axios.post(
        loginUrl,
        { email, password },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      console.log('[Archidekt] Login response status:', response.status);
      console.log('[Archidekt] Login response data keys:', Object.keys(response.data || {}));
      console.log('[Archidekt] Login response data:', JSON.stringify(response.data, null, 2));

      // Archidekt can return token in different fields: access, key, token, access_token
      const token =
        response.data?.access ||
        response.data?.key ||
        response.data?.token ||
        response.data?.access_token;

      console.log('[Archidekt] Extracted token:', token ? `${token.substring(0, 20)}...` : 'null');

      if (token) {
        // Get user info with the token - Archidekt uses JWT auth
        console.log('[Archidekt] Fetching user info...');
        await this.archidektRateLimit();

        const userResponse = await axios.get(
          `${this.ARCHIDEKT_API}/rest-auth/user/`,
          {
            headers: {
              Authorization: `JWT ${token}`,
              Accept: 'application/json',
            },
          },
        );

        console.log('[Archidekt] User response status:', userResponse.status);
        console.log('[Archidekt] User data:', JSON.stringify(userResponse.data, null, 2));

        return {
          success: true,
          token,
          userId: userResponse.data.pk || userResponse.data.id,
          username: userResponse.data.username,
        };
      }

      console.log('[Archidekt] No token found in response');
      return { success: false, error: 'Invalid response from Archidekt' };
    } catch (error: any) {
      console.log('[Archidekt] Error occurred:', error.message);
      console.log('[Archidekt] Error response status:', error.response?.status);
      console.log('[Archidekt] Error response data:', JSON.stringify(error.response?.data, null, 2));

      const message =
        error.response?.data?.non_field_errors?.[0] ||
        error.response?.data?.email?.[0] ||
        error.response?.data?.password?.[0] ||
        error.response?.data?.detail ||
        error.message ||
        'Authentication failed';
      console.log('[Archidekt] Returning error message:', message);
      return { success: false, error: message };
    }
  }

  private generateToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };
    return this.jwtService.sign(payload);
  }

  private async sanitizeUser(user: User): Promise<SanitizedUser> {
    const archidektSettings = await this.settingsService.getArchidektSettings(user.id);

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      profilePicture: user.profilePicture,
      archidektId: archidektSettings.archidektId,
      archidektUsername: archidektSettings.archidektUsername,
      archidektConnectedAt: archidektSettings.archidektConnectedAt,
      createdAt: user.createdAt,
    };
  }
}
