import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');

  // Track connected users: object key is userId, value is socketId(s)
  private connectedUsers = new Map<string, string[]>();

  constructor(
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
    private readonly jwtService: JwtService
  ) { }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake?.auth?.token || client.handshake?.query?.token;
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = await this.jwtService.verifyAsync(token as string);
      const userId = payload.sub || payload.id;
      
      if (userId) {
        client.data.user = { id: userId, email: payload.email, role: payload.role };
        if (!this.connectedUsers.has(userId)) {
          this.connectedUsers.set(userId, []);
        }
        this.connectedUsers.get(userId).push(client.id);

        // Broadcast online status
        this.server.emit('userStatus', { userId, status: 'online' });
        this.logger.log(`Client authenticated: ${userId} (${client.id})`);
      }
    } catch (e) {
      this.logger.error('Connection authentication failed');
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.user?.id;
    if (userId && this.connectedUsers.has(userId)) {
      const sockets = this.connectedUsers.get(userId);
      const index = sockets.indexOf(client.id);
      if (index !== -1) {
        sockets.splice(index, 1);
      }
      if (sockets.length === 0) {
        this.connectedUsers.delete(userId);
        // Broadcast offline status
        this.server.emit('userStatus', { userId, status: 'offline' });
      }
    }
    console.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionType: string, sessionId: string }) {
    const userId = client.data.user.id;
    const userRole = client.data.user.role;

    if (payload.sessionType === 'ChatRoom' && userRole !== 'student') {
      this.logger.warn(`User ${userId} (role: ${userRole}) attempted to join ChatRoom ${payload.sessionId}`);
      return;
    }

    const isAllowed = await this.chatService.isParticipant(payload.sessionType, payload.sessionId, userId);
    
    if (isAllowed) {
      client.join(payload.sessionId);
      this.logger.log(`User ${userId} joined room ${payload.sessionId}`);
    } else {
      this.logger.warn(`User ${userId} attempted to join unauthorized room ${payload.sessionId}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    client.leave(room);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionType: string, sessionId: string, content: string }) {
    const userId = client.data.user.id;
    const userRole = client.data.user.role;

    if (payload.sessionType === 'ChatRoom' && userRole !== 'student') {
      this.logger.warn(`User ${userId} (role: ${userRole}) attempted to send to ChatRoom ${payload.sessionId}`);
      return;
    }

    const isAllowed = await this.chatService.isParticipant(payload.sessionType, payload.sessionId, userId);

    if (!isAllowed) {
      this.logger.warn(`User ${userId} attempted to send message to unauthorized room ${payload.sessionId}`);
      return;
    }

    // Save to DB with authenticated userId as sender
    const message = await this.chatService.saveMessage({
      sessionType: payload.sessionType,
      sessionId: payload.sessionId,
      sender: userId,
      content: payload.content,
    });

    // Broadcast to room
    this.server.to(payload.sessionId).emit('newMessage', message);

    if (payload.sessionType === 'ChatAi') {
      this.server
        .to(payload.sessionId)
        .emit('userTyping', { sender: 'AI', isTyping: true });

      try {
        const history = await this.chatService.getRecentHistory(
          payload.sessionId,
          6,
        );
        const conversationHistory = history.map((m) => ({
          role: m.sender === 'AI' ? 'assistant' : 'user',
          content: m.content,
        }));

        const aiResponse = await this.aiService.askChatbot(
          payload.content,
          conversationHistory,
        );

        let content = aiResponse.answer;
        if (aiResponse.sources?.length > 0) {
          const srcList = aiResponse.sources
            .slice(0, 3)
            .map(
              (s) =>
                `📖 ${s.course_title} (${Math.round(s.similarity * 100)}%)`,
            )
            .join('\n');
          content += `\n\n---\n**Sources:**\n${srcList}`;
        }
        if (aiResponse.confidence > 0) {
          content += `\n\n🎯 Confidence: ${Math.round(aiResponse.confidence * 100)}%`;
        }

        const aiMessage = await this.chatService.saveMessage({
          sessionType: 'ChatAi',
          sessionId: payload.sessionId,
          sender: 'AI',
          content,
        });
        this.server.to(payload.sessionId).emit('newMessage', aiMessage);
      } catch (error) {
        this.logger.error(`AI response failed: ${error.message}`);
        const fallback = await this.chatService.saveMessage({
          sessionType: 'ChatAi',
          sessionId: payload.sessionId,
          sender: 'AI',
          content:
            'I am temporarily unavailable. Please try again in a moment.',
        });
        this.server.to(payload.sessionId).emit('newMessage', fallback);
      } finally {
        this.server
          .to(payload.sessionId)
          .emit('userTyping', { sender: 'AI', isTyping: false });
      }
    }
    return message;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  async handleTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId: string, sessionType: string, isTyping: boolean }) {
    const userId = client.data.user.id;
    const isAllowed = await this.chatService.isParticipant(payload.sessionType, payload.sessionId, userId);
    
    if (isAllowed) {
      client.broadcast.to(payload.sessionId).emit('userTyping', {
        sessionId: payload.sessionId,
        sender: userId,
        isTyping: payload.isTyping
      });
    }
  }
}
