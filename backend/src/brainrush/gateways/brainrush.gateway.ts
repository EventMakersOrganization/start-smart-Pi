import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket, 
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { LeaderboardService } from '../services/leaderboard.service';

@WebSocketGateway({ namespace: '/brainrush', cors: true })
export class BrainrushGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private logger = new Logger('BrainrushGateway');

  constructor(private leaderboardService: LeaderboardService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinGameRoom')
  handleJoinRoom(@MessageBody() roomCode: string, @ConnectedSocket() client: Socket) {
    client.join(roomCode);
    this.logger.log(`Client ${client.id} joined room ${roomCode}`);
    this.server.to(roomCode).emit('playerJoined', { playerId: client.id });
  }

  @SubscribeMessage('updateScore')
  async handleUpdateScore(
    @MessageBody() payload: { gameSessionId: string, roomCode: string },
    @ConnectedSocket() client: Socket
  ) {
    const leaderboard = await this.leaderboardService.getLeaderboard(payload.gameSessionId);
    this.server.to(payload.roomCode).emit('leaderboardUpdate', leaderboard);
  }
}
