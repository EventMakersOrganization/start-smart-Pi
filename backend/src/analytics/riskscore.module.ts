import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RiskScoreController } from './riskscore.controller';
import { KpiController } from './kpi.controller';
import { RiskScoreService } from './riskscore.service';
import { RiskScore, RiskScoreSchema } from './schemas/riskscore.schema';
import { Alert, AlertSchema } from './schemas/alert.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Activity, ActivitySchema } from '../activity/schemas/activity.schema';
import { RiskAlgorithmService } from './services/risk-algorithm.service';
import { KpiService } from './services/kpi.service';
import { AlertThresholdService } from './services/alert-threshold.service';
import { AlertService } from './alert.service';
import { EmailService } from '../notification/email.service';
import { AlertConfigModule } from '../alert-config/alert-config.module';
import { AnalyticsModule } from './analytics.module';

@Module({
  imports: [
    AnalyticsModule,
    AlertConfigModule,
    MongooseModule.forFeature([
      { name: RiskScore.name, schema: RiskScoreSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: User.name, schema: UserSchema },
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  controllers: [RiskScoreController, KpiController],
  providers: [RiskScoreService, RiskAlgorithmService, KpiService, AlertThresholdService, AlertService, EmailService],
  exports: [RiskScoreService, RiskAlgorithmService, KpiService, AlertThresholdService],
})
export class RiskScoreModule {}
