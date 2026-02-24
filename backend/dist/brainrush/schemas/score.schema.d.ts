import { Document } from 'mongoose';
export type ScoreDocument = Score & Document;
export declare class Score {
    userId: string;
    gameSessionId: string;
    score: number;
    timeSpent: number;
    difficulty: 'easy' | 'medium' | 'hard';
    aiFeedback?: Record<string, any>;
    createdAt: Date;
}
export declare const ScoreSchema: import("mongoose").Schema<Score, import("mongoose").Model<Score, any, any, any, Document<unknown, any, Score> & Score & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Score, Document<unknown, {}, import("mongoose").FlatRecord<Score>> & import("mongoose").FlatRecord<Score> & {
    _id: import("mongoose").Types.ObjectId;
}>;
