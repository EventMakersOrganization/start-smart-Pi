import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivityDocument = Activity & Document;

export enum ActivityAction {
  LOGIN = 'login',
  PROFILE_UPDATE = 'profile_update',
  QUIZ_ATTEMPT = 'quiz_attempt',
}

/** Client channel for analytics (web vs mobile split). */
export enum ActivityChannel {
  WEB = 'web',
  MOBILE = 'mobile',
  UNKNOWN = 'unknown',
}

@Schema({ timestamps: true })
export class Activity {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: ActivityAction, required: true })
  action: ActivityAction;

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
