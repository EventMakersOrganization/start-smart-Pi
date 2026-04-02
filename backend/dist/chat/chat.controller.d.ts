import { ChatService } from './chat.service';
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    createAiSession(req: any, body: {
        title?: string;
    }): Promise<import("mongoose").Document<unknown, {}, import("./schemas/chat-ai.schema").ChatAiDocument> & import("./schemas/chat-ai.schema").ChatAi & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    createInstructorSession(req: any, body: {
        instructorId: string;
    }): Promise<any>;
    createRoom(req: any, body: {
        name: string;
        participants: string[];
    }): Promise<import("mongoose").Document<unknown, {}, import("./schemas/chat-room.schema").ChatRoomDocument> & import("./schemas/chat-room.schema").ChatRoom & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    getUserSessions(req: any): Promise<{
        ai: (import("mongoose").FlattenMaps<import("./schemas/chat-ai.schema").ChatAiDocument> & {
            _id: import("mongoose").Types.ObjectId;
        })[];
        instructor: any[];
        rooms: any[];
    }>;
    getChatHistory(req: any, sessionType: string, sessionId: string): Promise<(import("mongoose").FlattenMaps<import("./schemas/chat-message.schema").ChatMessageDocument> & {
        _id: import("mongoose").Types.ObjectId;
    })[]>;
    sendMessage(req: any, body: {
        sessionType: string;
        sessionId: string;
        content: string;
    }): Promise<import("mongoose").Document<unknown, {}, import("./schemas/chat-message.schema").ChatMessageDocument> & import("./schemas/chat-message.schema").ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    deleteMessage(req: any, messageId: string): Promise<any>;
    deleteAiSession(req: any, sessionId: string): Promise<any>;
}
