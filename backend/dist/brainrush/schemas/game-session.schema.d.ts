import { Document, Types } from 'mongoose';
export type GameSessionDocument = GameSession & Document;
export declare enum GameMode {
    SOLO = "solo",
    MULTIPLAYER = "multiplayer"
}
export declare class GameSession {
    roomCode: string;
    mode: GameMode;
    topic: string;
    players: Types.ObjectId[];
    isActive: boolean;
}
export declare const GameSessionSchema: import("mongoose").Schema<GameSession, import("mongoose").Model<GameSession, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, GameSession>;
