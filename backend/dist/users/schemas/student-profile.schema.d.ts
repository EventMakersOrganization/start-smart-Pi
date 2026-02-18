import { Document, Types } from 'mongoose';
export type StudentProfileDocument = StudentProfile & Document;
export declare class StudentProfile {
    userId: Types.ObjectId;
    academicLevel: string;
    enrolledCourse: string;
    preferences: Record<string, any>;
    averageScore: number;
}
export declare const StudentProfileSchema: import("mongoose").Schema<StudentProfile, import("mongoose").Model<StudentProfile, any, any, any, Document<unknown, any, StudentProfile> & StudentProfile & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, StudentProfile, Document<unknown, {}, import("mongoose").FlatRecord<StudentProfile>> & import("mongoose").FlatRecord<StudentProfile> & {
    _id: Types.ObjectId;
}>;
