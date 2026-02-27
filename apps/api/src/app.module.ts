import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./modules/auth/auth.module";
import { DecksModule } from "./modules/decks/decks.module";
import { CardsModule } from "./modules/cards/cards.module";
import { CollectionModule } from "./modules/collection/collection.module";
import { AdvisorModule } from "./modules/advisor/advisor.module";
import { PlaytestingModule } from "./modules/playtesting/playtesting.module";
import { DeckRankingModule } from "./modules/deck-ranking/deck-ranking.module";
import { PodsModule } from "./modules/pods/pods.module";
import { FeedbackModule } from "./modules/feedback/feedback.module";
import { EventsModule } from "./modules/events/events.module";
import { CommonModule } from "./common/common.module";
import { EmailModule } from "./modules/email/email.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SnakeNamingStrategy } from "./database/snake-naming.strategy";
import { migrations } from "./database/data-source";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        url: configService.get("DATABASE_URL"),
        autoLoadEntities: true,
        migrations,
        migrationsRun: true, // Auto-run pending migrations on startup
        synchronize: false, // Never use synchronize - use migrations instead
        logging: false, //configService.get('NODE_ENV') === 'development',
        // IMPORTANT: Only enable this AFTER running the CamelToSnakeCase migration!
        // namingStrategy: new SnakeNamingStrategy(),
      }),
      inject: [ConfigService],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Common services
    CommonModule,
    EmailModule,
    NotificationsModule,

    // Feature modules
    EventsModule,
    AuthModule,
    DecksModule,
    CardsModule,
    CollectionModule,
    AdvisorModule,
    PlaytestingModule,
    DeckRankingModule,
    PodsModule,
    FeedbackModule,
  ],
})
export class AppModule {}
