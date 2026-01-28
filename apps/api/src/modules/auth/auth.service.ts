import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { User } from '../../entities/user.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { SyncQueueService } from '../decks/sync-queue.service';

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
    @Inject(forwardRef(() => SyncQueueService))
    private syncQueueService: SyncQueueService,
  ) {}

  // ==================== Local Authentication ====================

  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
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
      user: this.sanitizeUser(user),
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
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
      user: this.sanitizeUser(user),
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async getMe(userId: string): Promise<Partial<User>> {
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
  ): Promise<Partial<User>> {
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
    const existingConnection = await this.userRepository.findOne({
      where: { archidektId: result.userId },
    });

    if (existingConnection && existingConnection.id !== userId) {
      throw new ConflictException(
        'This Archidekt account is already connected to another user',
      );
    }

    // Update user with Archidekt connection
    user.archidektId = result.userId!;
    user.archidektUsername = result.username || archidektUsername;
    user.archidektEmail = archidektUsername; // Store the email/username used for login
    user.archidektToken = result.token;
    user.archidektPassword = this.encryptionService.encrypt(archidektPassword);
    user.archidektConnectedAt = new Date();

    await this.userRepository.save(user);

    // Fire and forget - handoff pattern, return immediately
    // Auto-sync all decks after successful connection
    this.syncQueueService.queueSyncAll(userId).catch((err) => {
      console.error('[Auth] Auto-sync failed:', err.message);
    });

    return this.sanitizeUser(user);
  }

  async disconnectArchidekt(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    user.archidektId = null;
    user.archidektUsername = null;
    user.archidektEmail = null;
    user.archidektToken = null;
    user.archidektPassword = null;
    user.archidektConnectedAt = null;

    await this.userRepository.save(user);

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

    if (!user.archidektEmail || !user.archidektPassword) {
      console.log('[Archidekt] Auto-refresh: No stored credentials (email or password missing)');
      return null;
    }

    try {
      console.log('[Archidekt] Auto-refreshing token for:', user.archidektEmail);

      const decryptedPassword = this.encryptionService.decrypt(user.archidektPassword);
      const result = await this.authenticateWithArchidekt(
        user.archidektEmail,
        decryptedPassword,
      );

      if (!result.success || !result.token) {
        console.log('[Archidekt] Auto-refresh failed:', result.error);
        return null;
      }

      // Update token in database
      user.archidektToken = result.token;
      await this.userRepository.save(user);

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
  ): Promise<Partial<User>> {
    // Same as connect, but ensures user already has Archidekt connected
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.archidektId) {
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

    user.archidektToken = result.token;
    await this.userRepository.save(user);

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

    const connected = !!user.archidektId && !!user.archidektToken;
    let tokenValid = false;

    // Verify token is still valid by making a test request
    if (connected && user.archidektToken) {
      try {
        await this.archidektRateLimit();
        
        const response = await axios.get(
          `${this.ARCHIDEKT_API}/rest-auth/user/`,
          {
            headers: {
              Authorization: `JWT ${user.archidektToken}`,
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
      username: user.archidektUsername,
      connectedAt: user.archidektConnectedAt,
      tokenValid,
    };
  }

  // ==================== Helpers ====================

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

  private sanitizeUser(user: User): Partial<User> {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      archidektId: user.archidektId,
      archidektUsername: user.archidektUsername,
      archidektConnectedAt: user.archidektConnectedAt,
      createdAt: user.createdAt,
    };
  }
}
