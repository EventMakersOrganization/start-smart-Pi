import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StudentProfileDocument = StudentProfile & Document;

@Schema({ timestamps: true })
export class StudentProfile {

  // ── Champs existants ──────────────────
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String, default: null })
  class: string;

  @Prop({
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'LOW',
  })
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';

  @Prop({ default: 0 })
  points_gamification: number;

  // ── Nouveaux champs Adaptive Learning ──
  @Prop({
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  })
  level: string;

  @Prop({
    type: {
      preferredStyle: { type: String, default: 'visual' },
      preferredDifficulty: { type: String, default: 'beginner' },
      studyHoursPerDay: { type: Number, default: 1 }
    },
    default: {}
  })
  learningPreferences: {
    preferredStyle: string;
    preferredDifficulty: string;
    studyHoursPerDay: number;
  };

  @Prop({ default: 0, min: 0, max: 100 })
  progress: number;

  /** Latest level-test score (0–100); separate from course-learning `progress`. */
  @Prop({ default: 0, min: 0, max: 100 })
  levelTestScore: number;

  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  weaknesses: string[];

  @Prop({ default: false })
  levelTestCompleted: boolean;

  @Prop({ default: 100, min: 0, max: 100 })
  attendance_percentage: number;
}

export const StudentProfileSchema =
  SchemaFactory.createForClass(StudentProfile);