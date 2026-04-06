import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { Document, Types } from "mongoose";

export type SubjectDocument = Subject & Document;

@Schema({ _id: false })
export class QuizQuestion {
  @Prop({ required: true })
  question: string;

  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ required: true })
  correctOptionIndex: number;
}

export const QuizQuestionSchema = SchemaFactory.createForClass(QuizQuestion);

@Schema({ _id: false })
export class SubChapterContent {
  @Prop({ required: true, default: () => randomUUID() })
  contentId: string;

  @Prop({
    required: true,
    enum: ["cours", "exercices", "videos", "ressources"],
    default: "cours",
  })
  folder: "cours" | "exercices" | "videos" | "ressources";

  @Prop({
    required: true,
    enum: ["file", "quiz", "video", "link", "prosit", "code"],
  })
  type: "file" | "quiz" | "video" | "link" | "prosit" | "code";

  @Prop({ required: true })
  title: string;

  @Prop()
  url?: string;

  @Prop()
  quizText?: string;

  @Prop({ type: [QuizQuestionSchema], default: [] })
  quizQuestions?: QuizQuestion[];

  @Prop()
  fileName?: string;

  @Prop()
  mimeType?: string;

  @Prop()
  dueDate?: Date;

  @Prop()
  submissionInstructions?: string;

  @Prop()
  codeSnippet?: string;

  @Prop({ default: Date.now })
  createdAt?: Date;
}

export const SubChapterContentSchema =
  SchemaFactory.createForClass(SubChapterContent);

@Schema({ _id: false })
export class SubChapter {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ type: [SubChapterContentSchema], default: [] })
  contents: SubChapterContent[];
}

export const SubChapterSchema = SchemaFactory.createForClass(SubChapter);

@Schema({ _id: false })
export class Chapter {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ type: [SubChapterSchema], default: [] })
  subChapters: SubChapter[];
}

export const ChapterSchema = SchemaFactory.createForClass(Chapter);

@Schema({ timestamps: true })
export class Subject {
  @Prop({ required: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  instructors: Types.ObjectId[];

  @Prop({ type: [ChapterSchema], default: [] })
  chapters: Chapter[];

  createdAt?: Date;
  updatedAt?: Date;







}

