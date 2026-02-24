export declare class ScoringService {
    private readonly BASE_POINTS;
    private readonly TIME_BONUS_FACTOR;
    private readonly TIME_THRESHOLD;
    calculateScore(isCorrect: boolean, responseTime: number, difficulty: 'easy' | 'medium' | 'hard'): number;
}
