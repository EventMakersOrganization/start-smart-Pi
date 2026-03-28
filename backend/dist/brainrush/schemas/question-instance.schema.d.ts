import { Document, Types } from 'mongoose';
export type QuestionInstanceDocument = QuestionInstance & Document;
export declare class QuestionInstance {
    gameSessionId: Types.ObjectId;
    questionText: string;
    options: string[];
    correctAnswer: string;
    difficulty: string;
}
export declare const QuestionInstanceSchema: import("mongoose").Schema<QuestionInstance, import("mongoose").Model<QuestionInstance, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, QuestionInstance>;
