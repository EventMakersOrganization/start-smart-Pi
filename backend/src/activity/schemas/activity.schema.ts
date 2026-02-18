import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivityDocument = Activity & Document;

export enum ActivityAction {
  LOGIN = 'login',
  PROFILE_UPDATE = 'profile_update',
  QUIZ_ATTEMPT = 'quiz_attempt',
}

@Schema({ timestamps: true })
export class Activity {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: ActivityAction, required: true })
  action: ActivityAction;

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
