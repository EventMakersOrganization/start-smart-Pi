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
        return this.chatService.createRoom(body.name, [
            req.user.id,
            ...body.participants,
        ]);
    }
    async getUserSessions(req) {
        return this.chatService.getUserSessions(req.user.id);
    }
    async getChatHistory(req, sessionType, sessionId) {
        return this.chatService.getChatHistory(sessionType, sessionId, req.user.id);
    }
    async sendMessage(req, body) {
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
        return { status: "success", stats: this.aiService.getAiLatencyStats() };
    }
    async monitorStats(minutes) {
        const payload = {
            minutes: minutes ? Number(minutes) : 60,
        };
        return this.aiService.getMonitorStats(payload);
    }
    async monitorHealth() {
        return this.aiService.getMonitorHealth();
    }
    async monitorErrors(lastN) {
        const payload = {
            last_n: lastN ? Number(lastN) : 50,
        };
        return this.aiService.getMonitorErrors(payload);
    }
    async monitorThroughput(minutes) {
        const payload = {
            minutes: minutes ? Number(minutes) : 60,
        };
        return this.aiService.getMonitorThroughput(payload);
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
    async recordAdaptiveLearningEvent(req, body) {
        return this.aiService.recordLearningEvent(req.user.id, body);
    }
    async evaluateAnswer(body) {
        return this.aiService.evaluateAnswer(body);
    }
    async evaluateBatch(body) {
        return this.aiService.evaluateBatch(body);
    }
    async classifyDifficulty(body) {
        return this.aiService.classifyDifficulty(body);
    }
    async classifySuggestAdjustment(body) {
        return this.aiService.classifySuggestAdjustment(body);
    }
    async classifyDifficultyBatch(body) {
        return this.aiService.classifyDifficultyBatch(body);
    }
    async recordFeedback(body) {
        return this.aiService.recordFeedback(body);
    }
    async recordUserRating(body) {
        return this.aiService.recordUserRating(body);
    }
    async getFeedbackRecommendations() {
        return this.aiService.getFeedbackRecommendations();
    }
    async getFeedbackStats(signalType, lastN) {
        const payload = {
            signal_type: signalType,
            last_n: lastN ? Number(lastN) : 200,
        };
        return this.aiService.getFeedbackStats(payload);
    }
    async getAdaptiveLearningState(req) {
        return this.aiService.getLearningState(req.user.id);
    }
    async getLearningAnalytics(req, studentId, refresh) {
        const resolvedStudentId = studentId && studentId !== "me" ? studentId : req.user.id;
        return this.aiService.getLearningAnalytics(resolvedStudentId, this.isTruthy(refresh));
    }
    async getPaceAnalytics(req, studentId, refresh) {
        const resolvedStudentId = studentId && studentId !== "me" ? studentId : req.user.id;
        return this.aiService.getPaceAnalytics(resolvedStudentId, this.isTruthy(refresh));
    }
    async getConceptsAnalytics(req, studentId, refresh) {
        const resolvedStudentId = studentId && studentId !== "me" ? studentId : req.user.id;
        return this.aiService.getConceptsAnalytics(resolvedStudentId, this.isTruthy(refresh));
    }
    async getInterventionsEffectiveness(req, studentId) {
        const resolvedStudentId = studentId && studentId !== "me" ? studentId : req.user.id;
        return this.aiService.getInterventionsEffectiveness(resolvedStudentId);
    }
    async getInterventionsEffectivenessGlobal() {
        return this.aiService.getInterventionsEffectivenessGlobal();
    }
    isTruthy(value) {
        if (!value) {
            return false;
        }
        const normalized = value.trim().toLowerCase();
        return normalized === "1" || normalized === "true" || normalized === "yes";
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)("ai/session"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "createAiSession", null);
__decorate([
    (0, common_1.Post)("instructor/session"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "createInstructorSession", null);
__decorate([
    (0, common_1.Post)("room"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "createRoom", null);
__decorate([
    (0, common_1.Get)("sessions"),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getUserSessions", null);
__decorate([
    (0, common_1.Get)("history/:sessionType/:sessionId"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("sessionType")),
    __param(2, (0, common_1.Param)("sessionId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getChatHistory", null);
__decorate([
    (0, common_1.Post)("send"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)("ai/search"),
    __param(0, (0, common_1.Query)("q")),
    __param(1, (0, common_1.Query)("n")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "semanticSearch", null);
__decorate([
    (0, common_1.Get)("ai/health"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "aiHealth", null);
__decorate([
    (0, common_1.Get)("ai/latency"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "aiLatencyStats", null);
__decorate([
    (0, common_1.Get)("ai/monitor/stats"),
    __param(0, (0, common_1.Query)("minutes")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "monitorStats", null);
__decorate([
    (0, common_1.Get)("ai/monitor/health"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "monitorHealth", null);
__decorate([
    (0, common_1.Get)("ai/monitor/errors"),
    __param(0, (0, common_1.Query)("last_n")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "monitorErrors", null);
__decorate([
    (0, common_1.Get)("ai/monitor/throughput"),
    __param(0, (0, common_1.Query)("minutes")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "monitorThroughput", null);
__decorate([
    (0, common_1.Post)("ai/level-test/start"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "levelTestStart", null);
__decorate([
    (0, common_1.Post)("ai/level-test/submit-answer"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "levelTestSubmitAnswer", null);
__decorate([
    (0, common_1.Post)("ai/level-test/complete"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "levelTestComplete", null);
__decorate([
    (0, common_1.Get)("ai/level-test/session/:sessionId"),
    __param(0, (0, common_1.Param)("sessionId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "levelTestSession", null);
__decorate([
    (0, common_1.Post)("ai/recommendations"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "personalizedRecommendations", null);
__decorate([
    (0, common_1.Post)("ai/adaptive/event"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "recordAdaptiveLearningEvent", null);
__decorate([
    (0, common_1.Post)("ai/evaluate/answer"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "evaluateAnswer", null);
__decorate([
    (0, common_1.Post)("ai/evaluate/batch"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "evaluateBatch", null);
__decorate([
    (0, common_1.Post)("ai/classify/difficulty"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "classifyDifficulty", null);
__decorate([
    (0, common_1.Post)("ai/classify/suggest-adjustment"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "classifySuggestAdjustment", null);
__decorate([
    (0, common_1.Post)("ai/classify/difficulty-batch"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "classifyDifficultyBatch", null);
__decorate([
    (0, common_1.Post)("ai/feedback/record"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "recordFeedback", null);
__decorate([
    (0, common_1.Post)("ai/feedback/user-rating"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "recordUserRating", null);
__decorate([
    (0, common_1.Get)("ai/feedback/recommendations"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getFeedbackRecommendations", null);
__decorate([
    (0, common_1.Get)("ai/feedback/stats/:signalType"),
    __param(0, (0, common_1.Param)("signalType")),
    __param(1, (0, common_1.Query)("last_n")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getFeedbackStats", null);
__decorate([
    (0, common_1.Get)("ai/adaptive/state"),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getAdaptiveLearningState", null);
__decorate([
    (0, common_1.Get)("ai/analytics/learning/:studentId"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("studentId")),
    __param(2, (0, common_1.Query)("refresh")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getLearningAnalytics", null);
__decorate([
    (0, common_1.Get)("ai/analytics/pace/:studentId"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("studentId")),
    __param(2, (0, common_1.Query)("refresh")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getPaceAnalytics", null);
__decorate([
    (0, common_1.Get)("ai/analytics/concepts/:studentId"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("studentId")),
    __param(2, (0, common_1.Query)("refresh")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getConceptsAnalytics", null);
__decorate([
    (0, common_1.Get)("ai/interventions/effectiveness/:studentId"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("studentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getInterventionsEffectiveness", null);
__decorate([
    (0, common_1.Get)("ai/interventions/effectiveness"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getInterventionsEffectivenessGlobal", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)("chat"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        ai_service_1.AiService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map