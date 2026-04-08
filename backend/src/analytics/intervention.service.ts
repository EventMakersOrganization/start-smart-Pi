import { Injectable } from '@nestjs/common';

export type InterventionRiskLevel = 'low' | 'medium' | 'high';

export interface InterventionUserData {
  inactivity_days: number;
  engagement_level: number;
  activity_frequency: number;
}

export interface InterventionPredictionInput {
  probability: number;
  level: 'low' | 'medium' | 'high';
}

export interface InterventionSuggestionsResult {
  suggestions: string[];
}

@Injectable()
export class InterventionService {
  generateInterventionSuggestions(
    userData: InterventionUserData,
    riskLevel: InterventionRiskLevel,
    prediction: InterventionPredictionInput,
  ): InterventionSuggestionsResult {
    const data = this.normalizeUserData(userData);
    const suggestions = new Set<string>();

    if (riskLevel === 'high' || prediction.level === 'high' || prediction.probability >= 0.7) {
      suggestions.add('Schedule a 1-on-1 support session within the next 48 hours.');
      suggestions.add('Send personalized feedback with a short recovery learning plan.');
    } else if (riskLevel === 'medium' || prediction.level === 'medium' || prediction.probability >= 0.4) {
      suggestions.add('Encourage participation through weekly check-ins and reminders.');
      suggestions.add('Provide targeted practice exercises on weak topics.');
    } else {
      suggestions.add('Maintain engagement with consistent positive reinforcement.');
      suggestions.add('Offer optional stretch activities to sustain momentum.');
    }

    if (data.inactivity_days >= 7) {
      suggestions.add('Re-engage the student with a direct outreach message and attendance plan.');
    }

    if (data.engagement_level < 0.4) {
      suggestions.add('Use interactive activities and discussion prompts to increase engagement.');
    }

    if (data.activity_frequency < 1) {
      suggestions.add('Set a minimum weekly study schedule with short, frequent sessions.');
    } else if (data.activity_frequency >= 3 && riskLevel === 'low') {
      suggestions.add('Maintain current participation cadence and celebrate consistency.');
    }

    return {
      suggestions: Array.from(suggestions),
    };
  }

  private normalizeUserData(userData: InterventionUserData): InterventionUserData {
    return {
      inactivity_days: this.toNonNegative(userData.inactivity_days),
      engagement_level: this.clamp(Number(userData.engagement_level ?? 0), 0, 1),
      activity_frequency: this.toNonNegative(userData.activity_frequency),
    };
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
