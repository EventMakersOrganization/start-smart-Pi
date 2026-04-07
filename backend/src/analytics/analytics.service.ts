import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RiskScore, RiskScoreDocument } from './schemas/riskscore.schema';
import { Alert, AlertDocument } from './schemas/alert.schema';
import { KpiService } from './services/kpi.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AbTesting, AbTestingDocument } from './schemas/ab-testing.schema';
import { Activity, ActivityDocument } from '../activity/schemas/activity.schema';
import { PredictiveService } from './predictive.service';
import { InterventionService } from './intervention.service';
import { IntegrationService } from './integration.service';

export interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  highRiskUsers: number;
  totalAlerts: number;
}

export interface RiskTrendData {
  date: string;
  averageScore: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
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
  riskLevel: 'low' | 'medium' | 'high';
  dropoutProbability: number;
  suggestions: string[];
  status: 'applied' | 'pending';
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
    private kpiService: KpiService,
    private predictiveService: PredictiveService,
    private interventionService: InterventionService,
    private integrationService: IntegrationService,
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
  async getDashboardData(): Promise<DashboardData> {
    const kpis = await this.kpiService.getAllKpis();
    
    return {
      totalUsers: kpis.totalUsers.value,
      activeUsers: kpis.activeUsers.value,
      highRiskUsers: kpis.highRiskUsers.value,
      totalAlerts: kpis.totalAlerts.value,
    };
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
                cond: { $eq: ['$$level', 'HIGH'] },
              },
            },
          },
          mediumRiskCount: {
            $size: {
              $filter: {
                input: '$riskLevels',
                as: 'level',
                cond: { $eq: ['$$level', 'MEDIUM'] },
              },
            },
          },
          lowRiskCount: {
            $size: {
              $filter: {
                input: '$riskLevels',
                as: 'level',
                cond: { $eq: ['$$level', 'LOW'] },
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
        const riskLevel = (risk?.riskLevel || prediction.level || 'medium') as 'low' | 'medium' | 'high';
        const suggestions = this.interventionService.generateInterventionSuggestions(
          behaviorData,
          riskLevel,
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
          suggestions,
          status: abRecord?.outcome?.trim() ? 'applied' : 'pending',
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
}
