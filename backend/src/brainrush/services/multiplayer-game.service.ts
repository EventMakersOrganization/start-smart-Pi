import { Injectable, Logger } from '@nestjs/common';
import { RoomService, Room, MultiplayerQuestion } from './room.service';
import { AiService } from './ai.service';
import { Server } from 'socket.io';

@Injectable()
export class MultiplayerGameService {
    private readonly logger = new Logger(MultiplayerGameService.name);
    private server: Server;
    private roomTimers = new Map<string, NodeJS.Timeout>();
    private roomTimeouts = new Map<string, NodeJS.Timeout>();

    constructor(
        private readonly roomService: RoomService,
        private readonly aiService: AiService,
    ) { }

    setServer(server: Server) {
        this.server = server;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ── GAME LIFECYCLE ──
    // ──────────────────────────────────────────────────────────────────────────

    async startGame(roomCode: string, subject: string, difficulty: string) {
        const room = this.roomService.getRoom(roomCode);
        if (!room) return;

        // Guard: Prevent double-starting
        if (room.status === 'playing' && room.gameState) {
            this.logger.warn(`Room ${roomCode} is already playing. Skipping startGame.`);
            return;
        }

        this.logger.log(`[START] Initializing game for Room ${roomCode}. Subject: ${subject}`);
        this.cleanupRoom(roomCode);

        // Fetch questions
        const questions = await this.aiService.generateSession(subject, difficulty, 10);

        // Initialize players for a fresh start
        room.players.forEach(p => {
            p.score = 0;
            p.hasAnswered = false;
        });

        room.gameState = {
            status: 'countdown',
            questions,
            currentQuestionIndex: -1,
            timeLeft: 3,
        };
        room.status = 'playing';

        this.logger.log(`Room ${roomCode}: Starting 3s countdown...`);
        this.runCountdown(roomCode, () => this.startQuestion(roomCode));
    }

    private startQuestion(roomCode: string) {
        const room = this.roomService.getRoom(roomCode);
        if (!room || !room.gameState) return;

        const { gameState } = room;
        gameState.currentQuestionIndex++;

        // End game if no more questions
        if (gameState.currentQuestionIndex >= gameState.questions.length) {
            this.logger.log(`Room ${roomCode}: All questions completed.`);
            this.finishGame(roomCode);
            return;
        }

        const question = gameState.questions[gameState.currentQuestionIndex];

        // Reset player flags for THIS question
        room.players.forEach(p => {
            p.hasAnswered = false;
            p.lastAnswerCorrect = undefined;
            p.lastResponseTime = undefined;
        });

        gameState.status = 'playing';
        gameState.timeLeft = 20; // Hard 20s as requested

        this.logger.log(`Room ${roomCode}: Question ${gameState.currentQuestionIndex + 1} started.`);

        // Emit SINGLE start event
        this.server.to(roomCode).emit('nextQuestion', {
            question: {
                id: question.id,
                text: question.text,
                options: question.options,
                timeLimit: gameState.timeLeft,
            },
            index: gameState.currentQuestionIndex,
            total: gameState.questions.length,
        });

        this.startQuestionTimer(roomCode);
    }

    submitAnswer(roomCode: string, socketId: string, answer: string, responseTimeMs: number) {
        const room = this.roomService.getRoom(roomCode);
        if (!room || !room.gameState || room.gameState.status !== 'playing') return;

        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.hasAnswered) {
            this.logger.debug(`Ignored duplicate/invalid answer from ${socketId} in ${roomCode}`);
            return;
        }

        const question = room.gameState.questions[room.gameState.currentQuestionIndex];
        const isCorrect = answer === question.correctAnswer;

        // Authoritative Scoring
        const points = this.calculatePoints(isCorrect, responseTimeMs, 20 * 1000);
        player.hasAnswered = true;
        player.lastAnswerCorrect = isCorrect;
        player.lastResponseTime = responseTimeMs;
        player.score += points;

        this.logger.log(`[ANSWER] ${player.username} in ${roomCode} | Correct: ${isCorrect} | Points: ${points}`);

        // Broadcast that this player has answered (without revealing the content)
        this.server.to(roomCode).emit('playerAnswered', {
            socketId: player.socketId,
            username: player.username
        });

        // If everyone answered, finish question immediately
        const allDone = room.players.every(p => p.hasAnswered);
        if (allDone) {
            this.logger.log(`Room ${roomCode}: Everyone has answered. Shortcutting timer.`);
            this.stopTimer(roomCode);
            this.endQuestion(roomCode);
        }
    }

