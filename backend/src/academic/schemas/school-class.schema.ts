import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SchoolClassDocument = SchoolClass & Document;

@Schema({ timestamps: true })
export class SchoolClass {
  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  academicYear?: string;

  @Prop()
  section?: string;

  @Prop()
  level?: string;

  @Prop({ default: 0, min: 0 })
  capacity?: number;

  @Prop({ default: true })
  active?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SchoolClassSchema = SchemaFactory.createForClass(SchoolClass);
