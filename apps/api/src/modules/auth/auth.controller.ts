import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsEmail, MinLength, IsOptional } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

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

// ==================== Controller ====================

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
