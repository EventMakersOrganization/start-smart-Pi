import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { JwtService } from '@nestjs/jwt';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly chatService;
    private readonly aiService;
    private readonly jwtService;
    server: Server;
    private logger;
    private static readonly CHAT_SOURCES_DELIM;
    private connectedUsers;
    private stripAiMetadataForHistory;
    constructor(chatService: ChatService, aiService: AiService, jwtService: JwtService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinRoom(client: Socket, payload: {
        sessionType: string;
        sessionId: string;
    }): Promise<void>;
    handleLeaveRoom(client: Socket, room: string): void;
    handleMessage(client: Socket, payload: {
        sessionType: string;
        sessionId: string;
        content: string;
    }): Promise<import("./schemas/chat-message.schema").ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    handleTyping(client: Socket, payload: {
        sessionId: string;
        sessionType: string;
        isTyping: boolean;
    }): Promise<void>;
}
