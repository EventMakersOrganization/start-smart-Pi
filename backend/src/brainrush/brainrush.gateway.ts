import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: true })
export class BrainrushGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('BrainrushGateway');

  constructor(private jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('Brainrush WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.userId;
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() data: { roomCode: string }, @ConnectedSocket() client: Socket) {
    client.join(data.roomCode);
    this.logger.log(`User ${client.data.userId} joined room ${data.roomCode}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@MessageBody() data: { roomCode: string }, @ConnectedSocket() client: Socket) {
    client.leave(data.roomCode);
    this.logger.log(`User ${client.data.userId} left room ${data.roomCode}`);
  }

  // Methods for service to call
  emitToRoom(roomCode: string, event: string, data: any) {
    this.server.to(roomCode).emit(event, data);
  }

  emitPlayerJoined(roomCode: string, data: any) {
    this.server.to(roomCode).emit('playerJoined', data);
  }

  emitNewQuestion(roomCode: string, question: any) {
    this.server.to(roomCode).emit('newQuestion', question);
  }

  emitLeaderboardUpdate(roomCode: string, leaderboard: any[]) {
    this.server.to(roomCode).emit('leaderboardUpdate', leaderboard);
  }
}
