import { ChatService } from './chat.service';
import { AiService } from './ai.service';
export declare class ChatController {
    private readonly chatService;
    private readonly aiService;
    constructor(chatService: ChatService, aiService: AiService);
    createAiSession(req: any, body: {
        title?: string;
    }): Promise<import("./schemas/chat-ai.schema").ChatAi & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    createInstructorSession(req: any, body: {
        instructorId: string;
    }): Promise<any>;
    createRoom(req: any, body: {
        name: string;
        participants: string[];
    }): Promise<import("./schemas/chat-room.schema").ChatRoom & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    getUserSessions(req: any): Promise<{
        ai: import("mongoose").LeanDocument<import("./schemas/chat-ai.schema").ChatAi & import("mongoose").Document<any, any, any> & {
            _id: import("mongoose").Types.ObjectId;
        }>[];
        instructor: any[];
        rooms: any[];
    }>;
    getChatHistory(req: any, sessionType: string, sessionId: string): Promise<import("mongoose").LeanDocument<import("./schemas/chat-message.schema").ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>[]>;
    sendMessage(req: any, body: {
        sessionType: string;
        sessionId: string;
        content: string;
    }): Promise<import("./schemas/chat-message.schema").ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    semanticSearch(query: string, nResults?: string): Promise<{
        results: import("./ai.service").SemanticSearchResult[];
    }>;
    aiHealth(): Promise<{
        status: string;
        model?: string;
    }>;
}
