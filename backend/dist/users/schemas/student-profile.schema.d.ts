import { Document, Types } from 'mongoose';
export type StudentProfileDocument = StudentProfile & Document;
export declare class StudentProfile {
    userId: Types.ObjectId;
    academic_level: string;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    points_gamification: number;
}
export declare const StudentProfileSchema: import("mongoose").Schema<StudentProfile, import("mongoose").Model<StudentProfile, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, StudentProfile>;
