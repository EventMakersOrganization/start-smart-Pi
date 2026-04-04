import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LeaderboardService } from '../services/leaderboard.service';
import { RoomService } from '../services/room.service';
import { MultiplayerGameService } from '../services/multiplayer-game.service';
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
export declare class BrainrushGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly leaderboardService;
    private readonly roomService;
    private readonly gameService;
    server: Server;
    private readonly logger;
    private finalScores;
    constructor(leaderboardService: LeaderboardService, roomService: RoomService, gameService: MultiplayerGameService);
    afterInit(): void;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleCreateRoom(payload: CreateRoomPayload, client: Socket): Promise<void>;
    handleJoinRoom(payload: JoinRoomPayload, client: Socket): Promise<void>;
    handleStartGame(payload: StartGamePayload, client: Socket): Promise<void>;
    handleSubmitAnswer(payload: SubmitAnswerPayload, client: Socket): void;
    handleJoinGameRoom(roomCode: string, client: Socket): void;
    handleUpdateScore(payload: UpdateScorePayload, client: Socket): Promise<void>;
    handleSubmitFinalScore(payload: SubmitFinalScorePayload, client: Socket): void;
}
export {};
