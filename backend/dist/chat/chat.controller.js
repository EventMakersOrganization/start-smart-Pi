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
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let ChatController = class ChatController {
    constructor(chatService) {
        this.chatService = chatService;
    }
    async createAiSession(req, body) {
        return this.chatService.createAiSession(req.user.id, body.title);
    }
    async createInstructorSession(req, body) {
        return this.chatService.createInstructorSession(req.user.id, body.instructorId);
    }
    async createRoom(req, body) {
        if (req.user.role !== 'student') {
            throw new common_1.UnauthorizedException('Only students can create group chats.');
        }
        return this.chatService.createRoom(body.name, [req.user.id, ...body.participants]);
    }
    async getUserSessions(req) {
        return this.chatService.getUserSessions(req.user.id, req.user.role);
    }
    async getChatHistory(req, sessionType, sessionId) {
        return this.chatService.getChatHistory(sessionType, sessionId, req.user.id);
    }
    async sendMessage(req, body) {
        const isAllowed = await this.chatService.isParticipant(body.sessionType, body.sessionId, req.user.id);
        if (!isAllowed) {
            throw new common_1.UnauthorizedException('You are not a participant in this chat.');
        }
        return this.chatService.saveMessage({
            sessionType: body.sessionType,
            sessionId: body.sessionId,
            sender: req.user.id,
            content: body.content,
        });
    }
    async deleteMessage(req, messageId) {
        return this.chatService.deleteMessage(messageId, req.user.id);
    }
    async deleteAiSession(req, sessionId) {
        return this.chatService.deleteAiSession(sessionId, req.user.id);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)('ai/session'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "createAiSession", null);
__decorate([
    (0, common_1.Post)('instructor/session'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "createInstructorSession", null);
__decorate([
    (0, common_1.Post)('room'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "createRoom", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getUserSessions", null);
__decorate([
    (0, common_1.Get)('history/:sessionType/:sessionId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('sessionType')),
    __param(2, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getChatHistory", null);
__decorate([
    (0, common_1.Post)('send'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Delete)('message/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "deleteMessage", null);
__decorate([
    (0, common_1.Delete)('ai/session/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "deleteAiSession", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)('chat'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map