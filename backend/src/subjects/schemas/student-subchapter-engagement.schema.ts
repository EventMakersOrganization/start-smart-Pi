import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type StudentSubchapterEngagementDocument = StudentSubchapterEngagement &
  Document;

export interface ContentEngagementSnapshot {
  videoWatchedFraction?: number;
  readingScrollFraction?: number;
  readingActiveSeconds?: number;
}

@Schema({ timestamps: true })
export class StudentSubchapterEngagement {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Subject", required: true })
  subjectId: Types.ObjectId;

  @Prop({ required: true })
  chapterOrder: number;

  @Prop({ required: true })
  subChapterOrder: number;

  /** Per contentId (UUID from subject tree) — last reported engagement. */
  @Prop({ type: Object, default: {} })
  byContentId: Record<string, ContentEngagementSnapshot>;
}

export const StudentSubchapterEngagementSchema = SchemaFactory.createForClass(
  StudentSubchapterEngagement,
);

StudentSubchapterEngagementSchema.index(
  { studentId: 1, subjectId: 1, chapterOrder: 1, subChapterOrder: 1 },
  { unique: true },
);
