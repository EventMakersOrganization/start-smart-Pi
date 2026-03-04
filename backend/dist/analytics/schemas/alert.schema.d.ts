import { Document, Types } from 'mongoose';
export type AlertDocument = Alert & Document;
export declare enum AlertSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high"
}
export declare class Alert {
    student: Types.ObjectId;
    instructor: Types.ObjectId;
    message: string;
    severity: AlertSeverity;
    resolved: boolean;
}
export declare const AlertSchema: import("mongoose").Schema<Alert, import("mongoose").Model<Alert, any, any, any, Document<unknown, any, Alert> & Alert & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Alert, Document<unknown, {}, import("mongoose").FlatRecord<Alert>> & import("mongoose").FlatRecord<Alert> & {
    _id: Types.ObjectId;
}>;
