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
import { UseGuards } from '@nestjs/common';
// For a real app, you'd use a WsGuard here. Assuming basic payload for now.

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track connected users: object key is userId, value is socketId(s)
  private connectedUsers = new Map<string, string[]>();

  constructor(private readonly chatService: ChatService) { }

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
  async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionType: string, sessionId: string, sender: string, content: string }) {
    // Save to DB
    const message = await this.chatService.saveMessage(payload);

    // Broadcast to room
    this.server.to(payload.sessionId).emit('newMessage', message);

    // Mock AI response if ChatAi
    if (payload.sessionType === 'ChatAi') {
      setTimeout(async () => {
        const aiMessage = await this.chatService.saveMessage({
          sessionType: 'ChatAi',
          sessionId: payload.sessionId,
          sender: 'AI',
          content: `Mocked AI response to: "${payload.content}"`
        });
        this.server.to(payload.sessionId).emit('newMessage', aiMessage);
      }, 1500); // simulate delay
    }
    return message;
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId: string, sender: string, isTyping: boolean }) {
    // Broadcast to room except sender
    client.broadcast.to(payload.sessionId).emit('userTyping', payload);
  }
}
