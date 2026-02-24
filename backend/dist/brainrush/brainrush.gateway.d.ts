import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
export declare class BrainrushGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private jwtService;
    server: Server;
    private logger;
    constructor(jwtService: JwtService);
    afterInit(server: Server): void;
    handleConnection(client: Socket, ...args: any[]): void;
    handleDisconnect(client: Socket): void;
    handleJoinRoom(data: {
        roomCode: string;
    }, client: Socket): void;
    handleLeaveRoom(data: {
        roomCode: string;
    }, client: Socket): void;
    emitToRoom(roomCode: string, event: string, data: any): void;
    emitPlayerJoined(roomCode: string, data: any): void;
    emitNewQuestion(roomCode: string, question: any): void;
    emitLeaderboardUpdate(roomCode: string, leaderboard: any[]): void;
}
