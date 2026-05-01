import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportService } from './report.service';
import { Report, ReportSchema } from './schemas/report.schema';
import { ReportDefinition, ReportDefinitionSchema } from './schemas/report-definition.schema';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RiskScore, RiskScoreSchema } from '../analytics/schemas/riskscore.schema';
import { AuthModule } from '../auth/auth.module';
import { ReportDefinitionService } from './report-definition.service';
import { ReportDefinitionController } from './report-definition.controller';

@Module({
  imports: [
    AuthModule,
    MonitoringModule,
    AnalyticsModule,
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
      { name: RiskScore.name, schema: RiskScoreSchema },
      { name: ReportDefinition.name, schema: ReportDefinitionSchema },
    ]),
  ],
  controllers: [ReportDefinitionController],
  providers: [ReportService, ReportDefinitionService],
  exports: [ReportService, ReportDefinitionService],
})
export class ReportModule {}
