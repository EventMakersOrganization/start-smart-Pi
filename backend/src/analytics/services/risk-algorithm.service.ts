import { Injectable } from '@nestjs/common';
import {
  RiskInterventionType,
  RiskLevel,
} from '../schemas/riskscore.schema';

export interface ActivityData {
  userId: string;
  inactivity_days?: number;
  failed_exercises?: number;
  average_score?: number;
  engagement_level?: number;
  session_frequency?: number;

  // Legacy fields kept optional for backward compatibility.
  failedLoginAttempts?: number;
  unusualLoginTime?: number;
  rapidUserActions?: number;
  suspiciousActivityFlag?: number;
}

export interface RiskScoreResult {
  userId: string;
  score: number;
  level: RiskLevel;
  timestamp: Date;
}

export interface WeakAreaInput {
  topic: string;
  currentScore: number;
  source: 'level-test' | 'performance' | 'profile';
  occurrences?: number;
}

export interface RiskDimensionsResult {
  performance_risk: number;
  engagement_risk: number;
  progression_risk: number;
  weakness_persistence: number;
  trend_risk: number;
}

export interface EnhancedRiskInput {
  userId: string;
  recentPerformanceScores: number[];
  recentPerformanceByTopic: Array<{ topic: string; score: number }>;
  levelTestScore?: number | null;
  daysSinceLastActivity: number;
  sessionsLast7Days: number;
  avgMinutesPerSession: number;
  completionRate: number;
  expectedProgress: number;
  weakAreas: WeakAreaInput[];
}

export interface InterventionDecision {
  type: RiskInterventionType;
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

export interface EnhancedRiskResult {
  userId: string;
  overallRisk: number;
  dimensions: RiskDimensionsResult;
  level: RiskLevel;
  requiresIntervention: boolean;
  intervention: InterventionDecision;
  weakAreas: WeakAreaInput[];
  timestamp: Date;
}

@Injectable()
export class RiskAlgorithmService {
  private static readonly WEIGHTS = {
    inactivityDays: 4,
    failedExercises: 3,
    scoreDeficit: 2,
    engagementDeficit: 10,
    sessionFrequency: -2,
  };

  /**
   * Calculate risk score using advanced learning-risk factors.
   * Formula:
   * riskScore =
   * (inactivity_days * 4) +
   * (failed_exercises * 3) +
   * ((100 - average_score) * 2) +
   * ((1 - engagement_level) * 10) +
   * (session_frequency * -2)
   *
   * Score is normalized to 0..100.
   *
   * Risk Levels:
   * - 0-30: LOW
   * - 31-70: MEDIUM
   * - 71-100: HIGH
   */
  calculateRiskScore(activityData: ActivityData): RiskScoreResult {
    const metrics = this.extractMetrics(activityData);
    const weightedScore = this.calculateWeightedScore(metrics);
    const normalizedScore = this.normalizeScore(weightedScore);
    const level = this.determineRiskLevel(normalizedScore);

    return {
      userId: activityData.userId,
      score: normalizedScore,
      level,
      timestamp: new Date(),
    };
  }

  private extractMetrics(activityData: ActivityData) {
    const inactivityDays = this.toNonNegativeNumber(activityData.inactivity_days);
    const failedExercises = this.toNonNegativeNumber(activityData.failed_exercises);
    const averageScore = this.clamp(this.toNonNegativeNumber(activityData.average_score), 0, 100);
    const engagementLevel = this.clamp(this.toNonNegativeNumber(activityData.engagement_level), 0, 1);
    const sessionFrequency = this.toNonNegativeNumber(activityData.session_frequency);

    // If advanced payload is missing, map from legacy payload for compatibility.
    if (
      inactivityDays === 0 &&
      failedExercises === 0 &&
      averageScore === 0 &&
      engagementLevel === 0 &&
      sessionFrequency === 0
    ) {
      return {
        inactivityDays: this.toNonNegativeNumber(activityData.unusualLoginTime),
        failedExercises: this.toNonNegativeNumber(activityData.failedLoginAttempts),
        averageScore: this.clamp(
          100 -
            this.toNonNegativeNumber(activityData.rapidUserActions) * 10 -
            this.toNonNegativeNumber(activityData.suspiciousActivityFlag) * 15,
          0,
          100,
        ),
        engagementLevel: this.clamp(
          1 - this.toNonNegativeNumber(activityData.suspiciousActivityFlag) * 0.2,
          0,
          1,
        ),
        sessionFrequency: this.toNonNegativeNumber(activityData.rapidUserActions),
      };
    }

    return {
      inactivityDays,
      failedExercises,
      averageScore,
      engagementLevel,
      sessionFrequency,
    };
  }

