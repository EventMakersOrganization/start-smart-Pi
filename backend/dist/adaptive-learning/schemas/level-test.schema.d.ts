import { Document } from 'mongoose';
export type LevelTestDocument = LevelTest & Document;
export declare class LevelTest {
    studentId: string;
    questions: {
        questionText: string;
        options: string[];
        correctAnswer: string;
        topic: string;
        difficulty: string;
    }[];
    answers: {
        questionIndex: number;
        selectedAnswer: string;
        isCorrect: boolean;
        timeSpent: number;
    }[];
    totalScore: number;
    resultLevel: string;
    detectedStrengths: {
        topic: string;
        score: number;
        correct: number;
        total: number;
    }[];
    detectedWeaknesses: {
        topic: string;
        score: number;
        correct: number;
        total: number;
    }[];
    status: string;
    completedAt: Date;
}
export declare const LevelTestSchema: import("mongoose").Schema<LevelTest, import("mongoose").Model<LevelTest, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LevelTest>;
