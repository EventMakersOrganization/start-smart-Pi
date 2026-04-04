import { Document } from 'mongoose';
export type QuestionDocument = Question & Document;
export declare class Question {
    questionText: string;
    options: string[];
    correctAnswer: string;
    topic: string;
    difficulty: string;
}
export declare const QuestionSchema: import("mongoose").Schema<Question, import("mongoose").Model<Question, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Question>;
