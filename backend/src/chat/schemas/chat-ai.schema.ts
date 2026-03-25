import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type ChatAiDocument = ChatAi & Document;

@Schema({ timestamps: true, collection: 'ChatAi' })
export class ChatAi {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  student: User | Types.ObjectId;

  @Prop({ required: false })
  title: string;
}

export const ChatAiSchema = SchemaFactory.createForClass(ChatAi);
