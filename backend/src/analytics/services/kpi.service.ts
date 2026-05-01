import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole, UserStatus } from '../../users/schemas/user.schema';
import { SessionService } from '../../activity/session.service';
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
  critical: number;
  lowPercentage: number;
  mediumPercentage: number;
  highPercentage: number;
  criticalPercentage: number;
  total: number;
  timestamp: Date;
}

@Injectable()
export class KpiService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RiskScore.name) private riskScoreModel: Model<RiskScoreDocument>,
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    private readonly readCache: AnalyticsReadCacheService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Calculate total number of users in the system
   */
  async getTotalUsers(scope: 'students' | 'allUsers' = 'students'): Promise<KpiResult> {
    const total =
      scope === 'students'
        ? await this.userModel
            .countDocuments({
              role: UserRole.STUDENT,
              status: UserStatus.ACTIVE,
            })
            .exec()
        : await this.userModel.countDocuments().exec();
    
    return {
      value: total,
      label: scope === 'students' ? 'Total Students' : 'Total Users',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate number of active users (activity in last 24 hours)
   */
  async getActiveUsers(scope: 'students' | 'allUsers' = 'students'): Promise<KpiResult> {
    const count = await this.sessionService.countOnlineUsers(scope);

    return {
      value: count,
      label: scope === 'students' ? 'Active Students (24h)' : 'Active Users (24h)',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate number of high-risk users
   */
  async getHighRiskUsers(): Promise<KpiResult> {
    const latestByStudent = await this.getLatestRiskRowsForActiveStudents();
    const highRiskCount = latestByStudent.filter(
      (row) => row.riskLevel === RiskLevel.HIGH || row.riskLevel === RiskLevel.CRITICAL,
    ).length;
    
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
    const distribution = await this.getLatestRiskDistributionForActiveStudents();

    // Initialize counts
    let lowCount = 0;
    let mediumCount = 0;
    let highCount = 0;
    let criticalCount = 0;

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
        case RiskLevel.CRITICAL:
          criticalCount = item.count;
          break;
      }
    });

    const total = lowCount + mediumCount + highCount + criticalCount;

    // Calculate percentages (avoid division by zero)
    const lowPercentage = total > 0 ? Math.round((lowCount / total) * 100) : 0;
    const mediumPercentage = total > 0 ? Math.round((mediumCount / total) * 100) : 0;
    const highPercentage = total > 0 ? Math.round((highCount / total) * 100) : 0;
    const criticalPercentage = total > 0 ? Math.round((criticalCount / total) * 100) : 0;

    return {
      low: lowCount,
      medium: mediumCount,
      high: highCount,
      critical: criticalCount,
      lowPercentage,
      mediumPercentage,
      highPercentage,
      criticalPercentage,
      total,
      timestamp: new Date(),
    };
  }

  /**
   * Get all KPIs at once for dashboard efficiency
   */
  async getAllKpis(scope: 'students' | 'allUsers' = 'students') {
    const key = `kpi:allKpis:${scope}:${ANALYTICS_CACHE_SCHEMA_VERSION}`;
    return this.readCache.getOrSet(key, () => this.computeAllKpis(scope));
  }

  private async computeAllKpis(scope: 'students' | 'allUsers') {
    const [totalUsers, activeUsers, highRiskUsers, totalAlerts, riskDistribution] =
      await Promise.all([
        this.getTotalUsers(scope),
        this.getActiveUsers(scope),
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
  async getDashboardDeltas(scope: 'students' | 'allUsers' = 'students'): Promise<{
    totalUsersDeltaPct: number | null;
    activeUsersDeltaPct: number | null;
    highRiskUsersDeltaPct: number | null;
    totalAlertsDeltaPct: number | null;
  }> {
    const key = `kpi:dashboardDeltas:${scope}:${ANALYTICS_CACHE_SCHEMA_VERSION}`;
    return this.readCache.getOrSet(key, () => this.computeDashboardDeltas(scope));
  }

  private async computeDashboardDeltas(scope: 'students' | 'allUsers'): Promise<{
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
      this.countDistinctActiveUsers(new Date(now - ms24), new Date(now), scope),
      this.countDistinctActiveUsers(new Date(now - 2 * ms24), new Date(now - ms24), scope),
      this.userModel.countDocuments({
        ...(scope === 'students'
          ? { role: UserRole.STUDENT, status: UserStatus.ACTIVE }
          : {}),
        createdAt: { $gte: new Date(now - ms7), $lte: new Date(now) },
      }),
      this.userModel.countDocuments({
        ...(scope === 'students'
          ? { role: UserRole.STUDENT, status: UserStatus.ACTIVE }
          : {}),
        createdAt: { $gte: new Date(now - 2 * ms7), $lt: new Date(now - ms7) },
      }),
      this.alertModel.countDocuments({ createdAt: { $gte: new Date(now - ms7) } }),
      this.alertModel.countDocuments({
        createdAt: { $gte: new Date(now - 2 * ms7), $lt: new Date(now - ms7) },
      }),
      this.riskScoreModel.countDocuments({
        riskLevel: { $in: [RiskLevel.HIGH, RiskLevel.CRITICAL, 'HIGH', 'CRITICAL'] },
        lastUpdated: { $gte: new Date(now - ms7) },
      }),
      this.riskScoreModel.countDocuments({
        riskLevel: { $in: [RiskLevel.HIGH, RiskLevel.CRITICAL, 'HIGH', 'CRITICAL'] },
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
    const latestByStudent = await this.getLatestRiskRowsForActiveStudents();
    if (latestByStudent.length === 0) {
      return 0;
    }
    const total = latestByStudent.reduce((sum, row) => sum + Number(row.score || 0), 0);
    const raw = total / latestByStudent.length;
    if (raw == null || Number.isNaN(raw)) {
      return 0;
    }
    return Math.round(Number(raw));
  }

  private async countDistinctActiveUsers(from: Date, to: Date, scope: 'students' | 'allUsers'): Promise<number> {
    return this.sessionService.countUsersSeenInWindow(from, to, scope);
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

  private async getLatestRiskRowsForActiveStudents(): Promise<Array<{ riskLevel: RiskLevel; score: number }>> {
    const [activeStudents, latestRows] = await Promise.all([
      this.userModel
        .find({ role: UserRole.STUDENT, status: UserStatus.ACTIVE })
        .select('_id')
        .lean<UserDocument[]>()
        .exec(),
      this.riskScoreModel
        .aggregate<{ userId: string; riskLevel: RiskLevel; score: number }>([
          { $sort: { lastUpdated: -1, _id: -1 } },
          {
            $group: {
              _id: '$user',
              riskLevel: { $first: { $toLower: '$riskLevel' } },
              score: { $first: '$score' },
            },
          },
          {
            $project: {
              _id: 0,
              userId: { $toString: '$_id' },
              riskLevel: 1,
              score: 1,
            },
          },
        ])
        .exec(),
    ]);

    const activeStudentIds = new Set(activeStudents.map((student: any) => String(student._id)));
    return latestRows
      .filter((row) => activeStudentIds.has(String(row.userId)))
      .map((row) => ({
        riskLevel: row.riskLevel,
        score: Number(row.score || 0),
      }));
  }

  private async getLatestRiskDistributionForActiveStudents(): Promise<
    Array<{
      _id: RiskLevel;
      count: number;
    }>
  > {
    const latestRows = await this.getLatestRiskRowsForActiveStudents();
    const bucket = new Map<RiskLevel, number>([
      [RiskLevel.LOW, 0],
      [RiskLevel.MEDIUM, 0],
      [RiskLevel.HIGH, 0],
      [RiskLevel.CRITICAL, 0],
    ]);

    for (const row of latestRows) {
      const level = row.riskLevel;
      if (bucket.has(level)) {
        bucket.set(level, (bucket.get(level) || 0) + 1);
      }
    }

    return [
      { _id: RiskLevel.LOW, count: bucket.get(RiskLevel.LOW) || 0 },
      { _id: RiskLevel.MEDIUM, count: bucket.get(RiskLevel.MEDIUM) || 0 },
      { _id: RiskLevel.HIGH, count: bucket.get(RiskLevel.HIGH) || 0 },
      { _id: RiskLevel.CRITICAL, count: bucket.get(RiskLevel.CRITICAL) || 0 },
    ];
  }
}
