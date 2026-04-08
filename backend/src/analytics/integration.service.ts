import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { RiskScore, RiskScoreDocument } from './schemas/riskscore.schema';
import { Activity, ActivityAction, ActivityDocument } from '../activity/schemas/activity.schema';
import {
  StudentProfile,
  StudentProfileDocument,
} from '../users/schemas/student-profile.schema';

export interface UnifiedAnalyticsResponse {
  userId: string;
  riskScore: {
    score: number;
    riskLevel: string;
    lastUpdated: Date | null;
  };
  activityMetrics: {
    totalActivities: number;
    weeklyActivityFrequency: number;
    quizAttempts: number;
    lastActivityAt: Date | null;
  };
  performanceMetrics: {
    averageScore: number;
    completionRate: number;
    academicLevel: string;
    profileRiskLevel: string;
    gamificationPoints: number;
    lastUpdated: Date | null;
    source: string;
  };
  gameMetrics: {
    sessionsPlayed: number;
    averageGameScore: number;
    currentStreak: number;
    highestLevel: number;
    points: number;
    lastPlayedAt: Date | null;
    source: string;
  };
}

@Injectable()
export class IntegrationService {
  constructor(
    @InjectModel(RiskScore.name)
    private readonly riskScoreModel: Model<RiskScoreDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(StudentProfile.name)
    private readonly studentProfileModel: Model<StudentProfileDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async getUnifiedStudentAnalytics(userId: string): Promise<UnifiedAnalyticsResponse> {
    const userFilter = this.buildFlexibleUserFilter(userId, ['user']);
    const activityFilter = this.buildFlexibleUserFilter(userId, ['userId']);
    const profileFilter = this.buildFlexibleUserFilter(userId, ['userId']);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [latestRisk, totalActivities, weeklyActivities, quizAttempts, latestActivity, profile] =
      await Promise.all([
        this.riskScoreModel
          .findOne(userFilter)
          .sort({ lastUpdated: -1, _id: -1 })
          .lean<RiskScoreDocument | null>()
          .exec(),
        this.activityModel.countDocuments(activityFilter).exec(),
        this.activityModel
          .countDocuments({ ...activityFilter, timestamp: { $gte: weekAgo } })
          .exec(),
        this.activityModel
          .countDocuments({ ...activityFilter, action: ActivityAction.QUIZ_ATTEMPT })
          .exec(),
        this.activityModel
          .findOne(activityFilter)
          .sort({ timestamp: -1, _id: -1 })
          .lean<ActivityDocument | null>()
          .exec(),
        this.studentProfileModel.findOne(profileFilter).lean<StudentProfileDocument | null>().exec(),
      ]);

    const performanceCollections = [
      'studentperformances',
      'student_performances',
      'studentperformance',
      'performance_metrics',
    ];
    const gameCollections = ['brainrush', 'brainrushes', 'brain_rush', 'game_results', 'gameresults'];

    const [performanceData, gameData] = await Promise.all([
      this.getDocumentsFromFirstExistingCollection(
        performanceCollections,
        this.buildFlexibleUserFilter(userId, ['userId', 'user', 'studentId']),
        50,
      ),
      this.getDocumentsFromFirstExistingCollection(
        gameCollections,
        this.buildFlexibleUserFilter(userId, ['userId', 'user', 'playerId', 'studentId']),
        100,
      ),
    ]);

    const performanceRows = performanceData.documents;
    const gameRows = gameData.documents;

    const performanceAverage = this.average(
      performanceRows
        .map((row) => this.readNumber(row, ['averageScore', 'avgScore', 'score', 'performanceScore', 'quizAverage']))
        .filter((value) => value !== null) as number[],
    );
    const completionRate = this.average(
      performanceRows
        .map((row) => this.readNumber(row, ['completionRate', 'progress', 'completion']))
        .filter((value) => value !== null) as number[],
    );

    const gameScores = gameRows
      .map((row) => this.readNumber(row, ['score', 'gameScore', 'points', 'resultScore']))
      .filter((value) => value !== null) as number[];
    const levelValues = gameRows
      .map((row) => this.readNumber(row, ['level', 'levelReached', 'highestLevel']))
      .filter((value) => value !== null) as number[];

    const latestPerformance = performanceRows[0] || null;
    const latestGame = gameRows[0] || null;

    return {
      userId,
      riskScore: {
        score: latestRisk?.score ?? 0,
        riskLevel: latestRisk?.riskLevel ?? 'unknown',
        lastUpdated: latestRisk?.lastUpdated ?? null,
      },
      activityMetrics: {
        totalActivities,
        weeklyActivityFrequency: Number((weeklyActivities / 7).toFixed(2)),
        quizAttempts,
        lastActivityAt: latestActivity?.timestamp ?? null,
      },
      performanceMetrics: {
        averageScore: Number((performanceAverage ?? 0).toFixed(2)),
        completionRate: Number((completionRate ?? 0).toFixed(2)),
        academicLevel:
          profile?.class ||
          this.readString(latestPerformance, ['academicLevel', 'level', 'grade']) ||
          'unknown',
        profileRiskLevel: profile?.risk_level || 'UNKNOWN',
        gamificationPoints: profile?.points_gamification ?? 0,
        lastUpdated: this.extractDate(latestPerformance) ?? this.extractDate(profile as any) ?? null,
        source: performanceData.collectionName || 'student-profile',
      },
      gameMetrics: {
        sessionsPlayed: gameRows.length,
        averageGameScore: Number((this.average(gameScores) ?? 0).toFixed(2)),
        currentStreak: this.readNumber(latestGame, ['streak', 'currentStreak']) ?? 0,
        highestLevel: levelValues.length > 0 ? Math.max(...levelValues) : 0,
        points: profile?.points_gamification ?? this.readNumber(latestGame, ['points']) ?? 0,
        lastPlayedAt: this.extractDate(latestGame),
        source: gameData.collectionName || 'none',
      },
    };
  }

  private buildFlexibleUserFilter(
    userId: string,
    keys: string[],
  ): FilterQuery<Record<string, unknown>> {
    const asObjectId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null;
    const conditions: Record<string, unknown>[] = [];

    for (const key of keys) {
      if (asObjectId) {
        conditions.push({ [key]: asObjectId });
      }
      conditions.push({ [key]: userId });
    }

    return { $or: conditions };
  }

  private async getDocumentsFromFirstExistingCollection(
    candidates: string[],
    filter: Record<string, unknown>,
    limit: number,
  ): Promise<{ collectionName: string | null; documents: Record<string, any>[] }> {
    if (!this.connection?.db) {
      return { collectionName: null, documents: [] };
    }

    for (const candidate of candidates) {
      const exists = await this.connection.db.listCollections({ name: candidate }).toArray();
      if (!exists.length) {
        continue;
      }

      const docs = await this.connection.db
        .collection(candidate)
        .find(filter)
        .sort({ updatedAt: -1, timestamp: -1, createdAt: -1, _id: -1 })
        .limit(limit)
        .toArray();

      return {
        collectionName: candidate,
        documents: docs,
      };
    }

    return { collectionName: null, documents: [] };
  }

  private readNumber(record: Record<string, any> | null, keys: string[]): number | null {
    if (!record) {
      return null;
    }

    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return null;
  }

  private readString(record: Record<string, any> | null, keys: string[]): string | null {
    if (!record) {
      return null;
    }

    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return null;
  }

  private extractDate(record: Record<string, any> | null): Date | null {
    if (!record) {
      return null;
    }

    const dateValue =
      record.updatedAt ||
      record.timestamp ||
      record.createdAt ||
      record.lastPlayedAt ||
      record.lastUpdated ||
      null;

    if (!dateValue) {
      return null;
    }

    const normalized = new Date(dateValue);
    return Number.isNaN(normalized.getTime()) ? null : normalized;
  }

  private average(values: number[]): number | null {
    if (!values.length) {
      return null;
    }
    const total = values.reduce((sum, current) => sum + current, 0);
    return total / values.length;
  }
}