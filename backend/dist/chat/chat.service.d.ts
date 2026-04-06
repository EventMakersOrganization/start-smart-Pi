import { Model } from 'mongoose';
import { ChatAi, ChatAiDocument } from './schemas/chat-ai.schema';
import { ChatInstructorDocument } from './schemas/chat-instructor.schema';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { UserDocument } from '../users/schemas/user.schema';
export declare class ChatService {
    private chatAiModel;
    private chatInstructorModel;
    private chatRoomModel;
    private chatMessageModel;
    private userModel;
    constructor(chatAiModel: Model<ChatAiDocument>, chatInstructorModel: Model<ChatInstructorDocument>, chatRoomModel: Model<ChatRoomDocument>, chatMessageModel: Model<ChatMessageDocument>, userModel: Model<UserDocument>);
    createAiSession(studentId: string, title?: string): Promise<ChatAi & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    resolveParticipants(session: any): Promise<any>;
    createInstructorSession(studentId: string, instructorId: string): Promise<any>;
    createRoom(name: string, participants: string[]): Promise<ChatRoom & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    getUserSessions(userId: string, role?: string): Promise<{
        ai: import("mongoose").LeanDocument<ChatAi & import("mongoose").Document<any, any, any> & {
            _id: import("mongoose").Types.ObjectId;
        }>[];
        instructor: any[];
        rooms: any[];
    }>;
    getChatHistory(sessionType: string, sessionId: string, reqUserId: string): Promise<import("mongoose").LeanDocument<ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>[]>;
    getRecentHistory(sessionId: string, limit?: number): Promise<import("mongoose").LeanDocument<ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>[]>;
    saveMessage(data: {
        sessionType: string;
        sessionId: string;
        sender: string | 'AI';
        content: string;
    }): Promise<ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    isParticipant(sessionType: string, sessionId: string, userId: string): Promise<boolean>;
    deleteMessage(messageId: string, userId: string): Promise<any>;
    deleteAiSession(sessionId: string, userId: string): Promise<any>;
}
