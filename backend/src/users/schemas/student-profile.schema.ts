import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StudentProfileDocument = StudentProfile & Document;

@Schema({ timestamps: true })
export class StudentProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String, default: null })
  academic_level: string;

  @Prop({
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'LOW',
  })
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';

  @Prop({ default: 0 })
  points_gamification: number;
}

export const StudentProfileSchema = SchemaFactory.createForClass(StudentProfile);
