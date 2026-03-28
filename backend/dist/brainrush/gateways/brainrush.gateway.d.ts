import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LeaderboardService } from '../services/leaderboard.service';
export declare class BrainrushGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private leaderboardService;
    server: Server;
    private logger;
    constructor(leaderboardService: LeaderboardService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoinRoom(roomCode: string, client: Socket): void;
    handleUpdateScore(payload: {
        gameSessionId: string;
        roomCode: string;
    }, client: Socket): Promise<void>;
}
