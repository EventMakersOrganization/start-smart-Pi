import { Document } from 'mongoose';
export type UserDocument = User & Document;
export declare enum UserRole {
    STUDENT = "student",
    TEACHER = "teacher",
    ADMIN = "admin"
}
export declare enum UserStatus {
    ACTIVE = "active",
    SUSPENDED = "suspended"
}
export declare class User {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
}
export declare const UserSchema: import("mongoose").Schema<User, import("mongoose").Model<User, any, any, any, Document<unknown, any, User> & User & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, User, Document<unknown, {}, import("mongoose").FlatRecord<User>> & import("mongoose").FlatRecord<User> & {
    _id: import("mongoose").Types.ObjectId;
}>;
