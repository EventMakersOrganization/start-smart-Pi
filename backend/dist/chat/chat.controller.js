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
const ai_service_1 = require("./ai.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let ChatController = class ChatController {
    constructor(chatService, aiService) {
        this.chatService = chatService;
        this.aiService = aiService;
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
    async semanticSearch(query, nResults) {
        const results = await this.aiService.semanticSearch(query, nResults ? parseInt(nResults, 10) : 10);
        return { results };
    }
    async aiHealth() {
        return this.aiService.healthCheck();
    }
    async aiLatencyStats() {
        return { status: 'success', stats: this.aiService.getAiLatencyStats() };
    }
    async levelTestStart(req, body) {
        return this.aiService.startLevelTest(req.user.id, body.subjects);
    }
    async levelTestSubmitAnswer(body) {
        return this.aiService.submitAnswer(body.session_id, body.answer);
    }
    async levelTestComplete(body) {
        return this.aiService.completeLevelTest(body.session_id);
    }
    async levelTestSession(sessionId) {
        return this.aiService.getLevelTestSession(sessionId);
    }
    async personalizedRecommendations(body) {
        return this.aiService.getPersonalizedRecommendations(body.student_profile, body.n_results ?? 5);
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
    (0, common_1.Get)('ai/search'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('n')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "semanticSearch", null);
__decorate([
    (0, common_1.Get)('ai/health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "aiHealth", null);
__decorate([
    (0, common_1.Get)('ai/latency'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "aiLatencyStats", null);
__decorate([
    (0, common_1.Post)('ai/level-test/start'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "levelTestStart", null);
__decorate([
    (0, common_1.Post)('ai/level-test/submit-answer'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "levelTestSubmitAnswer", null);
__decorate([
    (0, common_1.Post)('ai/level-test/complete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "levelTestComplete", null);
__decorate([
    (0, common_1.Get)('ai/level-test/session/:sessionId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "levelTestSession", null);
__decorate([
    (0, common_1.Post)('ai/recommendations'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "personalizedRecommendations", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)('chat'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        ai_service_1.AiService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map