  private calculateWeightedScore(metrics: {
    inactivityDays: number;
    failedExercises: number;
    averageScore: number;
    engagementLevel: number;
    sessionFrequency: number;
  }): number {
    const scoreDeficit = 100 - metrics.averageScore;
    const engagementDeficit = 1 - metrics.engagementLevel;

    return (
      metrics.inactivityDays * RiskAlgorithmService.WEIGHTS.inactivityDays +
      metrics.failedExercises * RiskAlgorithmService.WEIGHTS.failedExercises +
      scoreDeficit * RiskAlgorithmService.WEIGHTS.scoreDeficit +
      engagementDeficit * RiskAlgorithmService.WEIGHTS.engagementDeficit +
      metrics.sessionFrequency * RiskAlgorithmService.WEIGHTS.sessionFrequency
    );
  }

  private normalizeScore(rawScore: number): number {
    return Math.round(this.clamp(rawScore, 0, 100));
  }

  private toNonNegativeNumber(value: unknown): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, parsed);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Determine risk level based on score
   * 0-30: LOW
   * 31-70: MEDIUM
   * 71-100: HIGH
   */
  private determineRiskLevel(score: number): RiskLevel {
    if (score <= 30) {
      return RiskLevel.LOW;
    } else if (score <= 70) {
      return RiskLevel.MEDIUM;
    } else {
      return RiskLevel.HIGH;
    }
  }

  /**
   * Batch calculate risk scores for multiple users
   */
  calculateBatchRiskScores(activityDataList: ActivityData[]): RiskScoreResult[] {
    return activityDataList.map((data) => this.calculateRiskScore(data));
  }

  calculateEnhancedRisk(input: EnhancedRiskInput): EnhancedRiskResult {
    const dimensions: RiskDimensionsResult = {
      performance_risk: this.calculatePerformanceRisk(
        input.recentPerformanceScores,
        input.levelTestScore ?? null,
      ),
      engagement_risk: this.calculateEngagementRisk(
        input.daysSinceLastActivity,
        input.sessionsLast7Days,
        input.avgMinutesPerSession,
      ),
      progression_risk: this.calculateProgressionRisk(
        input.completionRate,
        input.expectedProgress,
      ),
      weakness_persistence: this.calculateWeaknessPersistence(input.weakAreas),
      trend_risk: this.calculateTrendRisk(input.recentPerformanceScores),
    };

    const overallRisk = this.calculateOverallRisk(dimensions);
    const level = this.getRiskLevel(overallRisk);
    const intervention = this.determineIntervention(overallRisk, dimensions);

    return {
      userId: input.userId,
      overallRisk,
      dimensions,
      level,
      requiresIntervention: intervention.type !== RiskInterventionType.NONE,
      intervention,
      weakAreas: input.weakAreas || [],
      timestamp: new Date(),
    };
  }

  private calculatePerformanceRisk(
    recentScores: number[],
    levelTestScore: number | null,
  ): number {
    const safeScores = recentScores.map((s) => this.clamp(Number(s || 0), 0, 100));
    const avgScore = safeScores.length
      ? safeScores.reduce((sum, score) => sum + score, 0) / safeScores.length
      : 0;
    const scoreRisk = Math.max(0, 100 - avgScore);

    const failureRate =
      safeScores.length > 0
        ? (safeScores.filter((score) => score < 60).length / safeScores.length) * 100
        : 100;

    const ltScore = Number.isFinite(Number(levelTestScore))
      ? this.clamp(Number(levelTestScore || 0), 0, 100)
      : null;
    const levelTestRisk = ltScore == null ? 50 : Math.max(0, 100 - ltScore);

    const weighted = scoreRisk * 0.4 + failureRate * 0.3 + levelTestRisk * 0.3;
    return this.clamp(Number(weighted.toFixed(2)), 0, 100);
  }

