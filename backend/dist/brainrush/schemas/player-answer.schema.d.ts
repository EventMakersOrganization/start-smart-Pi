import { Document, Types } from 'mongoose';
export type PlayerAnswerDocument = PlayerAnswer & Document;
export declare class PlayerAnswer {
    userId: Types.ObjectId;
    gameSessionId: Types.ObjectId;
    questionId: Types.ObjectId;
    answerGiven: string;
    isCorrect: boolean;
    responseTime: number;
    difficulty: string;
    topic: string;
}
export declare const PlayerAnswerSchema: import("mongoose").Schema<PlayerAnswer, import("mongoose").Model<PlayerAnswer, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PlayerAnswer>;
