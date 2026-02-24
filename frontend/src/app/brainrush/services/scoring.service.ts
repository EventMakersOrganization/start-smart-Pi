import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ScoringService {
  // Local scoring if needed, but mainly handled by backend
  calculateScoreLocally(isCorrect: boolean, timeSpent: number, difficulty: 'easy' | 'medium' | 'hard'): number {
    if (!isCorrect) return 0;
    const base = { easy: 10, medium: 20, hard: 30 }[difficulty];
    const bonus = timeSpent < 10 ? (10 - timeSpent) * 1 : 0; // simple bonus
    return base + bonus;
  }
}
