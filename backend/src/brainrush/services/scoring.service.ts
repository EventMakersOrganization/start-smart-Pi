import { Injectable } from '@nestjs/common';

@Injectable()
export class ScoringService {
  calculateScore(isCorrect: boolean, responseTime: number, difficulty: string): number {
    if (!isCorrect) return 0;
    
    let baseScore = 10;
    if (difficulty === 'medium') baseScore = 20;
    if (difficulty === 'hard') baseScore = 30;

    // Time bonus
    const timeBonus = Math.max(0, 5000 - responseTime) / 1000; // Up to 5 bonus points
    return Math.floor(baseScore + timeBonus);
  }
}
