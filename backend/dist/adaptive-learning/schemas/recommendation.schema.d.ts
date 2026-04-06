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
export declare const RecommendationSchema: import("mongoose").Schema<Recommendation, import("mongoose").Model<Recommendation, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Recommendation>;
