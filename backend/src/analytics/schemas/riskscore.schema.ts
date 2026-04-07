import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RiskScoreDocument = RiskScore & Document;

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Schema({ timestamps: true })
export class RiskScore {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  score: number;

  @Prop({
    type: String,
    enum: Object.values(RiskLevel),
    required: true,
  })
  riskLevel: RiskLevel;

  @Prop({ default: Date.now })
  lastUpdated: Date;
}

export const RiskScoreSchema = SchemaFactory.createForClass(RiskScore);

RiskScoreSchema.index({ lastUpdated: -1 });
RiskScoreSchema.index({ riskLevel: 1, lastUpdated: -1 });
