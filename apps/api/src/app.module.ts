import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { DecksModule } from './modules/decks/decks.module';
import { CardsModule } from './modules/cards/cards.module';
import { CollectionModule } from './modules/collection/collection.module';
import { AdvisorModule } from './modules/advisor/advisor.module';
import { EventsModule } from './modules/events/events.module';
import { CommonModule } from './common/common.module';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: false,
        // IMPORTANT: Only enable this AFTER running the CamelToSnakeCase migration!
        // namingStrategy: new SnakeNamingStrategy(),
      }),
      inject: [ConfigService],
    }),

    // Common services
    CommonModule,

    // Feature modules
    EventsModule,
    AuthModule,
    DecksModule,
    CardsModule,
    CollectionModule,
    AdvisorModule,
  ],
})
export class AppModule {}
