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
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const chat_service_1 = require("./chat.service");
let ChatGateway = class ChatGateway {
    constructor(chatService) {
        this.chatService = chatService;
        this.connectedUsers = new Map();
    }
    async handleConnection(client) {
        const userId = client.handshake.query.userId;
        if (userId) {
            if (!this.connectedUsers.has(userId)) {
                this.connectedUsers.set(userId, []);
            }
            this.connectedUsers.get(userId).push(client.id);
            this.server.emit('userStatus', { userId, status: 'online' });
        }
        console.log(`Client connected: ${client.id}`);
    }
    async handleDisconnect(client) {
        const userId = client.handshake.query.userId;
        if (userId && this.connectedUsers.has(userId)) {
            const sockets = this.connectedUsers.get(userId);
            const index = sockets.indexOf(client.id);
            if (index !== -1) {
                sockets.splice(index, 1);
            }
            if (sockets.length === 0) {
                this.connectedUsers.delete(userId);
                this.server.emit('userStatus', { userId, status: 'offline' });
            }
        }
        console.log(`Client disconnected: ${client.id}`);
    }
    handleJoinRoom(client, room) {
        client.join(room);
    }
    handleLeaveRoom(client, room) {
        client.leave(room);
    }
    async handleMessage(client, payload) {
        const message = await this.chatService.saveMessage(payload);
        this.server.to(payload.sessionId).emit('newMessage', message);
        if (payload.sessionType === 'ChatAi') {
            setTimeout(async () => {
                const aiMessage = await this.chatService.saveMessage({
                    sessionType: 'ChatAi',
                    sessionId: payload.sessionId,
                    sender: 'AI',
                    content: `Mocked AI response to: "${payload.content}"`
                });
                this.server.to(payload.sessionId).emit('newMessage', aiMessage);
            }, 1500);
        }
        return message;
    }
    handleTyping(client, payload) {
        client.broadcast.to(payload.sessionId).emit('userTyping', payload);
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sendMessage'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTyping", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map