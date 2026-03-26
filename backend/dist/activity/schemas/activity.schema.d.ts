import { Document, Types } from 'mongoose';
export type ActivityDocument = Activity & Document;
export declare enum ActivityAction {
    LOGIN = "login",
    PROFILE_UPDATE = "profile_update",
    QUIZ_ATTEMPT = "quiz_attempt"
}
export declare class Activity {
    userId: Types.ObjectId;
    action: ActivityAction;
    timestamp: Date;
}
export declare const ActivitySchema: import("mongoose").Schema<Activity, import("mongoose").Model<Activity, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Activity>;
