import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StudentProfileDocument = StudentProfile & Document;

@Schema({ timestamps: true })
export class StudentProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  academicLevel: string;

  @Prop({ required: true })
  enrolledCourse: string;

  @Prop({ type: Object, default: {} })
  preferences: Record<string, any>;

  @Prop({ default: 0 })
  averageScore: number;
}

export const StudentProfileSchema = SchemaFactory.createForClass(StudentProfile);
