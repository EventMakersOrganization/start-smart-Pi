import { Document } from 'mongoose';
export type QuestionInstanceDocument = QuestionInstance & Document;
export declare class QuestionInstance {
    gameSessionId: string;
    question: string;
    options: string[];
    correctAnswer: string;
    difficulty: 'easy' | 'medium' | 'hard';
    createdAt: Date;
    answeredBy: string[];
}
export declare const QuestionInstanceSchema: import("mongoose").Schema<QuestionInstance, import("mongoose").Model<QuestionInstance, any, any, any, Document<unknown, any, QuestionInstance> & QuestionInstance & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, QuestionInstance, Document<unknown, {}, import("mongoose").FlatRecord<QuestionInstance>> & import("mongoose").FlatRecord<QuestionInstance> & {
    _id: import("mongoose").Types.ObjectId;
}>;
