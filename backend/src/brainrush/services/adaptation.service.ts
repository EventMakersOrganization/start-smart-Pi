import { Injectable } from '@nestjs/common';

@Injectable()
export class AdaptationService {
  private readonly TIME_THRESHOLD = 10000; // 10 seconds in ms

  // Adaptive difficulty algorithm
  // Increases difficulty if answer is correct and response time < threshold
  // Decreases difficulty if answer is wrong or response time > threshold
  adaptDifficulty(
    currentDifficulty: 'easy' | 'medium' | 'hard',
    isCorrect: boolean,
    responseTime: number,
  ): 'easy' | 'medium' | 'hard' {
    const difficulties = ['easy', 'medium', 'hard'];
    let currentIndex = difficulties.indexOf(currentDifficulty);

    if (isCorrect && responseTime < this.TIME_THRESHOLD) {
      // Increase difficulty: correct and fast
      currentIndex = Math.min(currentIndex + 1, 2);
    } else if (!isCorrect || responseTime > this.TIME_THRESHOLD) {
      // Decrease difficulty: wrong or slow
      currentIndex = Math.max(currentIndex - 1, 0);
    }
    // If correct but slow, or wrong but fast, keep same (no change)

    return difficulties[currentIndex] as 'easy' | 'medium' | 'hard';
  }
}
