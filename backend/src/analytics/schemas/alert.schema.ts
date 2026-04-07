import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RiskLevel } from './riskscore.schema';

export type AlertDocument = Alert & Document;

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AlertTriggerType {
  HIGH_RISK_THRESHOLD = 'high-risk-threshold',
  SUSPICIOUS_ACTIVITY = 'suspicious-activity',
  ABNORMAL_BEHAVIOR = 'abnormal-behavior',
}

@Schema({ timestamps: true })
export class Alert {
  // Existing field used by current frontend tables.
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  student: Types.ObjectId;

  // Sprint 3 explicit requirement payload field.
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  instructor: Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop()
  riskScore?: number;

  @Prop({
    type: String,
    enum: Object.values(RiskLevel),
  })
  riskLevel?: RiskLevel;

  @Prop({
    type: String,
    enum: Object.values(AlertTriggerType),
  })
  triggerType?: AlertTriggerType;

  @Prop({ default: Date.now })
  timestamp?: Date;

  @Prop({
    type: String,
    enum: Object.values(AlertSeverity),
    required: true,
  })
  severity: AlertSeverity;

  @Prop({ default: false })
  resolved: boolean;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);

AlertSchema.index({ createdAt: -1 });
