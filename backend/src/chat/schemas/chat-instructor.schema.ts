import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type ChatInstructorDocument = ChatInstructor & Document;

@Schema({ timestamps: true, collection: 'ChatInstructor' })
export class ChatInstructor {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: (User | Types.ObjectId)[];
}

export const ChatInstructorSchema = SchemaFactory.createForClass(ChatInstructor);
