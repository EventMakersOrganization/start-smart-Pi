import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ExplainabilityLog,
  ExplainabilityLogDocument,
} from '../schemas/explainability.schema';
import { RiskLevel, RiskScore, RiskScoreDocument } from '../schemas/riskscore.schema';
import {
  PredictiveService,
  PredictiveUserData,
  DropoutPredictionResult,
} from '../predictive.service';
import {
  InterventionService,
  InterventionSuggestionsResult,
  InterventionUserData,
} from '../intervention.service';
import { Activity, ActivityDocument } from '../../activity/schemas/activity.schema';

export interface ExplainabilityFactor {
  name: string;
  impact: number;
}

export interface ExplainabilityResult {
  decision: string;
  explanation: string;
  factors: ExplainabilityFactor[];
}

export interface ExplainabilityLogData {
  userId: string;
  recommendationId?: string;
  riskScore: number;
  decision: string;
  explanation: string;
  factors?: ExplainabilityFactor[];
}

export interface ExplainabilityUserData {
  [key: string]: number | string | boolean | null | undefined;
}

export interface DetailedExplainabilityReport {
  userId: string;
  riskScore: number;
  dropoutPrediction: DropoutPredictionResult;
  explanation: string;
  factors: ExplainabilityFactor[];
  suggestions: string[];
}

@Injectable()
export class ExplainabilityService {
  constructor(
    @InjectModel(ExplainabilityLog.name)
    private readonly explainabilityLogModel: Model<ExplainabilityLogDocument>,
    @InjectModel(RiskScore.name)
    private readonly riskScoreModel: Model<RiskScoreDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    private readonly predictiveService: PredictiveService,
    private readonly interventionService: InterventionService,
  ) {}

  async generateDetailedReport(userId: string): Promise<DetailedExplainabilityReport> {
    const latestRiskScore = await this.getLatestRiskScore(userId);
    const riskScoreValue = latestRiskScore?.score ?? 0;
    const behaviorData = await this.buildBehaviorData(userId);

    let explainabilityLog = await this.getLatestExplainabilityLog(userId);

    if (!explainabilityLog) {
      await this.generateExplanation(
        {
          userId,
          inactivityDays: behaviorData.inactivity_days,
          activityFrequency: behaviorData.activity_frequency,
          engagementLevel: behaviorData.engagement_level,
        },
        riskScoreValue,
      );

      explainabilityLog = await this.getLatestExplainabilityLog(userId);
    }

    const dropoutPrediction = this.predictiveService.predictDropoutRisk(behaviorData);
    const suggestions = this.interventionService.generateInterventionSuggestions(
      behaviorData,
      this.resolveInterventionRiskLevel(latestRiskScore?.riskLevel, dropoutPrediction.level),
      dropoutPrediction,
    );

    return {
      userId,
      riskScore: riskScoreValue,
      dropoutPrediction,
      explanation:
        explainabilityLog?.explanation ||
        'No explainability log found. Generated report based on current analytics factors.',
      factors: explainabilityLog?.factors || [],
      suggestions: suggestions.suggestions,
    };
  }

  /**
   * Generate a deterministic, human-readable explanation for a recommendation.
   * No AI model is used here; the logic is rule-based for transparency.
   */
  async generateExplanation(
    userData: ExplainabilityUserData,
    riskScore: number,
  ): Promise<ExplainabilityResult> {
    const decision = this.resolveDecision(riskScore);
    const weightedFactors = this.extractWeightedFactors(userData, riskScore);
    const factors = this.normalizeFactors(weightedFactors);
    const explanation = this.buildExplanation(decision, factors);

    const userId = this.resolveUserId(userData);
    await this.saveExplanation({
      userId,
      recommendationId: this.resolveRecommendationId(userData),
      riskScore,
      decision,
      explanation,
      factors,
    });

    return {
      decision,
      explanation,
      factors,
    };
  }

  async saveExplanation(logData: ExplainabilityLogData): Promise<ExplainabilityLog> {
    const payload = {
      userId: logData.userId,
      recommendationId:
        logData.recommendationId || this.generateRecommendationId(logData.userId),
      riskScore: logData.riskScore,
      decision: logData.decision,
      explanation: logData.explanation,
      factors: logData.factors || [],
    };

    const savedLog = new this.explainabilityLogModel(payload);
    return savedLog.save();
  }

