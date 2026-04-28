import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { ExplainabilityController } from './explainability.controller';
import { AnalyticsService } from './analytics.service';
import { KpiService } from './services/kpi.service';
import { ExplainabilityService } from './services/explainability.service';
import { UsageService } from './usage.service';
import { ComparisonService } from './comparison.service';
import { PredictiveService } from './predictive.service';
import { InterventionService } from './intervention.service';
import { AbTestingService } from './ab-testing.service';
import { IntegrationService } from './integration.service';
import { InsightService } from './insight.service';
import { AbInterventionAutomationService } from './ab-intervention-automation.service';
import { AlertService } from './alert.service';
import { AnalyticsReadCacheService } from './services/analytics-read-cache.service';
import { AnalyticsWebhookController } from './analytics-webhook.controller';
import { AnalyticsWebhookService } from './analytics-webhook.service';
import { AnalyticsWebhook, AnalyticsWebhookSchema } from './schemas/analytics-webhook.schema';
import { RiskScore, RiskScoreSchema } from './schemas/riskscore.schema';
import { Alert, AlertSchema } from './schemas/alert.schema';
import { AbTesting, AbTestingSchema } from './schemas/ab-testing.schema';
import {
  ExplainabilityLog,
  ExplainabilityLogSchema,
} from './schemas/explainability.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Activity, ActivitySchema } from '../activity/schemas/activity.schema';
import { UserSession, UserSessionSchema } from '../activity/schemas/user-session.schema';
import { ActivityModule } from '../activity/activity.module';
import { EmailService } from '../notification/email.service';
import {
  StudentProfile,
  StudentProfileSchema,
} from '../users/schemas/student-profile.schema';
import {
  StudentPerformance,
  StudentPerformanceSchema,
} from '../adaptive-learning/schemas/student-performance.schema';

@Module({
  imports: [
    HttpModule,
    ActivityModule,
    MongooseModule.forFeature([
      { name: RiskScore.name, schema: RiskScoreSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: ExplainabilityLog.name, schema: ExplainabilityLogSchema },
      { name: User.name, schema: UserSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: UserSession.name, schema: UserSessionSchema },
      { name: StudentProfile.name, schema: StudentProfileSchema },
      { name: StudentPerformance.name, schema: StudentPerformanceSchema },
      { name: AbTesting.name, schema: AbTestingSchema },
      { name: AnalyticsWebhook.name, schema: AnalyticsWebhookSchema },
    ]),
  ],
  controllers: [AnalyticsController, ExplainabilityController, AnalyticsWebhookController],
  providers: [
    AnalyticsReadCacheService,
    AnalyticsService,
    KpiService,
    ExplainabilityService,
    UsageService,
    ComparisonService,
    PredictiveService,
    InterventionService,
    AbTestingService,
    IntegrationService,
    InsightService,
    AnalyticsWebhookService,
    AlertService,
    EmailService,
    AbInterventionAutomationService,
  ],
  exports: [
    AnalyticsReadCacheService,
    AnalyticsService,
    ExplainabilityService,
    UsageService,
    ComparisonService,
    PredictiveService,
    InterventionService,
    AbTestingService,
    AbInterventionAutomationService,
    IntegrationService,
    InsightService,
  ],
})
export class AnalyticsModule {}
