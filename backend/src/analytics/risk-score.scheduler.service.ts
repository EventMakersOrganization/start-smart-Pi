import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RiskScoreService } from './riskscore.service';

@Injectable()
export class RiskScoreSchedulerService {
  private readonly logger = new Logger(RiskScoreSchedulerService.name);

  constructor(private readonly riskScoreService: RiskScoreService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async recalculateRiskScoresPeriodically(): Promise<void> {
    const enabled = String(process.env.RISK_SCORING_CRON_ENABLED || 'true').toLowerCase() !== 'false';
    if (!enabled) {
      return;
    }

    try {
      const summary = await this.riskScoreService.recalculateAllStudentRiskScores();
      this.logger.log(
        `Periodic risk scan done: processed=${summary.processedStudents}, updated=${summary.updatedScores}, high=${summary.highRiskCount}, medium=${summary.mediumRiskCount}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Periodic risk scan failed: ${message}`);
    }
  }
}
