import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../../entities/user.entity';
import { PodOfflineMember } from '../../entities/pod-offline-member.entity';
import { PodMember } from '../../entities/pod-member.entity';
import { EventOfflineRsvp } from '../../entities/event-offline-rsvp.entity';
import { EventRsvp } from '../../entities/event-rsvp.entity';
import { PodGameResult } from '../../entities/pod-game-result.entity';
import { PodInvite } from '../../entities/pod-invite.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PodOfflineMember, PodMember, EventOfflineRsvp, EventRsvp, PodGameResult, PodInvite]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    SettingsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
