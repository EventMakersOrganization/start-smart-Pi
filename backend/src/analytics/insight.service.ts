import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activity, ActivityDocument } from '../activity/schemas/activity.schema';
import { AnalyticsService, CohortAnalyticsRow } from './analytics.service';

export interface InsightsResponse {
  insights: string[];
}

@Injectable()
export class InsightService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
  ) {}

  async generateInsights(): Promise<InsightsResponse> {
    const [retention, cohorts] = await Promise.all([
      this.analyticsService.getRetentionAnalytics(30),
      this.analyticsService.getCohortAnalytics(),
    ]);

    const insights: string[] = [];

    if (retention.dropoutRate >= 40) {
      insights.push(
        `High dropout risk detected: ${retention.dropoutRate}% of users are currently inactive in the retention window.`,
      );
    } else if (retention.dropoutRate >= 20) {
      insights.push(
        `Moderate dropout pressure observed: current dropout rate is ${retention.dropoutRate}%.`,
      );
    }

    const trendInsight = this.getTrendInsight(retention.trend);
    if (trendInsight) {
      insights.push(trendInsight);
    }

    const cohortInsight = this.getCohortRiskInsight(cohorts);
    if (cohortInsight) {
      insights.push(cohortInsight);
    }

    const engagementInsight = await this.getEngagementInsightFromScoring();
    if (engagementInsight) {
      insights.push(engagementInsight);
    }

    if (insights.length === 0) {
      insights.push('No critical anomalies detected across retention, cohorts, and engagement scoring this cycle.');
    }

    return { insights };
  }

  private getTrendInsight(
    trend: Array<{ date: string; activeUsers: number; returningUsers: number }>,
  ): string | null {
    if (trend.length < 14) {
      return null;
    }

    const last14 = trend.slice(-14);
    const previousWeek = last14.slice(0, 7);
    const currentWeek = last14.slice(7);

    const previousAvg = previousWeek.reduce((sum, row) => sum + row.activeUsers, 0) / previousWeek.length;
    const currentAvg = currentWeek.reduce((sum, row) => sum + row.activeUsers, 0) / currentWeek.length;

    if (previousAvg <= 0) {
      return null;
    }

    const ratio = currentAvg / previousAvg;

    if (ratio <= 0.9) {
      return 'Engagement decreased this week compared with the previous week based on active-user trend.';
    }

    if (ratio >= 1.1) {
      return 'Engagement increased this week compared with the previous week based on active-user trend.';
    }

    return null;
  }

  private getCohortRiskInsight(cohorts: CohortAnalyticsRow[]): string | null {
    if (cohorts.length === 0) {
      return null;
    }

    const highestRisk = cohorts.reduce((best, row) => {
      return row.averageRisk > best.averageRisk ? row : best;
    }, cohorts[0]);

    const lowPerformanceCohort = cohorts.find((row) => row.cohort === 'performance:low') || null;

    if (lowPerformanceCohort && lowPerformanceCohort.averageRisk >= 45) {
      return `Students with low activity and performance show higher risk: cohort ${lowPerformanceCohort.cohort} has average risk ${lowPerformanceCohort.averageRisk}.`;
    }

    if (highestRisk.averageRisk >= 50) {
      return `High dropout risk detected in ${highestRisk.cohort} with average risk score ${highestRisk.averageRisk}.`;
    }

    return null;
  }

  private async getEngagementInsightFromScoring(): Promise<string | null> {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const rows = await this.activityModel
      .aggregate<{ userId: string }>([
        {
          $match: {
            timestamp: { $gte: weekStart, $lte: now },
          },
        },
        {
          $group: {
            _id: '$userId',
          },
        },
        { $limit: 20 },
        {
          $project: {
            _id: 0,
            userId: { $toString: '$_id' },
          },
        },
      ])
      .exec();

    if (rows.length === 0) {
      return null;
    }

    const scores = (
      await Promise.all(
        rows.map(async (row) => {
          try {
            const engagement = await this.analyticsService.getStudentEngagementScore(row.userId);
            return engagement.engagementScore;
          } catch {
            return null;
          }
        }),
      )
    ).filter((score): score is number => typeof score === 'number');

    if (scores.length === 0) {
      return null;
    }

    const average = Number(
      (scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length)).toFixed(2),
    );

    if (average < 45) {
      return `Average engagement scoring is low this week (${average}/100), indicating an at-risk participation pattern.`;
    }

    if (average >= 70) {
      return `Average engagement scoring is strong this week (${average}/100).`;
    }

    return null;
  }
}
