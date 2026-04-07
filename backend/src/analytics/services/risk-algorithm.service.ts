import { Injectable } from '@nestjs/common';
import { RiskLevel } from '../schemas/riskscore.schema';

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
}
