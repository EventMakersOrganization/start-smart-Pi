import { Document, Types } from 'mongoose';
export type StudentProfileDocument = StudentProfile & Document;
export declare class StudentProfile {
    userId: Types.ObjectId;
    academic_level: string;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    points_gamification: number;
    level: string;
    learningPreferences: {
        preferredStyle: string;
        preferredDifficulty: string;
        studyHoursPerDay: number;
    };
    progress: number;
    strengths: string[];
    weaknesses: string[];
    levelTestCompleted: boolean;
}
export declare const StudentProfileSchema: import("mongoose").Schema<StudentProfile, import("mongoose").Model<StudentProfile, any, any, any, Document<unknown, any, StudentProfile> & StudentProfile & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, StudentProfile, Document<unknown, {}, import("mongoose").FlatRecord<StudentProfile>> & import("mongoose").FlatRecord<StudentProfile> & {
    _id: Types.ObjectId;
}>;
