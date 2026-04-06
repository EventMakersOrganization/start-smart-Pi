import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type PrositQuizAssetDocument = PrositQuizAsset & Document;

export enum PrositQuizAssetType {
  PROSIT = "prosit",
  QUIZ_FILE = "quiz_file",
}

@Schema({ timestamps: true })
export class PrositQuizAsset {
  @Prop({ type: Types.ObjectId, ref: "Subject", required: true })
  subjectId: Types.ObjectId;

  @Prop({ required: true })
  subjectTitle: string;

  @Prop({ required: true })
  chapterOrder: number;

  @Prop({ required: true })
  chapterTitle: string;

  @Prop({ required: true })
  subChapterOrder: number;

  @Prop({ required: true })
  subChapterTitle: string;

  @Prop({ required: true })
  sourceContentId: string;

  @Prop({ required: true, enum: Object.values(PrositQuizAssetType) })
  assetType: PrositQuizAssetType;

  @Prop({ required: true })
  title: string;

  @Prop()
  url?: string;

  @Prop()
  fileName?: string;

  @Prop()
  mimeType?: string;

  @Prop()
  dueDate?: Date;

  @Prop()
  submissionInstructions?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PrositQuizAssetSchema =
  SchemaFactory.createForClass(PrositQuizAsset);
