import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PrositSubmissionDocument = PrositSubmission & Document;

@Schema({ timestamps: true })
export class PrositSubmission {
  @Prop({ required: true })
  prositTitle: string;

  /** Optional disambiguation when chapter titles repeat across subjects. */
  @Prop({ required: false })
  subjectTitle?: string;

  @Prop({ required: true })
  chapterTitle: string;

  @Prop({ required: true })
  subChapterTitle: string;

  @Prop({ required: true })
  studentId: string;

  @Prop({ required: true })
  studentName: string;

  @Prop({ required: true })
  studentEmail: string;

  @Prop({ required: false })
  reportText: string;

  @Prop({ required: false })
  reportHtml: string;

  @Prop({ required: false })
  wordCount: number;

  @Prop({ required: false })
  fileName: string;

  @Prop({ required: false })
  fileUrl: string;

  @Prop({ required: false })
  filePath: string;

  @Prop({ required: false })
  dueDate: string;

  @Prop({ default: "submitted", enum: ["submitted", "graded", "reviewed"] })
  status: string;

  @Prop({ required: false })
  grade: number;

  @Prop({ required: false })
  feedback: string;

  @Prop({ required: false })
  submittedAt: Date;

  @Prop({ required: false })
  gradedAt: Date;
}

export const PrositSubmissionSchema =
  SchemaFactory.createForClass(PrositSubmission);
