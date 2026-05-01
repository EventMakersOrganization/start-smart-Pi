import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ResourceAddAssetDocument = ResourceAddAsset & Document;

export enum ResourceAddAssetType {
  RESOURCE_FILE = "resource_file",
  RESOURCE_LINK = "resource_link",
  RESOURCE_CODE = "resource_code",
}

@Schema({ timestamps: true })
export class ResourceAddAsset {
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

  @Prop({ required: true, enum: Object.values(ResourceAddAssetType) })
  assetType: ResourceAddAssetType;

  @Prop({ required: true })
  title: string;

  @Prop()
  url?: string;

  @Prop()
  fileName?: string;

  @Prop()
  mimeType?: string;

  @Prop()
  codeSnippet?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ResourceAddAssetSchema =
  SchemaFactory.createForClass(ResourceAddAsset);
