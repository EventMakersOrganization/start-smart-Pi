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
exports.BrainrushController = void 0;
const common_1 = require("@nestjs/common");
const brainrush_service_1 = require("./brainrush.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_schema_1 = require("../users/schemas/user.schema");
const create_room_dto_1 = require("./dto/create-room.dto");
const join_room_dto_1 = require("./dto/join-room.dto");
const submit_answer_dto_1 = require("./dto/submit-answer.dto");
const leaderboard_service_1 = require("./services/leaderboard.service");
let BrainrushController = class BrainrushController {
    constructor(brainrushService, leaderboardService) {
        this.brainrushService = brainrushService;
        this.leaderboardService = leaderboardService;
    }
    createRoom(dto, req) {
        return this.brainrushService.createRoom(dto, req.user._id);
    }
    joinRoom(dto, req) {
        return this.brainrushService.joinRoom(dto, req.user._id);
    }
    getNextQuestion(sessionId, req) {
        return this.brainrushService.getNextQuestion(sessionId, req.user._id);
    }
    submitAnswer(sessionId, dto, req) {
        return this.brainrushService.submitAnswer(sessionId, req.user._id, dto);
    }
    finishGame(sessionId, req) {
        return this.brainrushService.finishGame(sessionId, req.user._id);
    }
    getLeaderboard(sessionId) {
        return this.leaderboardService.getLeaderboard(sessionId);
    }
};
exports.BrainrushController = BrainrushController;
__decorate([
    (0, common_1.Post)('create-room'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_room_dto_1.CreateRoomDto, Object]),
    __metadata("design:returntype", void 0)
], BrainrushController.prototype, "createRoom", null);
__decorate([
    (0, common_1.Post)('join-room'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [join_room_dto_1.JoinRoomDto, Object]),
    __metadata("design:returntype", void 0)
], BrainrushController.prototype, "joinRoom", null);
__decorate([
    (0, common_1.Get)(':sessionId/next-question'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BrainrushController.prototype, "getNextQuestion", null);
__decorate([
    (0, common_1.Post)(':sessionId/submit-answer'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submit_answer_dto_1.SubmitAnswerDto, Object]),
    __metadata("design:returntype", void 0)
], BrainrushController.prototype, "submitAnswer", null);
__decorate([
    (0, common_1.Post)(':sessionId/finish'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BrainrushController.prototype, "finishGame", null);
__decorate([
    (0, common_1.Get)(':sessionId/leaderboard'),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BrainrushController.prototype, "getLeaderboard", null);
exports.BrainrushController = BrainrushController = __decorate([
    (0, common_1.Controller)('brainrush'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_schema_1.UserRole.STUDENT),
    __metadata("design:paramtypes", [brainrush_service_1.BrainrushService,
        leaderboard_service_1.LeaderboardService])
], BrainrushController);
//# sourceMappingURL=brainrush.controller.js.map