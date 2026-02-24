import { Injectable } from '@nestjs/common';

@Injectable()
export class ScoringService {
  private readonly BASE_POINTS = {
    easy: 10,
    medium: 20,
    hard: 30,
  };

  private readonly TIME_BONUS_FACTOR = 0.1; // 10% bonus per second under threshold
  private readonly TIME_THRESHOLD = 10000; // 10 seconds

  calculateScore(
    isCorrect: boolean,
    responseTime: number,
    difficulty: 'easy' | 'medium' | 'hard',
  ): number {
    if (!isCorrect) return 0;

    let score = this.BASE_POINTS[difficulty];

    // Time bonus: if under threshold, add bonus
    if (responseTime < this.TIME_THRESHOLD) {
      const timeSaved = this.TIME_THRESHOLD - responseTime;
      const bonus = (timeSaved / 1000) * this.TIME_BONUS_FACTOR * score;
      score += Math.floor(bonus);
    }

    return score;
  }
}
