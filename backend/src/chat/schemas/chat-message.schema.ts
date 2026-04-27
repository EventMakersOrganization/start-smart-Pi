import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as mongoose from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type ChatMessageDocument = ChatMessage & Document;

@Schema({ timestamps: true, collection: 'ChatMessages' })
export class ChatMessage {
  @Prop({ required: true, enum: ['ChatAi', 'ChatInstructor', 'ChatRoom'] })
  sessionType: string;

  @Prop({ type: Types.ObjectId, required: true, refPath: 'sessionType' })
  sessionId: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: true })
  sender: string | Types.ObjectId;

  @Prop({ required: false })
  content: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  readBy: (User | Types.ObjectId)[];

  @Prop({ type: [{ url: String, filename: String, fileType: String }], default: [] })
  attachments: { url: string; filename: string; fileType: string }[];
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
