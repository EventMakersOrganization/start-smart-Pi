import { Model } from 'mongoose';
import { Score, ScoreDocument } from '../schemas/score.schema';
export declare class LeaderboardService {
    private scoreModel;
    constructor(scoreModel: Model<ScoreDocument>);
    getLeaderboard(gameSessionId: string): Promise<Omit<Score & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }, never>[]>;
}
