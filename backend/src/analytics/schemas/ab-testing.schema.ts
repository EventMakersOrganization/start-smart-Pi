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

  createdAt?: Date;
  updatedAt?: Date;
}

export const AbTestingSchema = SchemaFactory.createForClass(AbTesting);
