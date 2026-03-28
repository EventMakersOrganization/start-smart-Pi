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
let BrainrushGateway = class BrainrushGateway {
    constructor(leaderboardService) {
        this.leaderboardService = leaderboardService;
        this.logger = new common_1.Logger('BrainrushGateway');
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleJoinRoom(roomCode, client) {
        client.join(roomCode);
        this.logger.log(`Client ${client.id} joined room ${roomCode}`);
        this.server.to(roomCode).emit('playerJoined', { playerId: client.id });
    }
    async handleUpdateScore(payload, client) {
        const leaderboard = await this.leaderboardService.getLeaderboard(payload.gameSessionId);
        this.server.to(payload.roomCode).emit('leaderboardUpdate', leaderboard);
    }
};
exports.BrainrushGateway = BrainrushGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], BrainrushGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinGameRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], BrainrushGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('updateScore'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], BrainrushGateway.prototype, "handleUpdateScore", null);
exports.BrainrushGateway = BrainrushGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/brainrush', cors: true }),
    __metadata("design:paramtypes", [leaderboard_service_1.LeaderboardService])
], BrainrushGateway);
//# sourceMappingURL=brainrush.gateway.js.map