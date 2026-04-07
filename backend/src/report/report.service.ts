import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';
import { MonitoringService } from '../monitoring/monitoring.service';
import { UsageService } from '../analytics/usage.service';
import {
  RiskLevel,
  RiskScore,
  RiskScoreDocument,
} from '../analytics/schemas/riskscore.schema';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    @InjectModel(RiskScore.name)
    private readonly riskScoreModel: Model<RiskScoreDocument>,
    private readonly monitoringService: MonitoringService,
    private readonly usageService: UsageService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyReport(): Promise<void> {
    await this.createOrUpdateDailyReport();
  }

  async createOrUpdateDailyReport(targetDate: Date = new Date()): Promise<ReportDocument> {
    const [systemMetrics, usageAnalytics, highRiskUsers] = await Promise.all([
      this.monitoringService.getSystemMetrics(),
      this.usageService.getUsageAnalytics(),
      this.getHighRiskUsers(),
    ]);

    const reportDate = this.toUtcDayStart(targetDate);

    const report = await this.reportModel
      .findOneAndUpdate(
        { date: reportDate },
        {
          $set: {
            date: reportDate,
            totalUsers: systemMetrics.totalUsers,
            activeUsers: usageAnalytics.activeUsers,
            highRiskUsers,
            alertsCount: systemMetrics.totalAlerts,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    this.logger.log(
      `Daily report generated for ${reportDate.toISOString().slice(0, 10)} (users=${report.totalUsers}, active=${report.activeUsers}, highRisk=${report.highRiskUsers}, alerts=${report.alertsCount})`,
    );

    return report;
  }

  private async getHighRiskUsers(): Promise<number> {
    const result = await this.riskScoreModel
      .aggregate<{ count: number }>([
        { $match: { riskLevel: RiskLevel.HIGH } },
        { $group: { _id: '$user' } },
        { $count: 'count' },
      ])
      .exec();

    return result[0]?.count || 0;
  }

  private toUtcDayStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
