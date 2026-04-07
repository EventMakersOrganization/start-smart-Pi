import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Activity,
  ActivityAction,
  ActivityDocument,
} from '../activity/schemas/activity.schema';

interface AggregatedUserUsage {
  userId: string;
  loginCount: number;
  activityCount: number;
  firstActivityAt: Date;
  lastActivityAt: Date;
}

export interface UsageAnalyticsResponse {
  activeUsers: number;
  sessionCount: number;
  averageSessionTime: number;
  engagementScore: number;
  window: {
    from: string;
    to: string;
  };
  timestamp: string;
}

@Injectable()
export class UsageService {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
  ) {}

  async getUsageAnalytics(): Promise<UsageAnalyticsResponse> {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const perUserUsage = await this.activityModel
      .aggregate<AggregatedUserUsage>([
        {
          $match: {
            timestamp: { $gte: from, $lte: now },
          },
        },
        {
          $group: {
            _id: '$userId',
            loginCount: {
              $sum: {
                $cond: [{ $eq: ['$action', ActivityAction.LOGIN] }, 1, 0],
              },
            },
            activityCount: { $sum: 1 },
            firstActivityAt: { $min: '$timestamp' },
            lastActivityAt: { $max: '$timestamp' },
          },
        },
        {
          $project: {
            _id: 0,
            userId: { $toString: '$_id' },
            loginCount: 1,
            activityCount: 1,
            firstActivityAt: 1,
            lastActivityAt: 1,
          },
        },
      ])
      .exec();

    const activeUsers = perUserUsage.length;
    const sessionCount = perUserUsage.reduce((sum, item) => {
      // Use login actions as the primary session boundary signal.
      return sum + item.loginCount;
    }, 0);

    const averageSessionTime = this.computeAverageSessionTime(perUserUsage);
    const engagementScore = this.computeEngagementScore(perUserUsage);

    return {
      activeUsers,
      sessionCount,
      averageSessionTime,
      engagementScore,
      window: {
        from: from.toISOString(),
        to: now.toISOString(),
      },
      timestamp: now.toISOString(),
    };
  }

  private computeAverageSessionTime(perUserUsage: AggregatedUserUsage[]): number {
    if (perUserUsage.length === 0) {
      return 0;
    }

    let totalMinutes = 0;

    for (const item of perUserUsage) {
      const first = new Date(item.firstActivityAt).getTime();
      const last = new Date(item.lastActivityAt).getTime();
      const minutes = Math.max(0, (last - first) / (1000 * 60));
      totalMinutes += minutes;
    }

    return Number((totalMinutes / perUserUsage.length).toFixed(2));
  }

  private computeEngagementScore(perUserUsage: AggregatedUserUsage[]): number {
    if (perUserUsage.length === 0) {
      return 0;
    }

    let totalScore = 0;

    for (const item of perUserUsage) {
      // login frequency contributes up to 50 points (2+ logins/day = full points)
      const loginScore = Math.min((item.loginCount / 2) * 50, 50);

      // activity frequency contributes up to 50 points (10+ activities/day = full points)
      const activityScore = Math.min((item.activityCount / 10) * 50, 50);

      totalScore += loginScore + activityScore;
    }

    return Number((totalScore / perUserUsage.length).toFixed(2));
  }
}
