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
import { CodebattleService } from './codebattle.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'codebattle',
})
export class CodebattleGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(CodebattleGateway.name);
    @WebSocketServer() server: Server;

    // Track active timer intervals per room so we can clear them
    private roomTimers: Map<string, any> = new Map();

    constructor(private readonly codebattleService: CodebattleService) { }

    handleConnection(client: Socket) {
        this.logger.debug(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.debug(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('createRoom')
    handleCreateRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { username: string; config: any },
    ) {
        const room = this.codebattleService.createRoom(client.id, data.username, data.config);
        client.join(room.roomCode);
        return { event: 'roomCreated', data: room };
    }

    @SubscribeMessage('joinRoom')
    handleJoinRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { roomCode: string; username: string },
    ) {
        try {
            const room = this.codebattleService.joinRoom(data.roomCode, client.id, data.username);
            client.join(data.roomCode);
            this.server.to(data.roomCode).emit('playerJoined', room);
            return { event: 'joinedSuccess', data: room };
        } catch (error) {
            return { event: 'error', data: error.message };
        }
    }

    @SubscribeMessage('startGame')
    handleStartGame(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { roomCode: string },
    ) {
        try {
            const room = this.codebattleService.startGame(data.roomCode, client.id);
            this.server.to(data.roomCode).emit('gameStarted', {
                problems: room.problems,
                currentProblem: room.problems[0],
                totalProblems: room.totalProblems,
                players: room.players,
                language: room.language
            });
            this.startRoundTimer(data.roomCode);
        } catch (error) {
            this.logger.error(error.message);
        }
    }

    // =============================================
    // SYNCHRONIZED ROUND TIMER
    // =============================================
    private startRoundTimer(roomCode: string) {
        // Clear any existing timer for this room
        this.clearRoomTimer(roomCode);

        let timeLeft = 60;
        const interval = setInterval(() => {
            timeLeft--;
            this.server.to(roomCode).emit('timerUpdate', { timeLeft });

            if (timeLeft <= 0) {
                this.clearRoomTimer(roomCode);
                // TIME'S UP — force resolve the round
                this.resolveAndAdvance(roomCode);
            }
        }, 1000);

        this.roomTimers.set(roomCode, interval);
    }

    private clearRoomTimer(roomCode: string) {
        const existingTimer = this.roomTimers.get(roomCode);
        if (existingTimer) {
            clearInterval(existingTimer);
            this.roomTimers.delete(roomCode);
        }
    }

    // =============================================
    // RESOLVE ROUND & ADVANCE
    // Called when: (a) ALL players submitted, or (b) timer expired
    // =============================================
    private resolveAndAdvance(roomCode: string) {
        const roundResult = this.codebattleService.resolveRound(roomCode);
        if (!roundResult) return;

        // 1. Broadcast round results to ALL players simultaneously
        this.server.to(roomCode).emit('roundResults', {
            playerResults: roundResult.playerResults,
            leaderboard: roundResult.leaderboard
        });

        // 2. After a 3-second reveal delay, advance to next problem
        setTimeout(() => {
            this.nextProblem(roomCode);
        }, 3000);
    }

    private nextProblem(roomCode: string) {
        const room = this.codebattleService.getRoom(roomCode);
        if (!room) return;

        room.currentProblemIndex++;
        if (room.currentProblemIndex < room.totalProblems) {
            room.startTime = Date.now();
            room.players.forEach(p => p.status = 'idle');
            room.pendingSubmissions = new Map();

            this.server.to(roomCode).emit('problemStarted', {
                problemIndex: room.currentProblemIndex,
                problem: room.problems[room.currentProblemIndex],
                players: room.players,
                language: room.language
            });
            this.startRoundTimer(roomCode);
        } else {
            room.status = 'finished';
            this.server.to(roomCode).emit('gameFinished', {
                players: room.players.sort((a, b) => b.score - a.score)
            });
        }
    }

    // =============================================
    // PLAYER SUBMITS CODE (LOCKED IN, NO RESULT YET)
    // =============================================
    @SubscribeMessage('submitCode')
    handleCodeSubmission(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { roomCode: string; code: string; timeLeft: number },
    ) {
        try {
            const result = this.codebattleService.submitMultiplayerSolution(data.roomCode, client.id, data.code, data.timeLeft);
            if (!result) return;

            if (result.alreadySubmitted) {
                client.emit('submissionLocked', { message: 'Already submitted for this round.' });
                return;
            }

            // Confirm to submitter that their code is locked in
            client.emit('submissionLocked', {
                message: `Response locked in! (${result.submittedCount}/${result.totalPlayers} players submitted)`,
                submittedCount: result.submittedCount,
                totalPlayers: result.totalPlayers
            });

            // Broadcast progress to all players
            this.server.to(data.roomCode).emit('submissionProgress', {
                submittedCount: result.submittedCount,
                totalPlayers: result.totalPlayers
            });

            // If ALL players submitted, stop the timer and resolve immediately
            if (result.allSubmitted) {
                this.clearRoomTimer(data.roomCode);
                this.resolveAndAdvance(data.roomCode);
            }
        } catch (error) {
            client.emit('error', error.message);
        }
    }

    @SubscribeMessage('playerStatusUpdate')
    handleStatusUpdate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { roomCode: string; status: any },
    ) {
        const room = this.codebattleService.updatePlayerStatus(data.roomCode, client.id, data.status);
        if (room) {
            this.server.to(data.roomCode).emit('leaderboardUpdate', { players: room.players });
        }
    }
}
