import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClassSubjectDocument = ClassSubject & Document;

@Schema({ timestamps: true })
export class ClassSubject {
  @Prop({ type: Types.ObjectId, ref: 'SchoolClass', required: true, index: true })
  schoolClassId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true, index: true })
  subjectId: Types.ObjectId;

  @Prop({ default: Date.now })
  linkedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ClassSubjectSchema = SchemaFactory.createForClass(ClassSubject);
ClassSubjectSchema.index({ schoolClassId: 1, subjectId: 1 }, { unique: true });