    private endQuestion(roomCode: string) {
        const room = this.roomService.getRoom(roomCode);
        if (!room || !room.gameState) return;

        const { gameState } = room;
        if (gameState.status !== 'playing') return; // Prevent double trigger

        gameState.status = 'question_ended';
        const question = gameState.questions[gameState.currentQuestionIndex];

        this.logger.log(`Room ${roomCode}: Question ${gameState.currentQuestionIndex + 1} ended.`);

        // Build current round results
        const leaderboard = room.players
            .map(p => ({
                socketId: p.socketId,
                username: p.username,
                avatar: p.avatar,
                score: p.score,
                isCorrect: p.lastAnswerCorrect,
                responseTime: p.lastResponseTime
            }))
            .sort((a, b) => b.score - a.score);

        this.server.to(roomCode).emit('questionResults', {
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            leaderboard
        });

        // Safe auto-advance
        const timeout = setTimeout(() => {
            if (this.roomService.getRoom(roomCode)) {
                this.startQuestion(roomCode);
            }
        }, 5000);
        this.roomTimeouts.set(roomCode, timeout);
    }

    private finishGame(roomCode: string) {
        const room = this.roomService.getRoom(roomCode);
        if (!room || !room.gameState) return;

        room.gameState.status = 'finished';
        room.status = 'finished';

        const finalRanking = room.players
            .map(p => ({
                username: p.username,
                avatar: p.avatar,
                score: p.score
            }))
            .sort((a, b) => b.score - a.score);

        this.logger.log(`[FINISH] Game in Room ${roomCode} completed.`);
        this.server.to(roomCode).emit('finalResults', {
            ranking: finalRanking
        });

        this.cleanupRoom(roomCode);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ── HELPERS ──
    // ──────────────────────────────────────────────────────────────────────────

    private calculatePoints(isCorrect: boolean, timeUsed: number, totalTime: number): number {
        if (!isCorrect) return 0;
        const base = 500;
        const speedFactor = Math.max(0, (totalTime - timeUsed) / totalTime);
        const bonus = Math.floor(speedFactor * 500);
        return base + bonus;
    }

    private runCountdown(roomCode: string, onComplete: () => void) {
        const room = this.roomService.getRoom(roomCode);
        const interval = setInterval(() => {
            if (!room || !room.gameState) {
                this.cleanupRoom(roomCode);
                return;
            }
            this.server.to(roomCode).emit('gameCountdown', { seconds: room.gameState.timeLeft });
            if (room.gameState.timeLeft <= 0) {
                this.stopTimer(roomCode);
                onComplete();
            } else {
                room.gameState.timeLeft--;
            }
        }, 1000);
        this.roomTimers.set(roomCode, interval);
    }

    private startQuestionTimer(roomCode: string) {
        const room = this.roomService.getRoom(roomCode);
        const interval = setInterval(() => {
            if (!room || !room.gameState || room.gameState.status !== 'playing') {
                this.stopTimer(roomCode);
                return;
            }
            room.gameState.timeLeft--;
            this.server.to(roomCode).emit('timerUpdate', { timeLeft: room.gameState.timeLeft });

            if (room.gameState.timeLeft <= 0) {
                this.logger.log(`Room ${roomCode}: Time is up for current question.`);
                this.stopTimer(roomCode);
                this.endQuestion(roomCode);
            }
        }, 1000);
        this.roomTimers.set(roomCode, interval);
    }

    private stopTimer(roomCode: string) {
        const interval = this.roomTimers.get(roomCode);
        if (interval) {
            clearInterval(interval);
            this.roomTimers.delete(roomCode);
        }
    }

    public cleanupRoom(roomCode: string) {
        this.stopTimer(roomCode);
        const timeout = this.roomTimeouts.get(roomCode);
        if (timeout) {
            clearTimeout(timeout);
            this.roomTimeouts.delete(roomCode);
        }
    }
}
