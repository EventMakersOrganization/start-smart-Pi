import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlertDocument = Alert & Document;

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Schema({ timestamps: true })
export class Alert {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  student: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  instructor: Types.ObjectId;

  @Prop({ required: true })
  message: string;

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
