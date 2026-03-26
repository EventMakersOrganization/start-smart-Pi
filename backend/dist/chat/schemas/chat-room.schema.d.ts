import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
export type ChatRoomDocument = ChatRoom & Document;
export declare class ChatRoom {
    name: string;
    participants: (User | Types.ObjectId)[];
}
export declare const ChatRoomSchema: import("mongoose").Schema<ChatRoom, import("mongoose").Model<ChatRoom, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatRoom>;
