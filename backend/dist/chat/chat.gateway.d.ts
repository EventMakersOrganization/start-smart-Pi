import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly chatService;
    private readonly jwtService;
    server: Server;
    private logger;
    private connectedUsers;
    constructor(chatService: ChatService, jwtService: JwtService);
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
    }): Promise<import("mongoose").Document<unknown, {}, import("./schemas/chat-message.schema").ChatMessageDocument> & import("./schemas/chat-message.schema").ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    handleTyping(client: Socket, payload: {
        sessionId: string;
        sessionType: string;
        isTyping: boolean;
    }): Promise<void>;
    handleDeleteMessage(client: Socket, payload: {
        messageId: string;
        sessionId: string;
    }): Promise<void>;
}
