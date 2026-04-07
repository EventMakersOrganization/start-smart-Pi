import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  @Prop({ required: true, unique: true, index: true })
  date: Date;

  @Prop({ required: true, default: 0 })
  totalUsers: number;

  @Prop({ required: true, default: 0 })
  activeUsers: number;

  @Prop({ required: true, default: 0 })
  highRiskUsers: number;

  @Prop({ required: true, default: 0 })
  alertsCount: number;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
