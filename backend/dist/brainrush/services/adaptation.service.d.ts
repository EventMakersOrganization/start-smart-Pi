export declare class AdaptationService {
    private readonly TIME_THRESHOLD;
    adaptDifficulty(currentDifficulty: 'easy' | 'medium' | 'hard', isCorrect: boolean, responseTime: number): 'easy' | 'medium' | 'hard';
}
