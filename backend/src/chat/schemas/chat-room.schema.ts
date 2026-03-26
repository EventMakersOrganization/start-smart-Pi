import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type ChatRoomDocument = ChatRoom & Document;

@Schema({ timestamps: true, collection: 'ChatRoom' })
export class ChatRoom {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: (User | Types.ObjectId)[];
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);
