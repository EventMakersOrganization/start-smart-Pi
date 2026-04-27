import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LevelTestDocument = LevelTest & Document;

@Schema({ timestamps: true })
export class LevelTest {

  @Prop({ required: true })
  studentId: string;

  @Prop({
    type: [{
      questionText: String,
      options: [String],
      correctAnswer: String,
      topic: String,
      chapter_title: String,
      difficulty: String
    }],
    default: []
  })
  questions: {
    questionText: string;
    options: string[];
    correctAnswer: string;
    topic: string;
    chapter_title?: string;
    difficulty: string;
  }[];

  @Prop({
    type: [{
      questionIndex: Number,
      selectedAnswer: String,
      isCorrect: Boolean,
      timeSpent: Number
    }],
    default: []
  })
  answers: {
    questionIndex: number;
    selectedAnswer: string;
    isCorrect: boolean;
    timeSpent: number;
  }[];

  @Prop({ default: 0 })
  totalScore: number;

  @Prop({
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  })
  resultLevel: string;

  @Prop({
    type: [{
      topic: String,
      chapter: String,
      subject: String,
      score: Number,
      correct: Number,
      total: Number
    }],
    default: []
  })
  detectedStrengths: {
    topic: string;
    chapter?: string;
    subject?: string;
    score: number;
    correct?: number;
    total?: number;
  }[];

  @Prop({
    type: [{
      topic: String,
      chapter: String,
      subject: String,
      score: Number,
      correct: Number,
      total: Number
    }],
    default: []
  })
  detectedWeaknesses: {
    topic: string;
    chapter?: string;
    subject?: string;
    score: number;
    correct?: number;
    total?: number;
  }[];

  @Prop({
    enum: ['in-progress', 'completed'],
    default: 'in-progress'
  })
  status: string;

  @Prop()
  completedAt: Date;
}

export const LevelTestSchema =
  SchemaFactory.createForClass(LevelTest);
