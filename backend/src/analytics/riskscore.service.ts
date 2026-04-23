import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RiskLevel, RiskScore, RiskScoreDocument } from './schemas/riskscore.schema';
import { RiskAlgorithmService, ActivityData } from './services/risk-algorithm.service';
import { AlertThresholdService } from './services/alert-threshold.service';
import { AlertService } from './alert.service';
import { User, UserDocument, UserRole, UserStatus } from '../users/schemas/user.schema';
import { Activity, ActivityDocument } from '../activity/schemas/activity.schema';
import {
  StudentPerformance,
  StudentPerformanceDocument,
} from '../adaptive-learning/schemas/student-performance.schema';
import { AdaptiveLearningService } from '../adaptive-learning/adaptive-learning.service';

export interface WeakAreaInsight {
  topic: string;
  currentScore: number;
  suggestedDifficulty: 'easy' | 'medium' | 'hard';
  action: string;
  encouragement: string;
  source: 'level-test' | 'performance' | 'profile';
}

export interface AtRiskStudentInsight {
  userId: string;
  name: string;
  email: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  weakAreas: WeakAreaInsight[];
  weakSubskills: string[];
  recommendedFocus: string[];
  lastUpdated: Date | null;
}

export interface RiskRecalculationSummary {
  processedStudents: number;
  updatedScores: number;
  highRiskCount: number;
  mediumRiskCount: number;
  generatedAt: string;
  errors: string[];
}

@Injectable()
export class RiskScoreService {
  private readonly logger = new Logger(RiskScoreService.name);

