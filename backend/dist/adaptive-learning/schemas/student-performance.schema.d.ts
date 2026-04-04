import { Document } from 'mongoose';
export type StudentPerformanceDocument = StudentPerformance & Document;
export declare class StudentPerformance {
    studentId: string;
    exerciseId: string;
    score: number;
    timeSpent: number;
    attemptDate: Date;
    source: string;
    topic: string;
    difficulty: string;
}
export declare const StudentPerformanceSchema: import("mongoose").Schema<StudentPerformance, import("mongoose").Model<StudentPerformance, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, StudentPerformance>;
