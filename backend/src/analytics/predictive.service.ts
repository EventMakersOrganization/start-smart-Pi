import { Injectable } from '@nestjs/common';

export interface PredictiveUserData {
  inactivity_days: number;
  engagement_level: number;
  activity_frequency: number;
}

export interface DropoutPredictionResult {
  probability: number;
  level: 'low' | 'medium' | 'high';
  explanation: string;
}

@Injectable()
export class PredictiveService {
  predictDropoutRisk(userData: PredictiveUserData): DropoutPredictionResult {
    const normalizedInput = this.normalizeInput(userData);
    const probability = this.calculateProbability(normalizedInput);
    const level = this.toRiskLevel(probability);
    const explanation = this.buildExplanation(normalizedInput, level);

    return {
      probability,
      level,
      explanation,
    };
  }

  private normalizeInput(userData: PredictiveUserData): PredictiveUserData {
    return {
      inactivity_days: this.toNonNegative(userData.inactivity_days),
      engagement_level: this.clamp(Number(userData.engagement_level ?? 0), 0, 1),
      activity_frequency: this.toNonNegative(userData.activity_frequency),
    };
  }

  private calculateProbability(userData: PredictiveUserData): number {
    const inactivityScore = this.clamp(userData.inactivity_days / 14, 0, 1);
    const engagementRisk = this.clamp(1 - userData.engagement_level, 0, 1);
    const frequencyScore = this.clamp(userData.activity_frequency / 3, 0, 1);
    const frequencyRisk = this.clamp(1 - frequencyScore, 0, 1);

    const weightedRisk =
      inactivityScore * 0.5 +
      engagementRisk * 0.3 +
      frequencyRisk * 0.2;

    return Number(this.clamp(weightedRisk, 0, 1).toFixed(2));
  }

  private toRiskLevel(probability: number): 'low' | 'medium' | 'high' {
    if (probability < 0.35) {
      return 'low';
    }

    if (probability < 0.7) {
      return 'medium';
    }

    return 'high';
  }

  private buildExplanation(userData: PredictiveUserData, level: 'low' | 'medium' | 'high'): string {
    const insights: string[] = [];

    if (userData.inactivity_days >= 7) {
      insights.push('high inactivity period');
    }

    if (userData.engagement_level < 0.4) {
      insights.push('low engagement level');
    }

    if (userData.activity_frequency < 1) {
      insights.push('low activity frequency');
    } else if (userData.activity_frequency >= 3) {
      insights.push('stable activity frequency');
    }

    if (insights.length === 0) {
      return 'Risk prediction is stable with balanced activity and engagement indicators.';
    }

    if (level === 'high') {
      return `Dropout risk is high due to ${insights
        .filter((item) => item !== 'stable activity frequency')
        .join(', ')}.`;
    }

    if (level === 'low') {
      return 'Dropout risk is low, supported by stable activity and healthier engagement patterns.';
    }

    return `Dropout risk is moderate with mixed indicators: ${insights.join(', ')}.`;
  }

  private toNonNegative(value: unknown): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, parsed);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
