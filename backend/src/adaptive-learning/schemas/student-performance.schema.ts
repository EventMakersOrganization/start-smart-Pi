import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StudentPerformanceDocument = StudentPerformance & Document;

@Schema({ timestamps: true })
export class StudentPerformance {

  @Prop({ required: true })
  studentId: string;

  @Prop({ required: true })
  exerciseId: string;

  @Prop({ required: true, min: 0, max: 100 })
  score: number;

  @Prop({ default: 0 })
  timeSpent: number;

  @Prop({ default: Date.now })
  attemptDate: Date;

  @Prop({
    enum: ['quiz', 'exercise', 'brainrush', 'level-test'],
    default: 'exercise'
  })
  source: string;

  // ── Nouveaux champs pour adaptation ──
  @Prop({ default: 'general' })
  topic: string;

  @Prop({
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  })
  difficulty: string;
}

export const StudentPerformanceSchema =
  SchemaFactory.createForClass(StudentPerformance);