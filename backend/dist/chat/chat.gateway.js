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
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const chat_service_1 = require("./chat.service");
const ai_service_1 = require("./ai.service");
const common_1 = require("@nestjs/common");
const ws_jwt_guard_1 = require("../auth/guards/ws-jwt.guard");
const jwt_1 = require("@nestjs/jwt");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    stripAiMetadataForHistory(raw) {
        const s = String(raw || '');
        const marker = '\n\n<<<CHAT_SOURCES>>>\n\n';
        const idx = s.indexOf(marker);
        if (idx >= 0) {
            return s.slice(0, idx).trimEnd();
        }
        const legacy = s.split('\n\n---\n');
        return legacy[0] ?? s;
    }
    constructor(chatService, aiService, jwtService) {
        this.chatService = chatService;
        this.aiService = aiService;
        this.jwtService = jwtService;
        this.logger = new common_1.Logger('ChatGateway');
        this.connectedUsers = new Map();
    }
    async handleConnection(client) {
        try {
            const token = client.handshake?.auth?.token || client.handshake?.query?.token;
            if (!token) {
                client.disconnect();
                return;
            }
            const payload = await this.jwtService.verifyAsync(token);
            const userId = payload.sub || payload.id;
            if (userId) {
                client.data.user = { id: userId, email: payload.email, role: payload.role };
                if (!this.connectedUsers.has(userId)) {
                    this.connectedUsers.set(userId, []);
                }
                this.connectedUsers.get(userId).push(client.id);
                this.server.emit('userStatus', { userId, status: 'online' });
                this.logger.log(`Client authenticated: ${userId} (${client.id})`);
            }
        }
        catch (e) {
            this.logger.error('Connection authentication failed');
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        const userId = client.data.user?.id;
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
    async handleJoinRoom(client, payload) {
        const userId = client.data.user.id;
        const userRole = client.data.user.role;
        if (payload.sessionType === 'ChatRoom' && userRole !== 'student') {
            this.logger.warn(`User ${userId} (role: ${userRole}) attempted to join ChatRoom ${payload.sessionId}`);
            return;
        }
        const isAllowed = await this.chatService.isParticipant(payload.sessionType, payload.sessionId, userId);
        if (isAllowed) {
            client.join(payload.sessionId);
            this.logger.log(`User ${userId} joined room ${payload.sessionId}`);
        }
        else {
            this.logger.warn(`User ${userId} attempted to join unauthorized room ${payload.sessionId}`);
        }
    }
    handleLeaveRoom(client, room) {
        client.leave(room);
    }
    async handleMessage(client, payload) {
        const userId = client.data.user.id;
        const userRole = client.data.user.role;
        if (payload.sessionType === 'ChatRoom' && userRole !== 'student') {
            this.logger.warn(`User ${userId} (role: ${userRole}) attempted to send to ChatRoom ${payload.sessionId}`);
            return;
        }
        const isAllowed = await this.chatService.isParticipant(payload.sessionType, payload.sessionId, userId);
        if (!isAllowed) {
            this.logger.warn(`User ${userId} attempted to send message to unauthorized room ${payload.sessionId}`);
            return;
        }
        const message = await this.chatService.saveMessage({
            sessionType: payload.sessionType,
            sessionId: payload.sessionId,
            sender: userId,
            content: payload.content,
        });
        this.server.to(payload.sessionId).emit('newMessage', message);
        if (payload.sessionType === 'ChatAi') {
            this.server
                .to(payload.sessionId)
                .emit('userTyping', { sender: 'AI', isTyping: true });
            try {
                const history = await this.chatService.getRecentHistory(payload.sessionId, 6);
                const conversationHistory = history.map((m) => {
                    const raw = String(m.content || '');
                    const cleaned = m.sender === 'AI' ? this.stripAiMetadataForHistory(raw) : raw;
                    return {
                        role: m.sender === 'AI' ? 'assistant' : 'user',
                        content: cleaned,
                    };
                });
                const msgLower = String(payload.content || '').toLowerCase();
                const mode = msgLower.includes('pas a pas') ||
                    msgLower.includes('pas à pas') ||
                    msgLower.includes('step by step')
                    ? 'step_by_step'
                    : undefined;
                const aiResponse = await this.aiService.askChatbot(payload.content, conversationHistory, userId, mode);
                console.log('RAW LLM RESPONSE:', aiResponse.answer);
                let content = aiResponse.answer;
                if (aiResponse.sources?.length > 0) {
                    const srcList = aiResponse.sources
                        .slice(0, 3)
                        .map((s) => `📖 ${s.course_title} (${Math.round(s.similarity * 100)}%)`)
                        .join('\n');
                    content += `${ChatGateway_1.CHAT_SOURCES_DELIM}**Sources:**\n${srcList}`;
                }
                if (aiResponse.confidence > 0) {
                    content += `\n\n🎯 Confidence: ${Math.round(aiResponse.confidence * 100)}%`;
                }
                const aiMessage = await this.chatService.saveMessage({
                    sessionType: 'ChatAi',
                    sessionId: payload.sessionId,
                    sender: 'AI',
                    content,
                });
                this.server.to(payload.sessionId).emit('newMessage', aiMessage);
            }
            catch (error) {
                this.logger.error(`AI response failed: ${error.message}`);
                const fallback = await this.chatService.saveMessage({
                    sessionType: 'ChatAi',
                    sessionId: payload.sessionId,
                    sender: 'AI',
                    content: 'I am temporarily unavailable. Please try again in a moment.',
                });
                this.server.to(payload.sessionId).emit('newMessage', fallback);
            }
            finally {
                this.server
                    .to(payload.sessionId)
                    .emit('userTyping', { sender: 'AI', isTyping: false });
            }
        }
        return message;
    }
    async handleTyping(client, payload) {
        const userId = client.data.user.id;
        const isAllowed = await this.chatService.isParticipant(payload.sessionType, payload.sessionId, userId);
        if (isAllowed) {
            client.broadcast.to(payload.sessionId).emit('userTyping', {
                sessionId: payload.sessionId,
                sender: userId,
                isTyping: payload.isTyping
            });
        }
    }
    async handleDeleteMessage(client, payload) {
        const userId = client.data.user.id;
        try {
            await this.chatService.deleteMessage(payload.messageId, userId);
            this.server.to(payload.sessionId).emit('messageDeleted', { messageId: payload.messageId });
        }
        catch (e) {
            this.logger.error(`Failed to delete message: ${e.message}`);
        }
    }
};
exports.ChatGateway = ChatGateway;
ChatGateway.CHAT_SOURCES_DELIM = '\n\n<<<CHAT_SOURCES>>>\n\n';
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('joinRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('leaveRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('sendMessage'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMessage", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleTyping", null);
__decorate([
    (0, common_1.UseGuards)(ws_jwt_guard_1.WsJwtGuard),
    (0, websockets_1.SubscribeMessage)('deleteMessage'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleDeleteMessage", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        ai_service_1.AiService,
        jwt_1.JwtService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map