import { RoomService } from './room.service';
import { AiService } from './ai.service';
import { Server } from 'socket.io';
export declare class MultiplayerGameService {
    private readonly roomService;
    private readonly aiService;
    private readonly logger;
    private server;
    private roomTimers;
    private roomTimeouts;
    constructor(roomService: RoomService, aiService: AiService);
    setServer(server: Server): void;
    startGame(roomCode: string, subject: string, difficulty: string, totalQuestions?: number): Promise<void>;
    private startQuestion;
    submitAnswer(roomCode: string, socketId: string, answer: string, responseTimeMs: number): void;
    private endQuestion;
    private finishGame;
    private calculatePoints;
    private runCountdown;
    private startQuestionTimer;
    private stopTimer;
    cleanupRoom(roomCode: string): void;
}
