import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ActivityDocument = Activity & Document;

export enum ActivityAction {
  LOGIN = "login",
  PROFILE_UPDATE = "profile_update",
  QUIZ_ATTEMPT = "quiz_attempt",
  SUBJECT_OPEN = "subject_open",
  PAGE_VIEW = "page_view",
  PAGE_LEAVE = "page_leave",
  COURSE_OPEN = "course_open",
  CHAPTER_OPEN = "chapter_open",
  SUBCHAPTER_OPEN = "subchapter_open",
  CONTENT_OPEN = "content_open",
  VIDEO_START = "video_start",
  VIDEO_PAUSE = "video_pause",
  VIDEO_COMPLETE = "video_complete",
  QUIZ_START = "quiz_start",
  QUIZ_SUBMIT = "quiz_submit",
  EXERCISE_START = "exercise_start",
  EXERCISE_SUBMIT = "exercise_submit",
}

/** Client channel for analytics (web vs mobile split). */
export enum ActivityChannel {
  WEB = "web",
  MOBILE = "mobile",
  UNKNOWN = "unknown",
}

@Schema({ timestamps: true })
export class Activity {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ enum: ActivityAction, required: true })
  action: ActivityAction;

  @Prop()
  pagePath?: string;

  @Prop()
  resourceType?: string;

  @Prop()
  resourceId?: string;

  @Prop()
  resourceTitle?: string;

  @Prop()
  durationSec?: number;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({
    type: String,
    enum: Object.values(ActivityChannel),
    default: ActivityChannel.UNKNOWN,
  })
  channel: ActivityChannel;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

ActivitySchema.index({ timestamp: 1 });
ActivitySchema.index({ channel: 1, timestamp: -1 });
ActivitySchema.index({ userId: 1, timestamp: -1 });
ActivitySchema.index({ action: 1, timestamp: -1 });
