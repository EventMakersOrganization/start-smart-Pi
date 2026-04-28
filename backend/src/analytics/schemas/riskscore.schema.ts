import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RiskScoreDocument = RiskScore & Document;

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RiskInterventionType {
  POST_EVALUATION = 'post_evaluation',
  REMEDIAL_CONTENT = 'remedial_content',
  INSTRUCTOR_ALERT = 'instructor_alert',
  NONE = 'none',
}

export class RiskDimensions {
  @Prop({ default: 0 })
  performance_risk: number;

  @Prop({ default: 0 })
  engagement_risk: number;

  @Prop({ default: 0 })
  progression_risk: number;

  @Prop({ default: 0 })
  weakness_persistence: number;

  @Prop({ default: 0 })
  trend_risk: number;
}

export class RiskWeakArea {
  @Prop({ required: true })
  topic: string;

  @Prop({ required: true })
  currentScore: number;

  @Prop({ required: true })
  suggestedDifficulty: 'easy' | 'medium' | 'hard';

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  source: 'level-test' | 'performance' | 'profile';
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

  @Prop({ type: RiskDimensions, default: null })
  dimensions?: RiskDimensions | null;

  @Prop({ type: Boolean, default: false })
  requiresIntervention?: boolean;

  @Prop({
    type: String,
    enum: Object.values(RiskInterventionType),
    default: RiskInterventionType.NONE,
  })
  interventionType?: RiskInterventionType;

  @Prop({ type: [RiskWeakArea], default: [] })
  weakAreas?: RiskWeakArea[];

  @Prop({ default: '' })
  reason?: string;
}

export const RiskScoreSchema = SchemaFactory.createForClass(RiskScore);

RiskScoreSchema.index({ lastUpdated: -1 });
RiskScoreSchema.index({ riskLevel: 1, lastUpdated: -1 });
