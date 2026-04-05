"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MultiplayerGameService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiplayerGameService = void 0;
const common_1 = require("@nestjs/common");
const room_service_1 = require("./room.service");
const ai_service_1 = require("./ai.service");
let MultiplayerGameService = MultiplayerGameService_1 = class MultiplayerGameService {
    constructor(roomService, aiService) {
        this.roomService = roomService;
        this.aiService = aiService;
        this.logger = new common_1.Logger(MultiplayerGameService_1.name);
        this.roomTimers = new Map();
        this.roomTimeouts = new Map();
    }
    setServer(server) {
        this.server = server;
    }
    async startGame(roomCode, subject, difficulty) {
        const room = this.roomService.getRoom(roomCode);
        if (!room)
            return;
        if (room.status === 'playing' && room.gameState) {
            this.logger.warn(`Room ${roomCode} is already playing. Skipping startGame.`);
            return;
        }
        this.logger.log(`[START] Initializing game for Room ${roomCode}. Subject: ${subject}`);
        this.cleanupRoom(roomCode);
        const questions = await this.aiService.generateSession(subject, difficulty, 10);
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
    startQuestion(roomCode) {
        const room = this.roomService.getRoom(roomCode);
        if (!room || !room.gameState)
            return;
        const { gameState } = room;
        gameState.currentQuestionIndex++;
        if (gameState.currentQuestionIndex >= gameState.questions.length) {
            this.logger.log(`Room ${roomCode}: All questions completed.`);
            this.finishGame(roomCode);
            return;
        }
        const question = gameState.questions[gameState.currentQuestionIndex];
        room.players.forEach(p => {
            p.hasAnswered = false;
            p.lastAnswerCorrect = undefined;
            p.lastResponseTime = undefined;
        });
        gameState.status = 'playing';
        gameState.timeLeft = 20;
        this.logger.log(`Room ${roomCode}: Question ${gameState.currentQuestionIndex + 1} started.`);
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
    submitAnswer(roomCode, socketId, answer, responseTimeMs) {
        const room = this.roomService.getRoom(roomCode);
        if (!room || !room.gameState || room.gameState.status !== 'playing')
            return;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.hasAnswered) {
            this.logger.debug(`Ignored duplicate/invalid answer from ${socketId} in ${roomCode}`);
            return;
        }
        const question = room.gameState.questions[room.gameState.currentQuestionIndex];
        const isCorrect = answer === question.correctAnswer;
        const points = this.calculatePoints(isCorrect, responseTimeMs, 20 * 1000);
        player.hasAnswered = true;
        player.lastAnswerCorrect = isCorrect;
        player.lastResponseTime = responseTimeMs;
        player.score += points;
        this.logger.log(`[ANSWER] ${player.username} in ${roomCode} | Correct: ${isCorrect} | Points: ${points}`);
        this.server.to(roomCode).emit('playerAnswered', {
            socketId: player.socketId,
            username: player.username
        });
        const allDone = room.players.every(p => p.hasAnswered);
        if (allDone) {
            this.logger.log(`Room ${roomCode}: Everyone has answered. Shortcutting timer.`);
            this.stopTimer(roomCode);
            this.endQuestion(roomCode);
        }
    }
    endQuestion(roomCode) {
        const room = this.roomService.getRoom(roomCode);
        if (!room || !room.gameState)
            return;
        const { gameState } = room;
        if (gameState.status !== 'playing')
            return;
        gameState.status = 'question_ended';
        const question = gameState.questions[gameState.currentQuestionIndex];
        this.logger.log(`Room ${roomCode}: Question ${gameState.currentQuestionIndex + 1} ended.`);
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
        const timeout = setTimeout(() => {
            if (this.roomService.getRoom(roomCode)) {
                this.startQuestion(roomCode);
            }
        }, 5000);
        this.roomTimeouts.set(roomCode, timeout);
    }
    finishGame(roomCode) {
        const room = this.roomService.getRoom(roomCode);
        if (!room || !room.gameState)
            return;
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
    calculatePoints(isCorrect, timeUsed, totalTime) {
        if (!isCorrect)
            return 0;
        const base = 500;
        const speedFactor = Math.max(0, (totalTime - timeUsed) / totalTime);
        const bonus = Math.floor(speedFactor * 500);
        return base + bonus;
    }
    runCountdown(roomCode, onComplete) {
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
            }
            else {
                room.gameState.timeLeft--;
            }
        }, 1000);
        this.roomTimers.set(roomCode, interval);
    }
    startQuestionTimer(roomCode) {
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
    stopTimer(roomCode) {
        const interval = this.roomTimers.get(roomCode);
        if (interval) {
            clearInterval(interval);
            this.roomTimers.delete(roomCode);
        }
    }
    cleanupRoom(roomCode) {
        this.stopTimer(roomCode);
        const timeout = this.roomTimeouts.get(roomCode);
        if (timeout) {
            clearTimeout(timeout);
            this.roomTimeouts.delete(roomCode);
        }
    }
};
exports.MultiplayerGameService = MultiplayerGameService;
exports.MultiplayerGameService = MultiplayerGameService = MultiplayerGameService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [room_service_1.RoomService,
        ai_service_1.AiService])
], MultiplayerGameService);
//# sourceMappingURL=multiplayer-game.service.js.map