  private async getLatestExplainabilityLog(
    userId: string,
  ): Promise<ExplainabilityLogDocument | null> {
    return this.explainabilityLogModel
      .findOne({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .lean<ExplainabilityLogDocument>()
      .exec();
  }

  private async getLatestRiskScore(userId: string): Promise<RiskScoreDocument | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    return this.riskScoreModel
      .findOne({ user: new Types.ObjectId(userId) })
      .sort({ lastUpdated: -1, _id: -1 })
      .lean<RiskScoreDocument>()
      .exec();
  }

  private async buildBehaviorData(
    userId: string,
  ): Promise<PredictiveUserData & InterventionUserData> {
    const baseline: PredictiveUserData & InterventionUserData = {
      inactivity_days: 0,
      engagement_level: 0.5,
      activity_frequency: 0,
    };

    if (!Types.ObjectId.isValid(userId)) {
      return baseline;
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
    const engagementLevel = this.clamp(recentActivityCount / 14, 0, 1);

    return {
      inactivity_days: inactivityDays,
      engagement_level: Number(engagementLevel.toFixed(2)),
      activity_frequency: activityFrequency,
    };
  }

  private resolveInterventionRiskLevel(
    riskLevel: RiskLevel | undefined,
    fallback: 'low' | 'medium' | 'high',
  ): 'low' | 'medium' | 'high' {
    if (riskLevel === RiskLevel.LOW || riskLevel === RiskLevel.MEDIUM || riskLevel === RiskLevel.HIGH) {
      return riskLevel;
    }

    return fallback;
  }

  private resolveDecision(riskScore: number): string {
    if (riskScore >= 71) {
      return 'High Risk';
    }
    if (riskScore >= 31) {
      return 'Medium Risk';
    }
    return 'Low Risk';
  }

  private extractWeightedFactors(
    userData: ExplainabilityUserData,
    riskScore: number,
  ): Array<{ name: string; weight: number }> {
    const factors: Array<{ name: string; weight: number }> = [];

    const inactivity = this.readNumber(userData, ['inactivity', 'inactivityScore', 'inactivityDays']);
    if (inactivity > 0) {
      factors.push({ name: 'inactivity', weight: Math.min(45, inactivity * 3) });
    }

    const performanceScore = this.readNumber(userData, [
      'performanceScore',
      'averageScore',
      'quizAverage',
      'assessmentScore',
    ]);
    if (performanceScore > 0 && performanceScore < 100) {
      factors.push({ name: 'low performance', weight: Math.min(40, (100 - performanceScore) * 0.5) });
    }

    const failedExercises = this.readNumber(userData, [
      'failedExercises',
      'failedAttempts',
      'failedSubmissions',
    ]);
    if (failedExercises > 0) {
      factors.push({ name: 'failed exercises', weight: Math.min(35, failedExercises * 4) });
    }

    const completionRate = this.readNumber(userData, ['completionRate', 'progressRate']);
    if (completionRate > 0 && completionRate < 100) {
      factors.push({ name: 'low completion rate', weight: Math.min(30, (100 - completionRate) * 0.35) });
    }

    const suspiciousActivity = this.readNumber(userData, ['suspiciousActivityFlag', 'suspiciousEvents']);
    if (suspiciousActivity > 0) {
      factors.push({ name: 'suspicious activity', weight: Math.min(40, suspiciousActivity * 12) });
    }

    const failedLogins = this.readNumber(userData, ['failedLoginAttempts']);
    if (failedLogins > 0) {
      factors.push({ name: 'failed login attempts', weight: Math.min(25, failedLogins * 3) });
    }

    const rapidActions = this.readNumber(userData, ['rapidUserActions']);
    if (rapidActions > 0) {
      factors.push({ name: 'rapid user actions', weight: Math.min(20, rapidActions * 2) });
    }

    const unusualLoginTime = this.readNumber(userData, ['unusualLoginTime']);
    if (unusualLoginTime > 0) {
      factors.push({ name: 'unusual login patterns', weight: Math.min(18, unusualLoginTime * 3) });
    }

    if (factors.length === 0) {
      if (riskScore >= 71) {
        factors.push(
          { name: 'historical risk trend', weight: 55 },
          { name: 'overall learning behavior', weight: 45 },
        );
      } else if (riskScore >= 31) {
        factors.push(
          { name: 'mixed engagement signals', weight: 52 },
          { name: 'inconsistent performance trend', weight: 48 },
        );
      } else {
        factors.push(
          { name: 'stable engagement', weight: 60 },
          { name: 'consistent performance', weight: 40 },
        );
      }
    }

    return factors;
  }

  private normalizeFactors(
    weightedFactors: Array<{ name: string; weight: number }>,
  ): ExplainabilityFactor[] {
    const totalWeight = weightedFactors.reduce((sum, factor) => sum + factor.weight, 0);

    if (totalWeight <= 0) {
      return [];
    }

    return weightedFactors
      .map((factor) => ({
        name: factor.name,
        impact: Math.round((factor.weight / totalWeight) * 100),
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 4);
  }

  private buildExplanation(decision: string, factors: ExplainabilityFactor[]): string {
    if (factors.length === 0) {
      return `User is classified as ${decision} based on available risk indicators.`;
    }

    const topFactors = factors.slice(0, 2).map((factor) => factor.name);

    if (topFactors.length === 1) {
      return `User is classified as ${decision} mainly due to ${topFactors[0]}.`;
    }

    return `User is classified as ${decision} mainly due to ${topFactors[0]} and ${topFactors[1]}.`;
  }

  private resolveUserId(userData: ExplainabilityUserData): string {
    const rawUserId = userData.userId;

    if (typeof rawUserId === 'string' && rawUserId.trim()) {
      return rawUserId.trim();
    }

    throw new Error('userId is required to save explainability history.');
  }

  private resolveRecommendationId(userData: ExplainabilityUserData): string | undefined {
    const rawRecommendationId = userData.recommendationId;

    if (typeof rawRecommendationId === 'string' && rawRecommendationId.trim()) {
      return rawRecommendationId.trim();
    }

    return undefined;
  }

  private generateRecommendationId(userId: string): string {
    return `rec-${userId}-${Date.now()}`;
  }

  private readNumber(userData: ExplainabilityUserData, keys: string[]): number {
    for (const key of keys) {
      const value = userData[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return 0;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
