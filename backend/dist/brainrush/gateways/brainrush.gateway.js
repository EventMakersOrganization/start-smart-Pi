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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainrushGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const leaderboard_service_1 = require("../services/leaderboard.service");
const room_service_1 = require("../services/room.service");
const multiplayer_game_service_1 = require("../services/multiplayer-game.service");
let BrainrushGateway = class BrainrushGateway {
    constructor(leaderboardService, roomService, gameService) {
        this.leaderboardService = leaderboardService;
        this.roomService = roomService;
        this.gameService = gameService;
        this.logger = new common_1.Logger('BrainrushGateway');
        this.finalScores = new Map();
    }
    afterInit() {
        this.gameService.setServer(this.server);
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
        const { room, wasHost, roomCode } = this.roomService.removePlayer(client.id);
        if (!roomCode)
            return;
        if (!room) {
            if (roomCode) {
                this.gameService.cleanupRoom(roomCode);
                this.logger.log(`Resources for room ${roomCode} cleaned up.`);
            }
            return;
        }
        this.server.to(roomCode).emit('playerLeft', {
            socketId: client.id,
            players: room.players,
            newHostId: room.hostId,
        });
        this.logger.log(`Player ${client.id} left room ${roomCode}. Players left: ${room.players.length}`);
    }
    async handleCreateRoom(payload, client) {
        try {
            const { username, avatar, userId } = payload;
            if (!username || username.trim().length === 0) {
                client.emit('roomError', { message: 'Username is required' });
                return;
            }
            const room = this.roomService.createRoom(client.id, username.trim(), avatar || '👤', userId);
            await client.join(room.roomCode);
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
        }
        catch (err) {
            this.logger.error('createRoom error', err);
            client.emit('roomError', { message: 'Failed to create room' });
        }
    }
    async handleJoinRoom(payload, client) {
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
            const { room, error } = this.roomService.joinRoom(roomCode.trim().toUpperCase(), client.id, username.trim(), avatar || '👤', userId);
            if (error) {
                client.emit('roomError', { message: error });
                return;
            }
            await client.join(room.roomCode);
            client.emit('roomJoined', {
                roomCode: room.roomCode,
                room: {
                    roomCode: room.roomCode,
                    hostId: room.hostId,
                    players: room.players,
                    status: room.status,
                },
            });
            this.server.to(room.roomCode).emit('playerJoined', {
                players: room.players,
                newPlayer: { socketId: client.id, username: username.trim(), avatar: avatar || '👤' },
            });
            this.logger.log(`${username} joined room ${room.roomCode}`);
        }
        catch (err) {
            this.logger.error('joinRoom error', err);
            client.emit('roomError', { message: 'Failed to join room' });
        }
    }
    async handleStartGame(payload, client) {
        try {
            const { roomCode, subject, difficulty } = payload;
            const { room, error } = this.roomService.startGame(roomCode, client.id);
            if (error) {
                client.emit('roomError', { message: error });
                return;
            }
            await this.gameService.startGame(roomCode, subject || 'Programming', difficulty || 'medium');
            this.logger.log(`Game started in room ${roomCode}`);
        }
        catch (err) {
            this.logger.error('startGame error', err);
            client.emit('roomError', { message: 'Failed to start game' });
        }
    }
    handleSubmitAnswer(payload, client) {
        const { roomCode, answer, responseTime } = payload;
        this.gameService.submitAnswer(roomCode, client.id, answer, responseTime);
    }
    handleJoinGameRoom(roomCode, client) {
        client.join(roomCode);
        this.logger.log(`Client ${client.id} joined game room ${roomCode}`);
        this.server.to(roomCode).emit('playerJoined', { playerId: client.id });
    }
    async handleUpdateScore(payload, client) {
        const leaderboard = await this.leaderboardService.getLeaderboard(payload.gameSessionId);
        this.server.to(payload.roomCode).emit('leaderboardUpdate', leaderboard);
    }
    handleSubmitFinalScore(payload, client) {
        const { roomCode, username, avatar, score, difficulty } = payload;
        const room = this.roomService.getRoom(roomCode);
        if (!this.finalScores.has(roomCode)) {
            this.finalScores.set(roomCode, new Map());
        }
        const roomScores = this.finalScores.get(roomCode);
        roomScores.set(client.id, { username, avatar, score, difficulty });
        const scoresArray = Array.from(roomScores.entries())
            .map(([socketId, data]) => ({ socketId, ...data }))
            .sort((a, b) => b.score - a.score);
        const totalPlayers = room ? room.players.length : roomScores.size;
        this.server.to(roomCode).emit('finalScores', {
            scores: scoresArray,
            submitted: roomScores.size,
            total: totalPlayers,
        });
        this.logger.log(`Final score submitted by ${username} in room ${roomCode}: ${score} pts`);
        if (roomScores.size >= totalPlayers) {
            setTimeout(() => this.finalScores.delete(roomCode), 60_000);
        }
    }
};
exports.BrainrushGateway = BrainrushGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], BrainrushGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('createRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], BrainrushGateway.prototype, "handleCreateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], BrainrushGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('startGame'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], BrainrushGateway.prototype, "handleStartGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('submitAnswer'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], BrainrushGateway.prototype, "handleSubmitAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinGameRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], BrainrushGateway.prototype, "handleJoinGameRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('updateScore'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], BrainrushGateway.prototype, "handleUpdateScore", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('submitFinalScore'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], BrainrushGateway.prototype, "handleSubmitFinalScore", null);
exports.BrainrushGateway = BrainrushGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/brainrush', cors: { origin: '*' } }),
    __metadata("design:paramtypes", [leaderboard_service_1.LeaderboardService,
        room_service_1.RoomService,
        multiplayer_game_service_1.MultiplayerGameService])
], BrainrushGateway);
//# sourceMappingURL=brainrush.gateway.js.map