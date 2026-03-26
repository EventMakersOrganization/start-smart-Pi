import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly chatService;
    private readonly aiService;
    server: Server;
    private readonly logger;
    private connectedUsers;
    constructor(chatService: ChatService, aiService: AiService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinRoom(client: Socket, room: string): void;
    handleLeaveRoom(client: Socket, room: string): void;
    handleMessage(client: Socket, payload: {
        sessionType: string;
        sessionId: string;
        sender: string;
        content: string;
    }): Promise<import("./schemas/chat-message.schema").ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    handleTyping(client: Socket, payload: {
        sessionId: string;
        sender: string;
        isTyping: boolean;
    }): void;
}
