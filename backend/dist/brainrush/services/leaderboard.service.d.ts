import { Model } from 'mongoose';
import { Score, ScoreDocument } from '../schemas/score.schema';
export declare class LeaderboardService {
    private scoreModel;
    constructor(scoreModel: Model<ScoreDocument>);
    getLeaderboard(limit?: number): Promise<Score[]>;
    getLeaderboardByDifficulty(difficulty: 'easy' | 'medium' | 'hard', limit?: number): Promise<Score[]>;
}
