import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { RiskScore, RiskScoreDocument } from './schemas/riskscore.schema';
import { Alert, AlertDocument } from './schemas/alert.schema';
import { KpiService } from './services/kpi.service';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { AbTesting, AbTestingDocument } from './schemas/ab-testing.schema';
import { Activity, ActivityDocument } from '../activity/schemas/activity.schema';
import { SessionService } from '../activity/session.service';
import { PredictiveService } from './predictive.service';
import { InterventionService } from './intervention.service';
import { IntegrationService } from './integration.service';
import {
  ExplainabilityLog,
  ExplainabilityLogDocument,
} from './schemas/explainability.schema';
import { ActivityAction } from '../activity/schemas/activity.schema';
import {
  ANALYTICS_CACHE_SCHEMA_VERSION,
  AnalyticsReadCacheService,
} from './services/analytics-read-cache.service';

export interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  highRiskUsers: number;
  totalAlerts: number;
  /** Week-over-week new signups (last 7d vs previous 7d), percent. */
  totalUsersDeltaPct: number | null;
  /** Prior 24h vs previous 24h distinct active users, percent. */
  activeUsersDeltaPct: number | null;
  /** HIGH risk updates in last 7d vs previous 7d, percent. */
  highRiskUsersDeltaPct: number | null;
  /** Alerts created last 7d vs previous 7d, percent. */
  totalAlertsDeltaPct: number | null;
  /** Mean risk score 0–100 across riskscore documents. */
  averageRiskScore: number;
  /** Explainability logs + alerts created since UTC midnight today. */
  aiDecisionsToday: number;
}

export interface ActivityByHourResponse {
  hourLabels: string[];
  activityCounts: number[];
  sessionCounts: number[];
  /** UTC window for this series (drill-down / linking). */
  windowStartUtc?: string;
  windowEndUtc?: string;
}

export interface ActivityChannelSplitResponse {
  webPct: number;
  mobilePct: number;
  unknownPct: number;
  total: number;
}

export interface AiEventFeedItem {
  id: string;
  type: 'explainability' | 'alert' | 'risk';
  title: string;
  description: string;
  at: string;
  source: string;
}

export interface RiskTrendData {
  date: string;
  averageScore: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  criticalRiskCount?: number;
}

