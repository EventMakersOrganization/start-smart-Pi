import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RecommendationDocument = Recommendation & Document;

@Schema({ timestamps: true })
export class Recommendation {

  @Prop({ required: true })
  studentId: string;

  @Prop()
  recommendedContent: string;

  @Prop({ required: true })
  reason: string;

  @Prop({
    enum: ['course', 'exercise', 'topic'],
    default: 'course'
  })
  contentType: string;

  @Prop({ default: 0, min: 0, max: 100 })
  confidenceScore: number;

  @Prop({ default: false })
  isViewed: boolean;

  @Prop({ default: Date.now })
  generatedAt: Date;
}

export const RecommendationSchema =
  SchemaFactory.createForClass(Recommendation);