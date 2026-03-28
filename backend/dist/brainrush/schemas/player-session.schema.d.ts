import { Document, Types } from 'mongoose';
export type PlayerSessionDocument = PlayerSession & Document;
export declare class PlayerSession {
    userId: Types.ObjectId;
    gameSessionId: Types.ObjectId;
    score: number;
    currentDifficulty: string;
    consecutiveCorrect: number;
    consecutiveWrong: number;
}
export declare const PlayerSessionSchema: import("mongoose").Schema<PlayerSession, import("mongoose").Model<PlayerSession, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PlayerSession>;
