import { Document, Types } from 'mongoose';
export type RiskScoreDocument = RiskScore & Document;
export declare enum RiskLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high"
}
export declare class RiskScore {
    user: Types.ObjectId;
    score: number;
    riskLevel: RiskLevel;
    lastUpdated: Date;
}
export declare const RiskScoreSchema: import("mongoose").Schema<RiskScore, import("mongoose").Model<RiskScore, any, any, any, Document<unknown, any, RiskScore> & RiskScore & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RiskScore, Document<unknown, {}, import("mongoose").FlatRecord<RiskScore>> & import("mongoose").FlatRecord<RiskScore> & {
    _id: Types.ObjectId;
}>;
