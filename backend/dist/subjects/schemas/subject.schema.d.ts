import { Document, Types } from 'mongoose';
export type SubjectDocument = Subject & Document;
export declare class Subject {
    name: string;
    description: string;
    instructors: Types.ObjectId[];
}
export declare const SubjectSchema: import("mongoose").Schema<Subject, import("mongoose").Model<Subject, any, any, any, Document<unknown, any, Subject> & Subject & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Subject, Document<unknown, {}, import("mongoose").FlatRecord<Subject>> & import("mongoose").FlatRecord<Subject> & {
    _id: Types.ObjectId;
}>;
