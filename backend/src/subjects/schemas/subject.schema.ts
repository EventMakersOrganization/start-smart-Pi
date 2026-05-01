import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/** Subject shell: identity + instructors. Curriculum lives in `courses` (linked via subjectId). */
export type SubjectDocument = Subject & Document;

@Schema({ timestamps: true })
export class Subject {
  @Prop({ required: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: "User" }], default: [] })
  instructors: Types.ObjectId[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);
