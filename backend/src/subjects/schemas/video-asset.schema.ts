import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type VideoAssetDocument = VideoAsset & Document;

export enum VideoAssetType {
  VIDEO_LINK = "video_link",
  VIDEO_FILE = "video_file",
}

@Schema({ timestamps: true })
export class VideoAsset {
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

  @Prop({ required: true, enum: Object.values(VideoAssetType) })
  assetType: VideoAssetType;

  @Prop({ required: true })
  title: string;

  @Prop()
  url?: string;

  @Prop()
  fileName?: string;

  @Prop()
  mimeType?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const VideoAssetSchema = SchemaFactory.createForClass(VideoAsset);
