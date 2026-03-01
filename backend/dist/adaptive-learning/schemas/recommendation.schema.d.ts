import { Document } from 'mongoose';
export type RecommendationDocument = Recommendation & Document;
export declare class Recommendation {
    studentId: string;
    recommendedContent: string;
    reason: string;
    contentType: string;
    confidenceScore: number;
    isViewed: boolean;
    generatedAt: Date;
}
export declare const RecommendationSchema: import("mongoose").Schema<Recommendation, import("mongoose").Model<Recommendation, any, any, any, Document<unknown, any, Recommendation> & Recommendation & {
    _id: import("mongoose").Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Recommendation, Document<unknown, {}, import("mongoose").FlatRecord<Recommendation>> & import("mongoose").FlatRecord<Recommendation> & {
    _id: import("mongoose").Types.ObjectId;
}>;
