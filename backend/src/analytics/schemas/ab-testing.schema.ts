import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AbTestingDocument = AbTesting & Document;

export enum AbGroup {
  A = 'A',
  B = 'B',
}

@Schema({ timestamps: true })
export class AbTesting {
  @Prop({ required: true, trim: true, index: true })
  userId: string;

  @Prop({ required: true, enum: Object.values(AbGroup) })
  group: AbGroup;

  @Prop({ required: true, trim: true })
  intervention: string;

  @Prop({ trim: true, default: '' })
  outcome: string;

  @Prop({ type: Number, default: null })
  baselineRiskScore?: number | null;

  @Prop({ type: Number, default: null })
  baselineActivity7d?: number | null;

  @Prop({ type: Number, default: null })
  baselineAvgScore?: number | null;

  @Prop({ type: Date, default: null })
  baselineCapturedAt?: Date | null;

  @Prop({ type: Date, default: null })
  lastReminderAt?: Date | null;

  @Prop({ type: Date, default: null })
  lastPlanAt?: Date | null;

  @Prop({
    type: [
      {
        day: Number,
        at: Date,
        riskScore: Number,
        activity7d: Number,
        avgScore: Number,
        riskDelta: Number,
        activityDelta: Number,
        scoreDelta: Number,
      },
    ],
    default: [],
  })
  checkpoints?: Array<{
    day: number;
    at: Date;
    riskScore: number;
    activity7d: number;
    avgScore: number;
    riskDelta: number;
    activityDelta: number;
    scoreDelta: number;
  }>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AbTestingSchema = SchemaFactory.createForClass(AbTesting);