  constructor(
    @InjectModel(RiskScore.name)
    private riskScoreModel: Model<RiskScoreDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Activity.name)
    private activityModel: Model<ActivityDocument>,
    @InjectModel(StudentPerformance.name)
    private performanceModel: Model<StudentPerformanceDocument>,
    private riskAlgorithmService: RiskAlgorithmService,
    private alertThresholdService: AlertThresholdService,
    private alertService: AlertService,
    private adaptiveLearningService: AdaptiveLearningService,
  ) {}

  async create(createRiskScoreDto: any): Promise<RiskScore> {
    const riskScore = new this.riskScoreModel({
      ...createRiskScoreDto,
      lastUpdated: new Date(),
    });
    return riskScore.save();
  }

  async findAll(): Promise<RiskScore[]> {
    return this.riskScoreModel.find().populate('user', 'first_name last_name email').exec();
  }

  async findOne(id: string): Promise<RiskScore> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid RiskScore ID: ${id}`);
    }
    const riskScore = await this.riskScoreModel
      .findById(id)
      .populate('user', 'first_name last_name email')
      .exec();
    if (!riskScore) {
      throw new NotFoundException(`RiskScore with ID ${id} not found`);
    }
    return riskScore;
  }

  async findByUser(userId: string): Promise<RiskScore[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException(`Invalid User ID: ${userId}`);
    }
    return this.riskScoreModel
      .find({ user: userId })
      .populate('user', 'first_name last_name email')
      .exec();
  }

  async update(id: string, updateRiskScoreDto: any): Promise<RiskScore> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid RiskScore ID: ${id}`);
    }
    const riskScore = await this.riskScoreModel
      .findByIdAndUpdate(
        id,
        { ...updateRiskScoreDto, lastUpdated: new Date() },
        { new: true },
      )
      .populate('user', 'first_name last_name email')
      .exec();
    if (!riskScore) {
      throw new NotFoundException(`RiskScore with ID ${id} not found`);
    }
    return riskScore;
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid RiskScore ID: ${id}`);
    }
    const result = await this.riskScoreModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`RiskScore with ID ${id} not found`);
    }
  }

  async count(): Promise<number> {
    return this.riskScoreModel.countDocuments().exec();
  }

  /**
   * Calculate risk score using the algorithm and save to database
   * This method integrates the risk algorithm with data persistence
   * and automatically creates alerts if thresholds are exceeded
   */
  async calculateAndSaveRiskScore(activityData: ActivityData): Promise<RiskScore> {
    // Use the algorithm service to calculate the risk score
    const result = this.riskAlgorithmService.calculateRiskScore(activityData);

    // Check if user already has a risk score
    const existingScores = await this.riskScoreModel
      .find({ user: new Types.ObjectId(result.userId) })
      .exec();

    let savedScore: RiskScore;

    if (existingScores.length > 0) {
      // Update the most recent risk score
      const latestScore = existingScores[0];
      savedScore = await this.update(latestScore._id.toString(), {
        score: result.score,
        riskLevel: result.level,
      });
    } else {
      // Create new risk score
      savedScore = await this.create({
        user: result.userId,
        score: result.score,
        riskLevel: result.level,
      });
    }

    // Dynamic Sprint 3 alert triggers.
    await this.triggerAlertsForRiskConditions(activityData, result.score, result.level);

    return savedScore;
  }

  private async triggerAlertsForRiskConditions(
    activityData: ActivityData,
    riskScore: number,
    riskLevel: RiskLevel,
  ): Promise<void> {
    const thresholdConfig = await this.alertThresholdService.getThresholds();
    const triggers: Array<{
      shouldTrigger: boolean;
      triggerType: 'high-risk-threshold' | 'suspicious-activity' | 'abnormal-behavior';
      message: string;
    }> = [
      {
        shouldTrigger:
          riskScore >= thresholdConfig.HIGH_RISK_MIN || riskLevel === RiskLevel.HIGH,
        triggerType: 'high-risk-threshold',
        message: `High risk threshold reached. Score=${riskScore}, level=${riskLevel}.`,
      },
      {
        shouldTrigger: activityData.suspiciousActivityFlag > 0,
        triggerType: 'suspicious-activity',
        message:
          `Suspicious activity detected (flag=${activityData.suspiciousActivityFlag}). ` +
          `Score=${riskScore}, level=${riskLevel}.`,
      },
      {
        shouldTrigger:
          activityData.unusualLoginTime >= 2 ||
          activityData.rapidUserActions >= 3 ||
          activityData.failedLoginAttempts >= 5,
        triggerType: 'abnormal-behavior',
        message:
          'Abnormal behavior pattern detected ' +
          `(failedLogins=${activityData.failedLoginAttempts}, ` +
          `unusualLoginTime=${activityData.unusualLoginTime}, ` +
          `rapidActions=${activityData.rapidUserActions}). ` +
          `Score=${riskScore}, level=${riskLevel}.`,
      },
    ];

    for (const trigger of triggers) {
      if (!trigger.shouldTrigger) {
        continue;
      }

      await this.alertService.triggerRiskAlertIfNeeded({
        userId: activityData.userId,
        riskScore,
        riskLevel,
        message: trigger.message,
        timestamp: new Date(),
        resolved: false,
        triggerType: trigger.triggerType,
      });
    }
  }

  /**
   * Calculate risk scores for multiple users and save to database
   */
  async calculateAndSaveBatchRiskScores(activityDataList: ActivityData[]): Promise<RiskScore[]> {
    const results = this.riskAlgorithmService.calculateBatchRiskScores(activityDataList);
    const savedScores: RiskScore[] = [];

    for (const result of results) {
      const activityData: ActivityData = {
        userId: result.userId,
        failedLoginAttempts: 0,
        unusualLoginTime: 0,
        rapidUserActions: 0,
        suspiciousActivityFlag: 0,
      };

      // Find the original activity data from the input list
      const originalData = activityDataList.find((data) => data.userId === result.userId);
      if (originalData) {
        const savedScore = await this.calculateAndSaveRiskScore(originalData);
        savedScores.push(savedScore);
      }
    }

    return savedScores;
  }

  async recalculateAllStudentRiskScores(limit?: number): Promise<RiskRecalculationSummary> {
    const students = await this.userModel
      .find({ role: UserRole.STUDENT, status: UserStatus.ACTIVE })
      .select('_id first_name last_name email')
      .sort({ _id: 1 })
      .limit(Math.max(1, Math.min(Number(limit || 500), 2000)))
      .lean<UserDocument[]>()
      .exec();

    const summary: RiskRecalculationSummary = {
      processedStudents: students.length,
      updatedScores: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      generatedAt: new Date().toISOString(),
      errors: [],
    };

    for (const student of students) {
      try {
        const studentId = String((student as any)._id || '');
        if (!studentId) {
          continue;
        }

        const activityData = await this.buildActivityDataForStudent(studentId);
        const saved = await this.calculateAndSaveRiskScore(activityData);
        summary.updatedScores += 1;

        if (saved.riskLevel === RiskLevel.HIGH) {
          summary.highRiskCount += 1;
        } else if (saved.riskLevel === RiskLevel.MEDIUM) {
          summary.mediumRiskCount += 1;
        }
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        summary.errors.push(`student:${String((student as any)._id)} => ${errMessage}`);
      }
    }

    this.logger.log(
      `Risk scan completed: processed=${summary.processedStudents}, updated=${summary.updatedScores}, high=${summary.highRiskCount}, medium=${summary.mediumRiskCount}`,
    );

    return summary;
  }

  async getAtRiskStudentInsights(
    minimumLevel: 'high' | 'medium' = 'high',
    limit = 25,
  ): Promise<AtRiskStudentInsight[]> {
    const safeLimit = Math.max(1, Math.min(Number(limit || 25), 200));
    const includeMedium = minimumLevel === 'medium';

    const acceptedLevels = includeMedium
      ? [RiskLevel.HIGH, RiskLevel.MEDIUM]
      : [RiskLevel.HIGH];

    const rows = await this.riskScoreModel
      .find({ riskLevel: { $in: acceptedLevels } })
      .populate('user', 'first_name last_name email')
      .sort({ score: -1, lastUpdated: -1, _id: -1 })
      .limit(safeLimit)
      .lean<RiskScoreDocument[]>()
      .exec();

    const output: AtRiskStudentInsight[] = [];

    for (const row of rows as any[]) {
      const userObj = row.user || {};
      const userId = String(row.user?._id || row.user || '').trim();
      if (!userId) {
        continue;
      }

      const weakAreas = await this.getWeakAreasForStudent(userId);
      const weakSubskills = await this.getWeakSubskills(userId, weakAreas);

      output.push({
        userId,
        name:
          `${String(userObj.first_name || '').trim()} ${String(userObj.last_name || '').trim()}`.trim() ||
          'Unknown Student',
        email: String(userObj.email || 'N/A'),
        riskScore: Number(row.score || 0),
        riskLevel: String(row.riskLevel || 'medium').toLowerCase() as 'low' | 'medium' | 'high',
        weakAreas,
        weakSubskills,
        recommendedFocus: weakAreas.map((w) => w.action).slice(0, 3),
        lastUpdated: row.lastUpdated ? new Date(row.lastUpdated) : null,
      });
    }

    return output;
  }

  private async buildActivityDataForStudent(userId: string): Promise<ActivityData> {
    if (!Types.ObjectId.isValid(userId)) {
      return {
        userId,
        inactivity_days: 14,
        failed_exercises: 0,
        average_score: 0,
        engagement_level: 0,
        session_frequency: 0,
        failedLoginAttempts: 0,
        unusualLoginTime: 0,
        rapidUserActions: 0,
        suspiciousActivityFlag: 0,
      };
    }

    const objectId = new Types.ObjectId(userId);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [latestActivity, recentActivityCount, recentPerformances] = await Promise.all([
      this.activityModel
        .findOne({ userId: objectId })
        .sort({ timestamp: -1, _id: -1 })
        .select('timestamp')
        .lean<ActivityDocument | null>()
        .exec(),
      this.activityModel
        .countDocuments({
          userId: objectId,
          timestamp: { $gte: sevenDaysAgo },
        })
        .exec(),
      this.performanceModel
        .find({ studentId: userId })
        .sort({ attemptDate: -1, _id: -1 })
        .limit(20)
        .select('score')
        .lean<StudentPerformanceDocument[]>()
        .exec(),
    ]);

    const inactivityDays = latestActivity?.timestamp
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() - new Date(latestActivity.timestamp).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 14;

    const scores = (recentPerformances || []).map((p: any) => Number(p?.score || 0));
    const failedExercises = scores.filter((s) => s < 60).length;
    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : 0;

    const engagementLevel = Number(Math.min(1, Math.max(0, recentActivityCount / 14)).toFixed(2));
    const sessionFrequency = Number((recentActivityCount / 7).toFixed(2));

    return {
      userId,
      inactivity_days: inactivityDays,
      failed_exercises: failedExercises,
      average_score: averageScore,
      engagement_level: engagementLevel,
      session_frequency: sessionFrequency,
      failedLoginAttempts: 0,
      unusualLoginTime: recentActivityCount > 80 ? 2 : 0,
      rapidUserActions: recentActivityCount > 120 ? 3 : 0,
      suspiciousActivityFlag: 0,
    };
  }

  private async getWeakAreasForStudent(userId: string): Promise<WeakAreaInsight[]> {
    try {
      const response = await this.adaptiveLearningService.getWeakAreaRecommendations(userId);
      return Array.isArray(response?.weakAreas)
        ? (response.weakAreas as WeakAreaInsight[])
        : [];
    } catch {
      return [];
    }
  }

  private async getWeakSubskills(userId: string, weakAreas: WeakAreaInsight[]): Promise<string[]> {
    const weakTopics = weakAreas.map((w) => String(w.topic || '').trim()).filter((w) => !!w);

    const performances = await this.performanceModel
      .find({ studentId: userId })
      .sort({ attemptDate: -1, _id: -1 })
      .limit(60)
      .select('topic difficulty score')
      .lean<StudentPerformanceDocument[]>()
      .exec();

    const bucket = new Map<string, { total: number; count: number }>();

    for (const perf of performances as any[]) {
      const topic = String(perf.topic || 'general').trim();
      const difficulty = String(perf.difficulty || 'beginner').trim();

      if (weakTopics.length > 0 && !weakTopics.includes(topic)) {
        continue;
      }

      const key = `${topic} :: ${difficulty}`;
      const current = bucket.get(key) || { total: 0, count: 0 };
      current.total += Number(perf.score || 0);
      current.count += 1;
      bucket.set(key, current);
    }

    return Array.from(bucket.entries())
      .map(([key, stat]) => ({ key, avg: stat.count ? stat.total / stat.count : 0 }))
      .filter((row) => row.avg < 65)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5)
      .map((row) => row.key.replace(' :: ', ' - '));
  }
}
