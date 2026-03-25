import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
export type ChatAiDocument = ChatAi & Document;
export declare class ChatAi {
    student: User | Types.ObjectId;
    title: string;
}
export declare const ChatAiSchema: import("mongoose").Schema<ChatAi, import("mongoose").Model<ChatAi, any, any, any, Document<unknown, any, ChatAi> & ChatAi & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatAi, Document<unknown, {}, import("mongoose").FlatRecord<ChatAi>> & import("mongoose").FlatRecord<ChatAi> & {
    _id: Types.ObjectId;
}>;
