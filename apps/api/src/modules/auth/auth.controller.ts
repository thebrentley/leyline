import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { IsString, IsNotEmpty, IsEmail, MinLength, IsOptional } from 'class-validator';
import { AuthService } from './auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import {
  resetPasswordFormHtml,
  resetPasswordResultHtml,
} from '../email/templates/password-reset.template';

// ==================== DTOs ====================

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class ConnectArchidektDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;
}

class DeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}

class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

class UnregisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

// ==================== Controller ====================

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private notificationsService: NotificationsService,
  ) {}

  // ========== Local Auth ==========

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.displayName);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getMe(user.userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.authService.deleteAccount(user.userId, dto.password);
    return { success: true };
  }

  // ========== Password Reset ==========

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If an account exists with that email, a reset link has been sent.' };
  }

  @Get('reset-password')
  async showResetForm(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      return res.type('text/html').send(
        resetPasswordResultHtml({ success: false, message: 'Invalid reset link.' }),
      );
    }

    const user = await this.authService.validateResetToken(token);
    if (!user) {
      return res.type('text/html').send(
        resetPasswordResultHtml({ success: false, message: 'This reset link has expired or is invalid.' }),
      );
    }

    const apiBaseUrl = this.authService.getApiBaseUrl();
    return res.type('text/html').send(
      resetPasswordFormHtml({ token, apiBaseUrl }),
    );
  }

  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res() res: Response,
  ) {
    const result = await this.authService.resetPassword(dto.token, dto.password);
    return res.type('text/html').send(
      resetPasswordResultHtml(result),
    );
  }

  // ========== Push Notifications ==========

  @Post('push-token')
  @UseGuards(JwtAuthGuard)
  async registerPushToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RegisterPushTokenDto,
  ) {
    await this.notificationsService.registerToken(
      user.userId,
      dto.token,
      dto.platform,
    );
    return { success: true };
  }

  @Delete('push-token')
  @UseGuards(JwtAuthGuard)
  async unregisterPushToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UnregisterPushTokenDto,
  ) {
    await this.notificationsService.unregisterToken(user.userId, dto.token);
    return { success: true };
  }

  // ========== Archidekt Connection ==========

  @Post('archidekt/connect')
  @UseGuards(JwtAuthGuard)
  async connectArchidekt(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConnectArchidektDto,
  ) {
    return this.authService.connectArchidekt(
      user.userId,
      dto.username,
      dto.password,
    );
  }

  @Delete('archidekt/disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnectArchidekt(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.disconnectArchidekt(user.userId);
  }

  @Post('archidekt/refresh')
  @UseGuards(JwtAuthGuard)
  async refreshArchidektToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConnectArchidektDto,
  ) {
    return this.authService.refreshArchidektToken(
      user.userId,
      dto.username,
      dto.password,
    );
  }

  @Get('archidekt/status')
  @UseGuards(JwtAuthGuard)
  async getArchidektStatus(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getArchidektStatus(user.userId);
  }
}
