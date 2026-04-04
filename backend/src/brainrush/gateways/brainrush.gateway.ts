import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LeaderboardService } from '../services/leaderboard.service';
import { RoomService } from '../services/room.service';
import { MultiplayerGameService } from '../services/multiplayer-game.service';

// ── Payload interfaces ──────────────────────────────────────────────────────

interface CreateRoomPayload {
  username: string;
  avatar: string;
  userId?: string;
}

interface JoinRoomPayload {
  roomCode: string;
  username: string;
  avatar: string;
  userId?: string;
}

interface StartGamePayload {
  roomCode: string;
  subject: string;
  difficulty: string;
}

interface SubmitAnswerPayload {
  roomCode: string;
  answer: string;
  responseTime: number;
}

interface SubmitFinalScorePayload {
  roomCode: string;
  username: string;
  avatar: string;
  score: number;
  difficulty: string;
}

interface UpdateScorePayload {
  gameSessionId: string;
  roomCode: string;
}

// ── Gateway ─────────────────────────────────────────────────────────────────

@WebSocketGateway({ namespace: '/brainrush', cors: { origin: '*' } })
export class BrainrushGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('BrainrushGateway');

  // roomCode → Map<socketId, { username, avatar, score, difficulty }>
  private finalScores = new Map<string, Map<string, { username: string; avatar: string; score: number; difficulty: string }>>();

  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly roomService: RoomService,
    private readonly gameService: MultiplayerGameService,
  ) { }

  afterInit() {
    this.gameService.setServer(this.server);
  }

  // ── Connection lifecycle ──────────────────────────────────────────────────

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    const { room, wasHost, roomCode } = this.roomService.removePlayer(client.id);

    if (!roomCode) return; // Player wasn't in any room

    if (!room) {
      // Room was deleted (was empty)
      if (roomCode) {
        this.gameService.cleanupRoom(roomCode);
        this.logger.log(`Resources for room ${roomCode} cleaned up.`);
      }
      return;
    }

    // Notify remaining players
    this.server.to(roomCode).emit('playerLeft', {
      socketId: client.id,
      players: room.players,
      newHostId: room.hostId,
    });

    this.logger.log(`Player ${client.id} left room ${roomCode}. Players left: ${room.players.length}`);
  }

  // ── Create Room ───────────────────────────────────────────────────────────

  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @MessageBody() payload: CreateRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { username, avatar, userId } = payload;

      if (!username || username.trim().length === 0) {
        client.emit('roomError', { message: 'Username is required' });
        return;
      }

      const room = this.roomService.createRoom(client.id, username.trim(), avatar || '👤', userId);

      // Join the socket.io room channel
      await client.join(room.roomCode);

      // Confirm to caller
      client.emit('roomCreated', {
        roomCode: room.roomCode,
        room: {
          roomCode: room.roomCode,
          hostId: room.hostId,
          players: room.players,
          status: room.status,
        },
      });

      this.logger.log(`Room ${room.roomCode} created by ${username}`);
    } catch (err) {
      this.logger.error('createRoom error', err);
      client.emit('roomError', { message: 'Failed to create room' });
    }
  }

  // ── Join Room ─────────────────────────────────────────────────────────────

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { roomCode, username, avatar, userId } = payload;

      if (!roomCode || roomCode.trim().length !== 6) {
        client.emit('roomError', { message: 'Invalid room code' });
        return;
      }

      if (!username || username.trim().length === 0) {
        client.emit('roomError', { message: 'Username is required' });
        return;
      }

      const validation = this.roomService.validateRoom(roomCode.trim().toUpperCase());
      if (!validation.valid) {
        client.emit('roomError', { message: validation.error });
        return;
      }

      const { room, error } = this.roomService.joinRoom(
        roomCode.trim().toUpperCase(),
        client.id,
        username.trim(),
        avatar || '👤',
        userId,
      );

      if (error) {
        client.emit('roomError', { message: error });
        return;
      }

      // Join socket.io room channel
      await client.join(room.roomCode);

      // Confirm to joiner
      client.emit('roomJoined', {
        roomCode: room.roomCode,
        room: {
          roomCode: room.roomCode,
          hostId: room.hostId,
          players: room.players,
          status: room.status,
        },
      });

      // Notify ALL in room (including the joiner) of updated player list
      this.server.to(room.roomCode).emit('playerJoined', {
        players: room.players,
        newPlayer: { socketId: client.id, username: username.trim(), avatar: avatar || '👤' },
      });

      this.logger.log(`${username} joined room ${room.roomCode}`);
    } catch (err) {
      this.logger.error('joinRoom error', err);
      client.emit('roomError', { message: 'Failed to join room' });
    }
  }

  // ── Start Game ────────────────────────────────────────────────────────────

  @SubscribeMessage('startGame')
  async handleStartGame(
    @MessageBody() payload: StartGamePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { roomCode, subject, difficulty } = payload;
      const { room, error } = this.roomService.startGame(roomCode, client.id);

      if (error) {
        client.emit('roomError', { message: error });
        return;
      }

      // Initialize the authoritative game loop
      await this.gameService.startGame(roomCode, subject || 'Programming', difficulty || 'medium');

      this.logger.log(`Game started in room ${roomCode}`);
    } catch (err) {
      this.logger.error('startGame error', err);
      client.emit('roomError', { message: 'Failed to start game' });
    }
  }

  @SubscribeMessage('submitAnswer')
  handleSubmitAnswer(
    @MessageBody() payload: SubmitAnswerPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { roomCode, answer, responseTime } = payload;
    this.gameService.submitAnswer(roomCode, client.id, answer, responseTime);
  }

  // ── Legacy: joinGameRoom (for quiz score updates) ─────────────────────────

  @SubscribeMessage('joinGameRoom')
  handleJoinGameRoom(@MessageBody() roomCode: string, @ConnectedSocket() client: Socket) {
    client.join(roomCode);
    this.logger.log(`Client ${client.id} joined game room ${roomCode}`);
    this.server.to(roomCode).emit('playerJoined', { playerId: client.id });
  }

  // ── Update Score (leaderboard) ────────────────────────────────────────────

  @SubscribeMessage('updateScore')
  async handleUpdateScore(
    @MessageBody() payload: UpdateScorePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const leaderboard = await this.leaderboardService.getLeaderboard(payload.gameSessionId);
    this.server.to(payload.roomCode).emit('leaderboardUpdate', leaderboard);
  }

  // ── Submit Final Score (multiplayer podium) ───────────────────────────────

  @SubscribeMessage('submitFinalScore')
  handleSubmitFinalScore(
    @MessageBody() payload: SubmitFinalScorePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { roomCode, username, avatar, score, difficulty } = payload;
    const room = this.roomService.getRoom(roomCode);

    // Init score map for this room
    if (!this.finalScores.has(roomCode)) {
      this.finalScores.set(roomCode, new Map());
    }
    const roomScores = this.finalScores.get(roomCode);
    roomScores.set(client.id, { username, avatar, score, difficulty });

    // Build sorted leaderboard
    const scoresArray = Array.from(roomScores.entries())
      .map(([socketId, data]) => ({ socketId, ...data }))
      .sort((a, b) => b.score - a.score);

    const totalPlayers = room ? room.players.length : roomScores.size;

    // Broadcast updated scores to everyone in the room
    this.server.to(roomCode).emit('finalScores', {
      scores: scoresArray,
      submitted: roomScores.size,
      total: totalPlayers,
    });

    this.logger.log(`Final score submitted by ${username} in room ${roomCode}: ${score} pts`);

    // Cleanup when all players have submitted
    if (roomScores.size >= totalPlayers) {
      setTimeout(() => this.finalScores.delete(roomCode), 60_000);
    }
  }
}
