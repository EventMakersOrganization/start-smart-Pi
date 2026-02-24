import { Document } from 'mongoose';
export type PlayerSessionDocument = PlayerSession & Document;
export declare class PlayerSession {
    userId: string;
    gameSessionId: string;
    score: number;
    totalTimeSpent: number;
    questionsAnswered: number;
    correctAnswers: number;
    weaknesses: Record<string, any>;
    joinedAt: Date;
}
export declare const PlayerSessionSchema: import("mongoose").Schema<PlayerSession, import("mongoose").Model<PlayerSession, any, any, any, Document<unknown, any, PlayerSession> & PlayerSession & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PlayerSession, Document<unknown, {}, import("mongoose").FlatRecord<PlayerSession>> & import("mongoose").FlatRecord<PlayerSession> & {
    _id: import("mongoose").Types.ObjectId;
}>;
