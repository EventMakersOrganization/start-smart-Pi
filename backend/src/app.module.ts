import { AdaptiveLearningModule } from "./adaptive-learning/adaptive-learning.module";
import { BrainrushModule } from "./brainrush/brainrush.module";
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ActivityModule } from './activity/activity.module';
import { AppController } from './app.controller';
import { ChatModule } from './chat/chat.module';
import { SubjectsModule } from './subjects/subjects.module';
import { CodebattleModule } from './codebattle/codebattle.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RiskScoreModule } from './analytics/riskscore.module';
import { AlertModule } from './analytics/alert.module';
import { AlertConfigModule } from './alert-config/alert-config.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { ReportModule } from './report/report.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>(
          "MONGODB_URI",
          "mongodb://localhost/user-management",
        ),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ActivityModule,
    AnalyticsModule,
    RiskScoreModule,
    AlertModule,
    AlertConfigModule,
    MonitoringModule,
    ReportModule,
    AdaptiveLearningModule,
    ChatModule,
    BrainrushModule,
    SubjectsModule,
    CodebattleModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule { }
