import { Document } from 'mongoose';
export type StudentPerformanceDocument = StudentPerformance & Document;
export declare class StudentPerformance {
    studentId: string;
    exerciseId: string;
    score: number;
    timeSpent: number;
    attemptDate: Date;
    source: string;
}
export declare const StudentPerformanceSchema: import("mongoose").Schema<StudentPerformance, import("mongoose").Model<StudentPerformance, any, any, any, Document<unknown, any, StudentPerformance> & StudentPerformance & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, StudentPerformance, Document<unknown, {}, import("mongoose").FlatRecord<StudentPerformance>> & import("mongoose").FlatRecord<StudentPerformance> & {
    _id: import("mongoose").Types.ObjectId;
}>;
