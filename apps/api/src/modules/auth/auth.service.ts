import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { User } from '../../entities/user.entity';
import { Setting, SETTING_KEYS } from '../../entities/setting.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { SettingsService } from '../settings/settings.service';

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
    private jwtService: JwtService,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
    private settingsService: SettingsService,
  ) {}

  // ==================== Local Authentication ====================

  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ accessToken: string; user: SanitizedUser }> {
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
      archidektId: archidektSettings.archidektId,
      archidektUsername: archidektSettings.archidektUsername,
      archidektConnectedAt: archidektSettings.archidektConnectedAt,
      createdAt: user.createdAt,
    };
  }
}
