import { Module } from '@nestjs/common';
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
import { RiskScore, RiskScoreSchema } from './schemas/riskscore.schema';
import { Alert, AlertSchema } from './schemas/alert.schema';
import { AbTesting, AbTestingSchema } from './schemas/ab-testing.schema';
import {
  ExplainabilityLog,
  ExplainabilityLogSchema,
} from './schemas/explainability.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Activity, ActivitySchema } from '../activity/schemas/activity.schema';
import {
  StudentProfile,
  StudentProfileSchema,
} from '../users/schemas/student-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RiskScore.name, schema: RiskScoreSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: ExplainabilityLog.name, schema: ExplainabilityLogSchema },
      { name: User.name, schema: UserSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: StudentProfile.name, schema: StudentProfileSchema },
      { name: AbTesting.name, schema: AbTestingSchema },
    ]),
  ],
  controllers: [AnalyticsController, ExplainabilityController],
  providers: [
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
  ],
  exports: [
    AnalyticsService,
    ExplainabilityService,
    UsageService,
    ComparisonService,
    PredictiveService,
    InterventionService,
    AbTestingService,
    IntegrationService,
    InsightService,
  ],
})
export class AnalyticsModule {}
