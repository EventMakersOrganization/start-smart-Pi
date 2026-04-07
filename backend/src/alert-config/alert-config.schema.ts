import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AlertConfigDocument = AlertConfig & Document;

@Schema({ timestamps: true })
export class AlertConfig {
  @Prop({ required: true, default: 30, min: 0, max: 100 })
  lowThreshold: number;

  @Prop({ required: true, default: 70, min: 0, max: 100 })
  mediumThreshold: number;

  @Prop({ required: true, default: 71, min: 0, max: 100 })
  highThreshold: number;
}

export const AlertConfigSchema = SchemaFactory.createForClass(AlertConfig);
