import { Injectable } from '@nestjs/common';

@Injectable()
export class AdaptationService {
  private readonly TIME_THRESHOLD = 5000; // 5 seconds

  /**
   * Adaptive Difficulty Algorithm
   * Increases difficulty if correct answer and response time < threshold
   * Decreases difficulty if wrong answer or response time > threshold
   */
  adaptDifficulty(
    currentDifficulty: string,
    isCorrect: boolean,
    responseTime: number,
  ): string {
    const levels = ['easy', 'medium', 'hard'];
    let currentIndex = levels.indexOf(currentDifficulty);
    if (currentIndex === -1) currentIndex = 1; // default medium

    if (isCorrect && responseTime < this.TIME_THRESHOLD) {
      // Step up difficulty
      currentIndex = Math.min(currentIndex + 1, levels.length - 1);
    } else if (!isCorrect || responseTime > this.TIME_THRESHOLD) {
      // Step down difficulty
      currentIndex = Math.max(currentIndex - 1, 0);
    }

    return levels[currentIndex];
  }
}
