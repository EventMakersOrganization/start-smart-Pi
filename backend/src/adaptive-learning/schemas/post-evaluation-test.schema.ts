import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PostEvaluationTestDocument = PostEvaluationTest & Document;

@Schema({ timestamps: true })
export class PostEvaluationTest {
  @Prop({ required: true, index: true })
  studentId: string;

  @Prop({ required: false, index: true })
  sessionId?: string;

  @Prop({
    enum: ["in-progress", "completed"],
    default: "in-progress",
  })
  status: string;

  @Prop({
    type: [
      {
        questionText: String,
        options: [String],
        topic: String,
        chapter_title: String,
        difficulty: String,
      },
    ],
    default: [],
  })
  questions: Array<{
    questionText: string;
    options: string[];
    topic: string;
    chapter_title?: string;
    difficulty: string;
  }>;

  @Prop({
    type: [
      {
        questionIndex: Number,
        selectedAnswer: String,
        isCorrect: Boolean,
        timeSpent: Number,
      },
    ],
    default: [],
  })
  answers: Array<{
    questionIndex: number;
    selectedAnswer: string;
    isCorrect: boolean;
    timeSpent: number;
  }>;

  @Prop({ default: 0 })
  totalScore: number;

  @Prop({
    type: [
      {
        topic: String,
        score: Number,
        correct: Number,
        total: Number,
      },
    ],
    default: [],
  })
  areaScores: Array<{
    topic: string;
    score: number;
    correct: number;
    total: number;
  }>;

  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @Prop()
  completedAt?: Date;
}

export const PostEvaluationTestSchema =
  SchemaFactory.createForClass(PostEvaluationTest);

