import { Document, Types } from 'mongoose';
import * as mongoose from 'mongoose';
import { User } from '../../users/schemas/user.schema';
export type ChatMessageDocument = ChatMessage & Document;
export declare class ChatMessage {
    sessionType: string;
    sessionId: Types.ObjectId;
    sender: string | Types.ObjectId;
    content: string;
    readBy: (User | Types.ObjectId)[];
}
export declare const ChatMessageSchema: mongoose.Schema<ChatMessage, mongoose.Model<ChatMessage, any, any, any, Document<unknown, any, ChatMessage> & ChatMessage & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, ChatMessage, Document<unknown, {}, mongoose.FlatRecord<ChatMessage>> & mongoose.FlatRecord<ChatMessage> & {
    _id: Types.ObjectId;
}>;
