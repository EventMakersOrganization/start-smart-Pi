import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportDefinitionDocument = ReportDefinition & Document;

/** User-saved analytics report template (Sprint 9 report builder). */
@Schema({ timestamps: true, collection: 'report_definitions' })
export class ReportDefinition {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  /** e.g. dashboard, activity, channel */
  @Prop({ type: [String], default: [] })
  metrics: string[];

  @Prop({ type: Object, default: {} })
  filters: {
    dateFrom?: string;
    dateTo?: string;
    classLevel?: string;
  };

  @Prop({ enum: ['csv', 'xlsx'], default: 'csv' })
  format: 'csv' | 'xlsx';
}

export const ReportDefinitionSchema = SchemaFactory.createForClass(ReportDefinition);
