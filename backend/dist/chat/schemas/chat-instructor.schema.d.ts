import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
export type ChatInstructorDocument = ChatInstructor & Document;
export declare class ChatInstructor {
    participants: (User | Types.ObjectId)[];
}
export declare const ChatInstructorSchema: import("mongoose").Schema<ChatInstructor, import("mongoose").Model<ChatInstructor, any, any, any, Document<unknown, any, ChatInstructor> & ChatInstructor & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatInstructor, Document<unknown, {}, import("mongoose").FlatRecord<ChatInstructor>> & import("mongoose").FlatRecord<ChatInstructor> & {
    _id: Types.ObjectId;
}>;
