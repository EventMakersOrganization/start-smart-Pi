import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type QuizFileSubmissionDocument = QuizFileSubmission & Document;

export enum QuizFileSubmissionStatus {
  PENDING = "pending",
  GRADED = "graded",
}

@Schema({ timestamps: true })
export class QuizFileSubmission {
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
  responseFileUrl: string;

  @Prop({ required: true })
  responseFileName: string;

  @Prop()
  responseMimeType?: string;

  @Prop({
    required: true,
    enum: Object.values(QuizFileSubmissionStatus),
    default: QuizFileSubmissionStatus.PENDING,
  })
  status: QuizFileSubmissionStatus;

  @Prop({ default: null })
  grade?: number;

  @Prop({ default: null })
  teacherFeedback?: string;

  @Prop({ default: null })
  correctAnswersCount?: number;

  @Prop({ default: null })
  totalQuestionsCount?: number;

  @Prop({ type: Types.ObjectId, ref: "User", default: null })
  gradedBy?: Types.ObjectId;

  @Prop({ default: null })
  gradedAt?: Date;

  @Prop({ default: new Date() })
  submittedAt: Date;
}

export const QuizFileSubmissionSchema =
  SchemaFactory.createForClass(QuizFileSubmission);
