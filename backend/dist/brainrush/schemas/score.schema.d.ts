import { Document, Types } from 'mongoose';
export type ScoreDocument = Score & Document;
export declare class Score {
    userId: Types.ObjectId;
    gameSessionId: Types.ObjectId;
    score: number;
    timeSpent: number;
    difficultyAchieved: string;
    aiFeedback: string;
}
export declare const ScoreSchema: import("mongoose").Schema<Score, import("mongoose").Model<Score, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Score>;
