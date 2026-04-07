import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClassEnrollmentDocument = ClassEnrollment & Document;

@Schema({ timestamps: true })
export class ClassEnrollment {
  @Prop({ type: Types.ObjectId, ref: 'SchoolClass', required: true, index: true })
  schoolClassId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ default: Date.now })
  enrolledAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ClassEnrollmentSchema = SchemaFactory.createForClass(ClassEnrollment);
ClassEnrollmentSchema.index({ schoolClassId: 1, studentId: 1 }, { unique: true });
