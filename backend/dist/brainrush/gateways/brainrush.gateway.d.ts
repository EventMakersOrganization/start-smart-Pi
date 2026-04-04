import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LeaderboardService } from '../services/leaderboard.service';
import { RoomService } from '../services/room.service';
interface CreateRoomPayload {
    username: string;
    userId?: string;
}
interface JoinRoomPayload {
    roomCode: string;
    username: string;
    userId?: string;
}
interface StartGamePayload {
    roomCode: string;
}
interface SubmitFinalScorePayload {
    roomCode: string;
    username: string;
    score: number;
    difficulty: string;
}
interface UpdateScorePayload {
    gameSessionId: string;
    roomCode: string;
}
export declare class BrainrushGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly leaderboardService;
    private readonly roomService;
    server: Server;
    private readonly logger;
    private finalScores;
    constructor(leaderboardService: LeaderboardService, roomService: RoomService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleCreateRoom(payload: CreateRoomPayload, client: Socket): Promise<void>;
    handleJoinRoom(payload: JoinRoomPayload, client: Socket): Promise<void>;
    handleStartGame(payload: StartGamePayload, client: Socket): void;
    handleJoinGameRoom(roomCode: string, client: Socket): void;
    handleUpdateScore(payload: UpdateScorePayload, client: Socket): Promise<void>;
    handleSubmitFinalScore(payload: SubmitFinalScorePayload, client: Socket): void;
}
export {};
