import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClassInstructorDocument = ClassInstructor & Document;

@Schema({ timestamps: true })
export class ClassInstructor {
  @Prop({ type: Types.ObjectId, ref: 'SchoolClass', required: true, index: true })
  schoolClassId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  instructorId: Types.ObjectId;

  @Prop({ default: Date.now })
  assignedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ClassInstructorSchema = SchemaFactory.createForClass(ClassInstructor);
ClassInstructorSchema.index({ schoolClassId: 1, instructorId: 1 }, { unique: true });
