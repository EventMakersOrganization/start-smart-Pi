import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string[]>();

  constructor(
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, []);
      }
      this.connectedUsers.get(userId).push(client.id);

      // Broadcast online status
      this.server.emit('userStatus', { userId, status: 'online' });
    }
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
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

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    client.join(room);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    client.leave(room);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      sessionType: string;
      sessionId: string;
      sender: string;
      content: string;
    },
  ) {
    const message = await this.chatService.saveMessage(payload);
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

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId: string, sender: string, isTyping: boolean }) {
    // Broadcast to room except sender
    client.broadcast.to(payload.sessionId).emit('userTyping', payload);
  }
}