export interface RecentAlertData {
  _id: string;
  student: {
    _id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  instructor?: {
    _id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  message: string;
  severity: string;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterventionTrackingData {
  userId: string;
  name: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dropoutProbability: number;
  suggestions: string[];
  status: 'applied' | 'pending';
  interventionType?: string;
}

/** One row for instructor/admin “student risk” tables (matches frontend `StudentRiskListItem`). */
export interface StudentRiskListRow {
  userId: string;
  name: string;
  email: string;
  riskScore: number;
  riskLevel: string;
  alertStatus: 'Pending' | 'Reviewed' | 'Resolved';
  isOnline?: boolean;
}

export interface StudentEngagementScore {
  userId: string;
  engagementScore: number;
  level: 'low' | 'medium' | 'high';
}

export interface RetentionTrendPoint {
  date: string;
  activeUsers: number;
  returningUsers: number;
}

export interface RetentionAnalyticsResponse {
  totalUsers: number;
  retainedUsers: number;
  returningUsers: number;
  dropoutRate: number;
  trend: RetentionTrendPoint[];
}

export interface CohortAnalyticsRow {
  cohort: string;
  averageScore: number;
  averageRisk: number;
  engagementScore: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(RiskScore.name)
    private riskScoreModel: Model<RiskScoreDocument>,
    @InjectModel(Alert.name)
    private alertModel: Model<AlertDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(AbTesting.name)
    private abTestingModel: Model<AbTestingDocument>,
    @InjectModel(Activity.name)
    private activityModel: Model<ActivityDocument>,
    @InjectModel(ExplainabilityLog.name)
    private explainabilityLogModel: Model<ExplainabilityLogDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly readCache: AnalyticsReadCacheService,
    private kpiService: KpiService,
    private predictiveService: PredictiveService,
    private interventionService: InterventionService,
    private integrationService: IntegrationService,
    private readonly sessionService: SessionService,
  ) {}

  async getStudentEngagementScore(userId: string): Promise<StudentEngagementScore> {
    const unified = await this.integrationService.getUnifiedStudentAnalytics(userId);

    const activityFrequency = unified.activityMetrics.weeklyActivityFrequency;
    const gameSessions = unified.gameMetrics.sessionsPlayed;
    const exerciseCompletion = unified.performanceMetrics.completionRate;

    // Explainable weighted sum (Sprint 7):
    // (activity_frequency * 3) + (game_sessions * 2) + (exercise_completion * 4)
    const rawScore = activityFrequency * 3 + gameSessions * 2 + exerciseCompletion * 4;

    // Normalize with an explicit cap so score always remains in [0, 100].
    const engagementScore = this.clamp(Number(rawScore.toFixed(2)), 0, 100);

    return {
      userId,
      engagementScore,
      level: this.resolveEngagementLevel(engagementScore),
    };
  }

  async getRetentionAnalytics(days: number = 30): Promise<RetentionAnalyticsResponse> {
    const safeDays = Math.max(1, Math.min(days, 365));
    const now = new Date();
    const currentWindowStart = new Date(now);
    currentWindowStart.setHours(0, 0, 0, 0);
    currentWindowStart.setDate(currentWindowStart.getDate() - (safeDays - 1));

    const previousWindowStart = new Date(currentWindowStart);
    previousWindowStart.setDate(previousWindowStart.getDate() - safeDays);

    const [totalUsers, retentionFacetRows] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.activityModel
        .aggregate<{
          currentUsers: { _id: string }[];
          previousUsers: { _id: string }[];
          trend: { date: string; users: string[] }[];
        }>([
          {
            $match: {
              timestamp: {
                $gte: previousWindowStart,
                $lte: now,
              },
            },
          },
          {
            $project: {
              userId: { $toString: '$userId' },
              day: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$timestamp',
                },
              },
              period: {
                $cond: [{ $gte: ['$timestamp', currentWindowStart] }, 'current', 'previous'],
              },
            },
          },
          {
            $facet: {
              currentUsers: [
                { $match: { period: 'current' } },
                { $group: { _id: '$userId' } },
              ],
              previousUsers: [
                { $match: { period: 'previous' } },
                { $group: { _id: '$userId' } },
              ],
              trend: [
                { $match: { period: 'current' } },
                {
                  $group: {
                    _id: '$day',
                    users: { $addToSet: '$userId' },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    date: '$_id',
                    users: 1,
                  },
                },
                { $sort: { date: 1 } },
              ],
            },
          },
        ])
        .exec(),
    ]);

    const retentionFacet = retentionFacetRows[0] || {
      currentUsers: [],
      previousUsers: [],
      trend: [],
    };

    const currentSet = new Set(retentionFacet.currentUsers.map((row) => row._id));
    const previousSet = new Set(retentionFacet.previousUsers.map((row) => row._id));

    let returningUsers = 0;
    for (const userId of currentSet) {
      if (previousSet.has(userId)) {
        returningUsers += 1;
      }
    }

    const retainedUsers = currentSet.size;
    const dropoutRate =
      totalUsers > 0
        ? Number((((totalUsers - retainedUsers) / totalUsers) * 100).toFixed(2))
        : 0;

    const trend: RetentionTrendPoint[] = retentionFacet.trend.map((row) => {
      const activeUsers = row.users.length;
      const dailyReturningUsers = row.users.reduce((count, userId) => {
        return previousSet.has(userId) ? count + 1 : count;
      }, 0);

      return {
        date: row.date,
        activeUsers,
        returningUsers: dailyReturningUsers,
      };
    });

    return {
      totalUsers,
      retainedUsers,
      returningUsers,
      dropoutRate,
      trend,
    };
  }

  async getCohortAnalytics(): Promise<CohortAnalyticsRow[]> {
    const now = new Date();
    const activityWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const rows = await this.userModel
      .aggregate<CohortAnalyticsRow>([
        {
          $lookup: {
            from: 'riskscores',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$user', '$$userId'] },
                },
              },
              { $sort: { lastUpdated: -1, _id: -1 } },
              { $limit: 1 },
              { $project: { _id: 0, score: 1 } },
            ],
            as: 'latestRisk',
          },
        },
        {
          $lookup: {
            from: 'studentprofiles',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$userId', '$$userId'] },
                },
              },
              { $project: { _id: 0, academic_level: 1, points_gamification: 1 } },
              { $limit: 1 },
            ],
            as: 'profile',
          },
        },
        {
          $lookup: {
            from: 'activities',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$userId', '$$userId'] },
                  timestamp: { $gte: activityWindowStart },
                },
              },
              {
                $group: {
                  _id: null,
                  activityCount: { $sum: 1 },
                  quizCount: {
                    $sum: {
                      $cond: [{ $eq: ['$action', 'quiz_attempt'] }, 1, 0],
                    },
                  },
                },
              },
              { $project: { _id: 0, activityCount: 1, quizCount: 1 } },
            ],
            as: 'activityStats',
          },
        },
        {
          $project: {
            signupCohort: {
              $dateToString: {
                format: '%Y-%m',
                date: '$createdAt',
              },
            },
            courseCohort: {
              $ifNull: [{ $arrayElemAt: ['$profile.academic_level', 0] }, 'unknown-course'],
            },
            performanceScore: {
              $round: [
                {
                  $max: [
                    0,
                    {
                      $min: [
                        100,
                        {
                          $ifNull: [{ $arrayElemAt: ['$profile.points_gamification', 0] }, 0],
                        },
                      ],
                    },
                  ],
                },
                2,
              ],
            },
            riskScore: {
              $ifNull: [{ $arrayElemAt: ['$latestRisk.score', 0] }, 0],
            },
            engagementScore: {
              $round: [
                {
                  $min: [
                    100,
                    {
                      $add: [
                        {
                          $multiply: [
                            {
                              $ifNull: [{ $arrayElemAt: ['$activityStats.activityCount', 0] }, 0],
                            },
                            3,
                          ],
                        },
                        {
                          $multiply: [
                            {
                              $ifNull: [{ $arrayElemAt: ['$activityStats.quizCount', 0] }, 0],
                            },
                            4,
                          ],
                        },
                      ],
                    },
                  ],
                },
                2,
              ],
            },
          },
        },
        {
          $addFields: {
            performanceCohort: {
              $switch: {
                branches: [
                  { case: { $lt: ['$performanceScore', 35] }, then: 'low' },
                  { case: { $lt: ['$performanceScore', 70] }, then: 'medium' },
                ],
                default: 'high',
              },
            },
          },
        },
        {
          $facet: {
            bySignupDate: [
              {
                $group: {
                  _id: '$signupCohort',
                  averageScore: { $avg: '$performanceScore' },
                  averageRisk: { $avg: '$riskScore' },
                  engagementScore: { $avg: '$engagementScore' },
                },
              },
              {
                $project: {
                  _id: 0,
                  cohort: { $concat: ['signup:', '$_id'] },
                  averageScore: { $round: ['$averageScore', 2] },
                  averageRisk: { $round: ['$averageRisk', 2] },
                  engagementScore: { $round: ['$engagementScore', 2] },
                },
              },
            ],
            byCourse: [
              {
                $group: {
                  _id: '$courseCohort',
                  averageScore: { $avg: '$performanceScore' },
                  averageRisk: { $avg: '$riskScore' },
                  engagementScore: { $avg: '$engagementScore' },
                },
              },
              {
                $project: {
                  _id: 0,
                  cohort: { $concat: ['course:', '$_id'] },
                  averageScore: { $round: ['$averageScore', 2] },
                  averageRisk: { $round: ['$averageRisk', 2] },
                  engagementScore: { $round: ['$engagementScore', 2] },
                },
              },
            ],
            byPerformanceLevel: [
              {
                $group: {
                  _id: '$performanceCohort',
                  averageScore: { $avg: '$performanceScore' },
                  averageRisk: { $avg: '$riskScore' },
                  engagementScore: { $avg: '$engagementScore' },
                },
              },
              {
                $project: {
                  _id: 0,
                  cohort: { $concat: ['performance:', '$_id'] },
                  averageScore: { $round: ['$averageScore', 2] },
                  averageRisk: { $round: ['$averageRisk', 2] },
                  engagementScore: { $round: ['$engagementScore', 2] },
                },
              },
            ],
          },
        },
        {
          $project: {
            merged: {
              $concatArrays: ['$bySignupDate', '$byCourse', '$byPerformanceLevel'],
            },
          },
        },
        { $unwind: '$merged' },
        { $replaceRoot: { newRoot: '$merged' } },
        { $sort: { cohort: 1 } },
      ])
      .exec();

    return rows;
  }

  /**
   * Get dashboard summary data
   * Aggregates key metrics for dashboard display
   */
  async getDashboardData(viewerRole: UserRole = UserRole.INSTRUCTOR): Promise<DashboardData> {
    const scope = viewerRole === UserRole.ADMIN ? 'allUsers' : 'students';
    const [kpis, deltas, averageRiskScore, aiDecisionsToday] = await Promise.all([
      this.kpiService.getAllKpis(scope),
      this.kpiService.getDashboardDeltas(scope),
      this.kpiService.getAverageRiskScorePercent(),
      this.readCache.getOrSet(
        `analytics:aiDecisionsToday:${ANALYTICS_CACHE_SCHEMA_VERSION}`,
        () => this.countAiDecisionsToday(),
      ),
    ]);

    return {
      totalUsers: kpis.totalUsers.value,
      activeUsers: kpis.activeUsers.value,
      highRiskUsers: kpis.highRiskUsers.value,
      totalAlerts: kpis.totalAlerts.value,
      totalUsersDeltaPct: deltas.totalUsersDeltaPct,
      activeUsersDeltaPct: deltas.activeUsersDeltaPct,
      highRiskUsersDeltaPct: deltas.highRiskUsersDeltaPct,
      totalAlertsDeltaPct: deltas.totalAlertsDeltaPct,
      averageRiskScore,
      aiDecisionsToday,
    };
  }

  /** Mongo ping + cache stats (memory + optional Redis) for ops dashboards. */
  async getAnalyticsHealth(): Promise<{
    ok: boolean;
    mongo: { ok: boolean; error?: string };
    cache: {
      entryCount: number;
      ttlMs: number;
      schemaVersion: string;
      redisEnabled: boolean;
    };
  }> {
    let mongoOk = false;
    let mongoError: string | undefined;
    try {
      if (this.connection.readyState === 1 && this.connection.db) {
        await this.connection.db.admin().ping();
        mongoOk = true;
      } else {
        mongoError = `MongoDB not connected (readyState=${this.connection.readyState})`;
      }
    } catch (e: unknown) {
      mongoError = e instanceof Error ? e.message : String(e);
    }
    return {
      ok: mongoOk,
      mongo: { ok: mongoOk, error: mongoError },
      cache: this.readCache.getStats(),
    };
  }

  /** Explainability + alerts since UTC midnight (for “AI decisions today”). */
  private async countAiDecisionsToday(): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const [logs, alerts] = await Promise.all([
      this.explainabilityLogModel.countDocuments({ createdAt: { $gte: start } }).exec(),
      this.alertModel.countDocuments({ createdAt: { $gte: start } }).exec(),
    ]);
    return logs + alerts;
  }

  /**
   * Hourly activity buckets (UTC). Default: last 24h rolling.
   * Optional `start` / `end` ISO strings: UTC-aligned window, max 7 days, for drill-down.
   */
  async getActivityByHour(startIso?: string, endIso?: string): Promise<ActivityByHourResponse> {
    const range = this.parseActivityByHourRange(startIso, endIso);
    const key = range
      ? `analytics:activityByHour:${range.start.getTime()}:${range.end.getTime()}:${ANALYTICS_CACHE_SCHEMA_VERSION}`
      : `analytics:activityByHour:${ANALYTICS_CACHE_SCHEMA_VERSION}`;
    return this.readCache.getOrSet(key, () => this.computeActivityByHour(range));
  }

  private parseActivityByHourRange(
    startIso?: string,
    endIso?: string,
  ): { start: Date; end: Date } | undefined {
    if (!startIso?.trim() || !endIso?.trim()) {
      return undefined;
    }
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return undefined;
    }
    let a = this.alignUtcHour(start);
    let b = this.alignUtcHour(end);
    if (a.getTime() >= b.getTime()) {
      b = new Date(a.getTime() + 60 * 60 * 1000);
    }
    const maxSpan = 7 * 24 * 60 * 60 * 1000;
    if (b.getTime() - a.getTime() > maxSpan) {
      a = new Date(b.getTime() - maxSpan);
    }
    return { start: a, end: b };
  }

  private alignUtcHour(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0));
  }

  private async computeActivityByHour(range?: { start: Date; end: Date }): Promise<ActivityByHourResponse> {
    const now = new Date();
    const hourMs = 60 * 60 * 1000;
    let bucketStart: Date;
    let bucketCount: number;
    let matchUpper: Date;

    if (!range) {
      const end = this.alignUtcHour(now);
      bucketStart = new Date(end.getTime() - 24 * hourMs);
      bucketCount = 24;
      matchUpper = now;
    } else {
      bucketStart = range.start;
      const spanHours = Math.round((range.end.getTime() - range.start.getTime()) / hourMs);
      bucketCount = Math.min(168, Math.max(1, spanHours));
      matchUpper = new Date(Math.min(now.getTime(), bucketStart.getTime() + bucketCount * hourMs));
    }

    const rows = await this.activityModel
      .aggregate<{
        _id: string;
        activityCounts: number;
        sessionCounts: number;
      }>([
        {
          $match: {
            timestamp: { $gte: bucketStart, $lte: matchUpper },
          },
        },
        {
          $project: {
            key: {
              $concat: [
                { $dateToString: { format: '%Y-%m-%dT', date: '$timestamp', timezone: 'UTC' } },
                { $dateToString: { format: '%H', date: '$timestamp', timezone: 'UTC' } },
              ],
            },
            isLogin: { $eq: ['$action', ActivityAction.LOGIN] },
          },
        },
        {
          $group: {
            _id: '$key',
            activityCounts: { $sum: 1 },
            sessionCounts: { $sum: { $cond: ['$isLogin', 1, 0] } },
          },
        },
      ])
      .exec();

    const map = new Map(rows.map((r) => [r._id, r]));
    const hourLabels: string[] = [];
    const activityCounts: number[] = [];
    const sessionCounts: number[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const slot = new Date(bucketStart.getTime() + i * hourMs);
      const slotKey = this.hourKeyUTC(slot);
      hourLabels.push(`${String(slot.getUTCHours()).padStart(2, '0')}:00`);
      const row = map.get(slotKey);
      activityCounts.push(row?.activityCounts ?? 0);
      sessionCounts.push(row?.sessionCounts ?? 0);
    }

    const windowEndUtc = new Date(bucketStart.getTime() + bucketCount * hourMs);

    return {
      hourLabels,
      activityCounts,
      sessionCounts,
      windowStartUtc: bucketStart.toISOString(),
      windowEndUtc: windowEndUtc.toISOString(),
    };
  }

  /** Web vs mobile vs unknown share of activity in the last 7 days. */
  async getActivityChannelSplit(): Promise<ActivityChannelSplitResponse> {
    const key = `analytics:channelSplit:${ANALYTICS_CACHE_SCHEMA_VERSION}`;
    return this.readCache.getOrSet(key, () => this.computeActivityChannelSplit());
  }

  private async computeActivityChannelSplit(): Promise<ActivityChannelSplitResponse> {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await this.activityModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { timestamp: { $gte: from } } },
        {
          $group: {
            _id: { $ifNull: ['$channel', 'unknown'] },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    let web = 0;
    let mobile = 0;
    let unknown = 0;
    for (const r of rows) {
      if (r._id === 'web') {
        web += r.count;
      } else if (r._id === 'mobile') {
        mobile += r.count;
      } else {
        unknown += r.count;
      }
    }
    const total = web + mobile + unknown;
    if (total === 0) {
      return { webPct: 0, mobilePct: 0, unknownPct: 100, total: 0 };
    }
    return {
      webPct: Math.round((web / total) * 1000) / 10,
      mobilePct: Math.round((mobile / total) * 1000) / 10,
      unknownPct: Math.round((unknown / total) * 1000) / 10,
      total,
    };
  }

  /** Merged explainability, alerts, and recent risk updates for the admin feed. */
  async getAiEventsFeed(limit: number = 20): Promise<AiEventFeedItem[]> {
    const safe = Math.min(Math.max(1, limit), 50);
    const key = `analytics:aiEventsFeed:${ANALYTICS_CACHE_SCHEMA_VERSION}:${safe}`;
    return this.readCache.getOrSet(key, () => this.computeAiEventsFeed(safe));
  }

  private async computeAiEventsFeed(safe: number): Promise<AiEventFeedItem[]> {
    const [logs, alerts, risks] = await Promise.all([
      this.explainabilityLogModel
        .find()
        .sort({ createdAt: -1, _id: -1 })
        .limit(safe)
        .lean<ExplainabilityLog[]>()
        .exec(),
      this.alertModel
        .find()
        .sort({ createdAt: -1, _id: -1 })
        .limit(safe)
        .populate('student', 'first_name last_name email')
        .lean()
        .exec(),
      this.riskScoreModel
        .find()
        .sort({ lastUpdated: -1, _id: -1 })
        .limit(safe)
        .lean()
        .exec(),
    ]);

    const riskUserIds = (risks as any[])
      .map((r) => String(r?.user || '').trim())
      .filter((id) => Types.ObjectId.isValid(id));
    const riskUsers = riskUserIds.length
      ? await this.userModel
          .find({ _id: { $in: riskUserIds.map((id) => new Types.ObjectId(id)) } })
          .select('first_name last_name email')
          .lean<UserDocument[]>()
          .exec()
      : [];
    const riskUserMap = new Map(riskUsers.map((u: any) => [String(u._id), u]));

    const merged: AiEventFeedItem[] = [];

    for (const log of logs) {
      const id = String((log as any)._id);
      merged.push({
        id: `exp-${id}`,
        type: 'explainability',
        title: log.decision || 'Explainability decision',
        description: (log.explanation || '').slice(0, 280),
        at: (log.createdAt ? new Date(log.createdAt) : new Date()).toISOString(),
        source: 'Explainability',
      });
    }

    for (const alert of alerts as any[]) {
      merged.push({
        id: `al-${alert._id}`,
        type: 'alert',
        title: 'Risk / system alert',
        description: alert.message || '',
        at: (alert.createdAt ? new Date(alert.createdAt) : new Date()).toISOString(),
        source: 'Alerts',
      });
    }

    for (const r of risks as any[]) {
      const u: any = riskUserMap.get(String(r.user)) || null;
      const name = u
        ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
        : String(r.user);
      merged.push({
        id: `risk-${r._id}`,
        type: 'risk',
        title: 'Risk score updated',
        description: `${name}: score ${Math.round(r.score)} (${r.riskLevel})`,
        at: (r.lastUpdated ? new Date(r.lastUpdated) : new Date()).toISOString(),
        source: 'Risk',
      });
    }

    merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return merged.slice(0, safe);
  }

  private hourKeyUTC(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}`;
  }

  /**
   * Get risk score trends over time
   * Returns aggregated risk data grouped by date
   * @param days Number of days to look back (default: 30)
   */
  async getRiskTrends(days: number = 30): Promise<RiskTrendData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await this.riskScoreModel.aggregate([
      {
        $match: {
          lastUpdated: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$lastUpdated',
            },
          },
          averageScore: { $avg: '$score' },
          scores: { $push: '$score' },
          riskLevels: { $push: '$riskLevel' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          averageScore: { $round: ['$averageScore', 2] },
          highRiskCount: {
            $size: {
              $filter: {
                input: '$riskLevels',
                as: 'level',
                cond: { $eq: [{ $toLower: '$$level' }, 'high'] },
              },
            },
          },
          criticalRiskCount: {
            $size: {
              $filter: {
                input: '$riskLevels',
                as: 'level',
                cond: { $eq: [{ $toLower: '$$level' }, 'critical'] },
              },
            },
          },
          mediumRiskCount: {
            $size: {
              $filter: {
                input: '$riskLevels',
                as: 'level',
                cond: { $eq: [{ $toLower: '$$level' }, 'medium'] },
              },
            },
          },
          lowRiskCount: {
            $size: {
              $filter: {
                input: '$riskLevels',
                as: 'level',
                cond: { $eq: [{ $toLower: '$$level' }, 'low'] },
              },
            },
          },
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    return trends;
  }

  /**
   * Get recent alerts
   * Returns the most recent alerts with populated user data
   * @param limit Number of alerts to return (default: 10)
   */
  async getRecentAlerts(limit: number = 10): Promise<RecentAlertData[]> {
    const alerts = await this.alertModel
      .find()
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return alerts.map((alert: any) => ({
      _id: alert._id.toString(),
      student: alert.student,
      instructor: alert.instructor,
      message: alert.message,
      severity: alert.severity,
      resolved: alert.resolved,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    }));
  }

  /**
   * Latest risk score per student + unresolved alert flag (for dashboards).
   */
  async getStudentRiskList(): Promise<StudentRiskListRow[]> {
    const onlineUserIds = await this.sessionService.getOnlineUserIdSet('students');
    const riskScores = await this.riskScoreModel
      .find()
      .sort({ lastUpdated: -1, _id: -1 })
      .lean<RiskScoreDocument[]>()
      .exec();

    const latestRiskByUser = new Map<string, RiskScoreDocument>();
    for (const risk of riskScores) {
      const riskUserId = String(risk.user);
      if (!latestRiskByUser.has(riskUserId)) {
        latestRiskByUser.set(riskUserId, risk);
      }
    }

    const unresolved = await this.alertModel
      .find({ resolved: false })
      .select('student userId')
      .lean()
      .exec();

    const pendingByUser = new Set<string>();
    for (const a of unresolved as Array<{ student?: unknown; userId?: unknown }>) {
      const sid = a.student != null ? String(a.student) : a.userId != null ? String(a.userId) : '';
      if (sid) {
        pendingByUser.add(sid);
      }
    }

    const userIds = Array.from(latestRiskByUser.keys());
    const validObjectIds = userIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const users =
      validObjectIds.length > 0
        ? await this.userModel
            .find({ _id: { $in: validObjectIds } })
            .select('first_name last_name email')
            .lean<UserDocument[]>()
            .exec()
        : [];

    const userMap = new Map<string, UserDocument>();
    for (const u of users) {
      userMap.set(String((u as any)._id), u);
    }

    return userIds.map((userId) => {
      const risk = latestRiskByUser.get(userId)!;
      const u = userMap.get(userId);
      const name = u
        ? `${(u as any).first_name || ''} ${(u as any).last_name || ''}`.trim() || 'Unknown Student'
        : 'Unknown Student';
      return {
        userId,
        name,
        email: (u as any)?.email || 'N/A',
        riskScore: Number(risk.score ?? 0),
        riskLevel: String(risk.riskLevel ?? '').toLowerCase(),
        alertStatus: pendingByUser.has(userId) ? 'Pending' : 'Resolved',
        isOnline: onlineUserIds.has(userId),
      };
    });
  }

  /** Same data as `GET /api/analytics/kpis/risk-distribution` (alias for the Angular client). */
  async getRiskDistributionDashboard() {
    return this.kpiService.getRiskDistribution();
  }

  async getInterventions(limit: number = 200): Promise<InterventionTrackingData[]> {
    const riskScores = await this.riskScoreModel
      .find()
      .sort({ lastUpdated: -1, _id: -1 })
      .lean<RiskScoreDocument[]>()
      .exec();

    const latestRiskByUser = new Map<string, RiskScoreDocument>();
    for (const risk of riskScores) {
      const riskUserId = String(risk.user);
      if (!latestRiskByUser.has(riskUserId)) {
        latestRiskByUser.set(riskUserId, risk);
      }
    }

    const userIds = Array.from(latestRiskByUser.keys());
    if (userIds.length === 0) {
      return [];
    }

    const validObjectIds = userIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const [users, abRecords] = await Promise.all([
      validObjectIds.length > 0
        ? this.userModel
            .find({ _id: { $in: validObjectIds } })
            .select('first_name last_name')
            .lean<UserDocument[]>()
            .exec()
        : Promise.resolve([] as UserDocument[]),
      validObjectIds.length > 0
        ? this.abTestingModel
            .find({ userId: { $in: userIds } })
            .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
            .lean<AbTestingDocument[]>()
            .exec()
        : Promise.resolve([] as AbTestingDocument[]),
    ]);

    const userMap = new Map<string, UserDocument>();
    for (const user of users) {
      userMap.set(String((user as any)._id), user);
    }

    const abTestingMap = new Map<string, AbTestingDocument>();
    for (const row of abRecords) {
      const key = String(row.userId);
      if (!abTestingMap.has(key)) {
        abTestingMap.set(key, row);
      }
    }

    const rows = await Promise.all(
      userIds.map(async (userId) => {
        const risk = latestRiskByUser.get(userId);
        const user = userMap.get(userId);
        const behaviorData = await this.buildBehaviorData(userId);
        const prediction = this.predictiveService.predictDropoutRisk(behaviorData);
        const riskLevel = (String(risk?.riskLevel || prediction.level || 'medium').toLowerCase() ||
          'medium') as 'low' | 'medium' | 'high' | 'critical';
        const suggestions = this.interventionService.generateInterventionSuggestions(
          behaviorData,
          riskLevel === 'critical' ? 'high' : (riskLevel as 'low' | 'medium' | 'high'),
          prediction,
        ).suggestions;
        const abRecord = abTestingMap.get(userId);

        return {
          userId,
          name: user
            ? `${(user as any).first_name || ''} ${(user as any).last_name || ''}`.trim() || 'Unknown Student'
            : 'Unknown Student',
          riskLevel,
          dropoutProbability: prediction.probability,
          suggestions: this.mergeInterventionSuggestions(abRecord?.intervention, suggestions),
          // Status is automated only: "applied" means intervention was actually delivered
          // by automation (daily reminder or weekly plan) and/or tracked by checkpoints.
          interventionType: String((risk as any)?.interventionType || '').trim() || undefined,
          status: this.resolveAutomatedInterventionStatus(abRecord),
        } as InterventionTrackingData;
      }),
    );

    const orderedRows = rows.sort((a, b) => b.dropoutProbability - a.dropoutProbability);
    return orderedRows.slice(0, Math.max(1, Math.min(limit, 500)));
  }

  private async buildBehaviorData(
    userId: string,
  ): Promise<{ inactivity_days: number; engagement_level: number; activity_frequency: number }> {
    if (!Types.ObjectId.isValid(userId)) {
      return { inactivity_days: 14, engagement_level: 0.2, activity_frequency: 0 };
    }

    const objectId = new Types.ObjectId(userId);
    const now = new Date();
    const recentWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [latestActivity, recentActivityCount] = await Promise.all([
      this.activityModel
        .findOne({ userId: objectId })
        .sort({ timestamp: -1, _id: -1 })
        .lean<ActivityDocument>()
        .exec(),
      this.activityModel
        .countDocuments({
          userId: objectId,
          timestamp: { $gte: recentWindowStart },
        })
        .exec(),
    ]);

    const inactivityDays = latestActivity?.timestamp
      ? Math.max(
          0,
          Math.floor((now.getTime() - new Date(latestActivity.timestamp).getTime()) / (1000 * 60 * 60 * 24)),
        )
      : 14;

    const activityFrequency = Number((recentActivityCount / 7).toFixed(2));
    const engagementLevel = Number(Math.min(1, Math.max(0, recentActivityCount / 14)).toFixed(2));

    return {
      inactivity_days: inactivityDays,
      engagement_level: engagementLevel,
      activity_frequency: activityFrequency,
    };
  }

  private resolveEngagementLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 70) {
      return 'high';
    }
    if (score >= 35) {
      return 'medium';
    }
    return 'low';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private mergeInterventionSuggestions(primary: string | undefined, fallback: string[]): string[] {
    const merged = new Set<string>();
    const first = String(primary || '').trim();
    if (first) {
      merged.add(first);
    }
    for (const suggestion of fallback || []) {
      const value = String(suggestion || '').trim();
      if (value) {
        merged.add(value);
      }
    }
    return Array.from(merged);
  }

  private resolveAutomatedInterventionStatus(row: AbTestingDocument | undefined): 'applied' | 'pending' {
    if (!row) {
      return 'pending';
    }

    const anyRow = row as any;
    const hasAutomatedDelivery = Boolean(anyRow.lastReminderAt || anyRow.lastPlanAt);
    const hasTrackedCheckpoint = Array.isArray(anyRow.checkpoints) && anyRow.checkpoints.length > 0;
    return hasAutomatedDelivery || hasTrackedCheckpoint ? 'applied' : 'pending';
  }
}
