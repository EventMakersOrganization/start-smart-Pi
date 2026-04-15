import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Activity, ActivityDocument } from '../../activity/schemas/activity.schema';
import { RiskScore, RiskScoreDocument, RiskLevel } from '../schemas/riskscore.schema';
import { Alert, AlertDocument } from '../schemas/alert.schema';
import {
  ANALYTICS_CACHE_SCHEMA_VERSION,
  AnalyticsReadCacheService,
} from './analytics-read-cache.service';

export interface KpiResult {
  value: number;
  label: string;
  timestamp: Date;
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  lowPercentage: number;
  mediumPercentage: number;
  highPercentage: number;
  total: number;
  timestamp: Date;
}

@Injectable()
export class KpiService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(RiskScore.name) private riskScoreModel: Model<RiskScoreDocument>,
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    private readonly readCache: AnalyticsReadCacheService,
  ) {}

  /**
   * Calculate total number of users in the system
   */
  async getTotalUsers(): Promise<KpiResult> {
    const total = await this.userModel.countDocuments().exec();
    
    return {
      value: total,
      label: 'Total Users',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate number of active users (activity in last 24 hours)
   */
  async getActiveUsers(): Promise<KpiResult> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Count only active IDs that still exist in users collection.
    // This prevents stale/orphaned activity rows from making Active Users > Total Users.
    const [row] = await this.activityModel
      .aggregate<{ count: number }>([
        {
          $match: {
            timestamp: { $gte: twentyFourHoursAgo },
          },
        },
        {
          $group: {
            _id: '$userId',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $match: {
            user: { $ne: [] },
          },
        },
        {
          $count: 'count',
        },
      ])
      .exec();

    return {
      value: Number(row?.count || 0),
      label: 'Active Users (24h)',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate number of high-risk users
   */
  async getHighRiskUsers(): Promise<KpiResult> {
    const highRiskCount = await this.riskScoreModel
      .countDocuments({
        riskLevel: RiskLevel.HIGH,
      })
      .exec();
    
    return {
      value: highRiskCount,
      label: 'High Risk Users',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate total number of alerts
   */
  async getTotalAlerts(): Promise<KpiResult> {
    const total = await this.alertModel.countDocuments().exec();
    
    return {
      value: total,
      label: 'Total Alerts',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate risk distribution across all users with risk scores
   * Returns counts and percentages for low, medium, and high risk levels
   */
  async getRiskDistribution(): Promise<RiskDistribution> {
    // Use MongoDB aggregation to group by risk level
    const distribution = await this.riskScoreModel.aggregate([
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 },
        },
      },
    ]).exec();

    // Initialize counts
    let lowCount = 0;
    let mediumCount = 0;
    let highCount = 0;

    // Map aggregation results to counts
    distribution.forEach((item) => {
      switch (item._id) {
        case RiskLevel.LOW:
          lowCount = item.count;
          break;
        case RiskLevel.MEDIUM:
          mediumCount = item.count;
          break;
        case RiskLevel.HIGH:
          highCount = item.count;
          break;
      }
    });

    const total = lowCount + mediumCount + highCount;

    // Calculate percentages (avoid division by zero)
    const lowPercentage = total > 0 ? Math.round((lowCount / total) * 100) : 0;
    const mediumPercentage = total > 0 ? Math.round((mediumCount / total) * 100) : 0;
    const highPercentage = total > 0 ? Math.round((highCount / total) * 100) : 0;

    return {
      low: lowCount,
      medium: mediumCount,
      high: highCount,
      lowPercentage,
      mediumPercentage,
      highPercentage,
      total,
      timestamp: new Date(),
    };
  }

  /**
   * Get all KPIs at once for dashboard efficiency
   */
  async getAllKpis() {
    const key = `kpi:allKpis:${ANALYTICS_CACHE_SCHEMA_VERSION}`;
    return this.readCache.getOrSet(key, () => this.computeAllKpis());
  }

  private async computeAllKpis() {
    const [totalUsers, activeUsers, highRiskUsers, totalAlerts, riskDistribution] =
      await Promise.all([
        this.getTotalUsers(),
        this.getActiveUsers(),
        this.getHighRiskUsers(),
        this.getTotalAlerts(),
        this.getRiskDistribution(),
      ]);

    return {
      totalUsers,
      activeUsers,
      highRiskUsers,
      totalAlerts,
      riskDistribution,
      timestamp: new Date(),
    };
  }

  /**
   * Percent change vs prior window. Used for dashboard trend badges.
   * - totalUsersDeltaPct: new signups last 7d vs previous 7d (not total user count).
   * - activeUsersDeltaPct: distinct active users last 24h vs prior 24h.
   * - highRiskUsersDeltaPct: HIGH risk rows with lastUpdated in last 7d vs previous 7d.
   * - totalAlertsDeltaPct: alerts created in last 7d vs previous 7d.
   */
  async getDashboardDeltas(): Promise<{
    totalUsersDeltaPct: number | null;
    activeUsersDeltaPct: number | null;
    highRiskUsersDeltaPct: number | null;
    totalAlertsDeltaPct: number | null;
  }> {
    const key = `kpi:dashboardDeltas:${ANALYTICS_CACHE_SCHEMA_VERSION}`;
    return this.readCache.getOrSet(key, () => this.computeDashboardDeltas());
  }

  private async computeDashboardDeltas(): Promise<{
    totalUsersDeltaPct: number | null;
    activeUsersDeltaPct: number | null;
    highRiskUsersDeltaPct: number | null;
    totalAlertsDeltaPct: number | null;
  }> {
    const now = Date.now();
    const ms24 = 24 * 60 * 60 * 1000;
    const ms7 = 7 * ms24;

    const [
      activeCurr,
      activePrev,
      newUsersCurr,
      newUsersPrev,
      alertsCurr,
      alertsPrev,
      highRiskCurr,
      highRiskPrev,
    ] = await Promise.all([
      this.countDistinctActiveUsers(new Date(now - ms24), new Date(now)),
      this.countDistinctActiveUsers(new Date(now - 2 * ms24), new Date(now - ms24)),
      this.userModel.countDocuments({
        createdAt: { $gte: new Date(now - ms7), $lte: new Date(now) },
      }),
      this.userModel.countDocuments({
        createdAt: { $gte: new Date(now - 2 * ms7), $lt: new Date(now - ms7) },
      }),
      this.alertModel.countDocuments({ createdAt: { $gte: new Date(now - ms7) } }),
      this.alertModel.countDocuments({
        createdAt: { $gte: new Date(now - 2 * ms7), $lt: new Date(now - ms7) },
      }),
      this.riskScoreModel.countDocuments({
        riskLevel: RiskLevel.HIGH,
        lastUpdated: { $gte: new Date(now - ms7) },
      }),
      this.riskScoreModel.countDocuments({
        riskLevel: RiskLevel.HIGH,
        lastUpdated: { $gte: new Date(now - 2 * ms7), $lt: new Date(now - ms7) },
      }),
    ]);

    return {
      totalUsersDeltaPct: this.deltaPct(newUsersPrev, newUsersCurr),
      activeUsersDeltaPct: this.deltaPct(activePrev, activeCurr),
      highRiskUsersDeltaPct: this.deltaPct(highRiskPrev, highRiskCurr),
      totalAlertsDeltaPct: this.deltaPct(alertsPrev, alertsCurr),
    };
  }

  /** Average risk score (0–100) across all risk score documents. */
  async getAverageRiskScorePercent(): Promise<number> {
    const key = `kpi:avgRiskPct:${ANALYTICS_CACHE_SCHEMA_VERSION}`;
    return this.readCache.getOrSet(key, () => this.computeAverageRiskScorePercent());
  }

  private async computeAverageRiskScorePercent(): Promise<number> {
    const agg = await this.riskScoreModel
      .aggregate([{ $group: { _id: null, avg: { $avg: '$score' } } }])
      .exec();
    const raw = agg[0]?.avg;
    if (raw == null || Number.isNaN(raw)) {
      return 0;
    }
    return Math.round(Number(raw));
  }

  private async countDistinctActiveUsers(from: Date, to: Date): Promise<number> {
    const ids = await this.activityModel.distinct('userId', {
      timestamp: { $gte: from, $lte: to },
    });
    return ids.length;
  }

  private deltaPct(previous: number, current: number): number | null {
    if (previous === 0 && current === 0) {
      return null;
    }
    if (previous === 0) {
      return current > 0 ? 100 : null;
    }
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }
}
