import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type QuizSubmissionDocument = QuizSubmission & Document;

@Schema({ _id: false })
export class QuizAnswer {
  @Prop({ required: true })
  questionIndex: number;

  @Prop({ required: true })
  selectedOptionIndex: number;

  @Prop()
  correctOptionIndex?: number;

  @Prop({ required: true })
  isCorrect: boolean;
}

export const QuizAnswerSchema = SchemaFactory.createForClass(QuizAnswer);

@Schema({ timestamps: true })
export class QuizSubmission {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  studentId: Types.ObjectId;

  @Prop({ required: true })
  quizId: string;

  @Prop({ required: true })
  quizTitle: string;

  @Prop({ required: true })
  subjectTitle: string;

  @Prop({ required: true })
  chapterTitle: string;

  @Prop({ required: true })
  subChapterTitle: string;

  @Prop({ required: true })
  totalQuestions: number;

  @Prop({ required: true })
  scoreObtained: number;

  @Prop({ required: true })
  scorePercentage: number;

  @Prop({ type: [QuizAnswerSchema], default: [] })
  answers: QuizAnswer[];

  @Prop({ default: new Date() })
  submittedAt: Date;

  @Prop({ default: null })
  updatedAt?: Date;
}

export const QuizSubmissionSchema =
  SchemaFactory.createForClass(QuizSubmission);
