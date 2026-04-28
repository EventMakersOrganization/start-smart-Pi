import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { ActivityAction, ActivityChannel } from "./activity.schema";

export type UserSessionDocument = UserSession & Document;

@Schema({ timestamps: true, collection: "user_sessions" })
export class UserSession {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop({ default: Date.now })
  lastSeenAt: Date;

  @Prop({ default: null })
  endedAt?: Date | null;

  @Prop({ default: true })
  isOnline: boolean;

  @Prop({
    type: String,
    enum: Object.values(ActivityChannel),
    default: ActivityChannel.UNKNOWN,
  })
  channel: ActivityChannel;

  @Prop({
    type: String,
    enum: Object.values(ActivityAction),
    default: ActivityAction.PAGE_VIEW,
  })
  lastActivityAction: ActivityAction;

  @Prop({ default: Date.now })
  lastActivityAt: Date;
}

export const UserSessionSchema = SchemaFactory.createForClass(UserSession);

UserSessionSchema.index({ userId: 1, isOnline: 1, lastSeenAt: -1 });
UserSessionSchema.index({ isOnline: 1, lastSeenAt: -1 });