  private calculateEngagementRisk(
    daysSinceLastActivity: number,
    sessionsLast7Days: number,
    avgMinutesPerSession: number,
  ): number {
    const inactivityRisk = this.clamp(daysSinceLastActivity * 5, 0, 100);
    const expectedSessions = 3;
    const sessionRisk = this.clamp(
      ((expectedSessions - sessionsLast7Days) / expectedSessions) * 100,
      0,
      100,
    );
    const expectedTime = 30;
    const timeRisk = this.clamp(
      ((expectedTime - avgMinutesPerSession) / expectedTime) * 100,
      0,
      100,
    );

    const weighted = inactivityRisk * 0.4 + sessionRisk * 0.3 + timeRisk * 0.3;
    return this.clamp(Number(weighted.toFixed(2)), 0, 100);
  }

  private calculateProgressionRisk(completionRate: number, expectedProgress: number): number {
    const safeCompletion = this.clamp(Number(completionRate || 0), 0, 100);
    const safeExpected = this.clamp(Number(expectedProgress || 0), 0, 100);
    const completionRisk = Math.max(0, 100 - safeCompletion);
    const behindBy = Math.max(0, safeExpected - safeCompletion);
    const weighted = completionRisk * 0.5 + behindBy * 0.5;
    return this.clamp(Number(weighted.toFixed(2)), 0, 100);
  }

  private calculateWeaknessPersistence(weakAreas: WeakAreaInput[]): number {
    if (!weakAreas.length) {
      return 0;
    }
    let persistenceScore = 0;
    for (const area of weakAreas) {
      const occurrences = Math.max(1, Number(area.occurrences || 1));
      const avgScore = this.clamp(Number(area.currentScore || 50), 0, 100);
      const areaPersistence = (100 - avgScore) * (1 + Math.log(occurrences));
      persistenceScore += areaPersistence;
    }
    const normalized = persistenceScore / weakAreas.length;
    return this.clamp(Number(normalized.toFixed(2)), 0, 100);
  }

  private calculateTrendRisk(recentScores: number[]): number {
    if (recentScores.length < 5) {
      return 50;
    }
    const safe = recentScores.map((s) => this.clamp(Number(s || 0), 0, 100));
    const mid = Math.floor(safe.length / 2);
    const older = safe.slice(0, mid);
    const recent = safe.slice(mid);
    const olderAvg = older.reduce((sum, score) => sum + score, 0) / Math.max(1, older.length);
    const recentAvg = recent.reduce((sum, score) => sum + score, 0) / Math.max(1, recent.length);
    const trend = recentAvg - olderAvg;
    if (trend > 10) return 0;
    if (trend > 0) return 20;
    if (trend === 0) return 50;
    if (trend > -10) return 70;
    return 100;
  }

  private calculateOverallRisk(dimensions: RiskDimensionsResult): number {
    const overall =
      dimensions.performance_risk * 0.35 +
      dimensions.weakness_persistence * 0.25 +
      dimensions.trend_risk * 0.2 +
      dimensions.engagement_risk * 0.15 +
      dimensions.progression_risk * 0.05;
    return this.clamp(Number(overall.toFixed(2)), 0, 100);
  }

  private getRiskLevel(risk: number): RiskLevel {
    if (risk < 25) return RiskLevel.LOW;
    if (risk < 50) return RiskLevel.MEDIUM;
    if (risk < 75) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  private determineIntervention(
    risk: number,
    dimensions: RiskDimensionsResult,
  ): InterventionDecision {
    if (risk >= 70 && dimensions.weakness_persistence >= 60) {
      return {
        type: RiskInterventionType.POST_EVALUATION,
        priority: 'high',
        reason: 'High risk with persistent weak areas - diagnostic test required',
      };
    }
    if (risk >= 60) {
      return {
        type: RiskInterventionType.INSTRUCTOR_ALERT,
        priority: 'high',
        reason: 'High risk - instructor intervention needed',
      };
    }
    if (risk >= 40 || dimensions.weakness_persistence >= 50) {
      return {
        type: RiskInterventionType.REMEDIAL_CONTENT,
        priority: 'medium',
        reason: 'Moderate risk or persistent weaknesses - suggest extra practice',
      };
    }
    return {
      type: RiskInterventionType.NONE,
      priority: 'low',
      reason: 'Student is on track',
    };
  }
}
