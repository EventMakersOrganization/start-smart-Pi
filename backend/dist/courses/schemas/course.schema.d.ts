import { Document, Types } from 'mongoose';
export type CourseDocument = Course & Document;
export declare class Module {
    title: string;
    description: string;
    order: number;
}
export declare const ModuleSchema: import("mongoose").Schema<Module, import("mongoose").Model<Module, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Module>;
export declare class Course {
    title: string;
    description: string;
    level: string;
    instructorId: Types.ObjectId;
    modules: Module[];
    createdAt?: Date;
    updatedAt?: Date;
}
export declare const CourseSchema: import("mongoose").Schema<Course, import("mongoose").Model<Course, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Course>;
