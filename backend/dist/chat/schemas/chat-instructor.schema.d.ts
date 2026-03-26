import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
export type ChatInstructorDocument = ChatInstructor & Document;
export declare class ChatInstructor {
    participants: (User | Types.ObjectId)[];
}
export declare const ChatInstructorSchema: import("mongoose").Schema<ChatInstructor, import("mongoose").Model<ChatInstructor, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ChatInstructor>;
