import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExplainabilityLogDocument = ExplainabilityLog & Document;

@Schema({ _id: false })
export class ExplainabilityFactor {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  impact: number;
}

export const ExplainabilityFactorSchema =
  SchemaFactory.createForClass(ExplainabilityFactor);

@Schema({ timestamps: true })
export class ExplainabilityLog {
  @Prop({ required: true, trim: true })
  userId: string;

  @Prop({ required: true, trim: true })
  recommendationId: string;

  @Prop({ required: true })
  riskScore: number;

  @Prop({ required: true, trim: true })
  decision: string;

  @Prop({ required: true, trim: true })
  explanation: string;

  @Prop({ type: [ExplainabilityFactorSchema], default: [] })
  factors: ExplainabilityFactor[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const ExplainabilityLogSchema =
  SchemaFactory.createForClass(ExplainabilityLog);
