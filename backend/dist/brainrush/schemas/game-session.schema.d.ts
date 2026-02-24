import { Document } from 'mongoose';
export type GameSessionDocument = GameSession & Document;
export declare class GameSession {
    roomCode?: string;
    mode: 'solo' | 'multiplayer';
    difficulty: 'easy' | 'medium' | 'hard';
    players: string[];
    startedAt: Date;
    endedAt?: Date;
    active: boolean;
}
export declare const GameSessionSchema: import("mongoose").Schema<GameSession, import("mongoose").Model<GameSession, any, any, any, Document<unknown, any, GameSession> & GameSession & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, GameSession, Document<unknown, {}, import("mongoose").FlatRecord<GameSession>> & import("mongoose").FlatRecord<GameSession> & {
    _id: import("mongoose").Types.ObjectId;
}>;
