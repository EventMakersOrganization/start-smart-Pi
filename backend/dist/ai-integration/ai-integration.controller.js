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
exports.AIIntegrationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ai_integration_service_1 = require("./ai-integration.service");
const search_courses_dto_1 = require("./dto/search-courses.dto");
const generate_question_dto_1 = require("./dto/generate-question.dto");
const generate_test_dto_1 = require("./dto/generate-test.dto");
let AIIntegrationController = class AIIntegrationController {
    constructor(aiIntegrationService) {
        this.aiIntegrationService = aiIntegrationService;
    }
    async search(dto) {
        try {
            const nResults = dto.nResults ?? 5;
            return await this.aiIntegrationService.searchCourses(dto.query, nResults);
        }
        catch (error) {
            throw new common_1.HttpException(error?.message ?? 'AI search failed', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async generateQuestion(dto) {
        try {
            const topic = dto.topic ?? 'general';
            return await this.aiIntegrationService.generateQuestion(dto.subject, dto.difficulty, topic);
        }
        catch (error) {
            throw new common_1.HttpException(error?.message ?? 'AI generate-question failed', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async generateTest(dto) {
        try {
            const difficulty = dto.difficulty ?? 'medium';
            return await this.aiIntegrationService.generateLevelTest(dto.subject, dto.numQuestions, difficulty);
        }
        catch (error) {
            throw new common_1.HttpException(error?.message ?? 'AI generate-level-test failed', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async embedCourses() {
        try {
            return await this.aiIntegrationService.embedAllCourses();
        }
        catch (error) {
            throw new common_1.HttpException(error?.message ?? 'AI embed-courses failed', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
};
exports.AIIntegrationController = AIIntegrationController;
__decorate([
    (0, common_1.Post)('search'),
    (0, swagger_1.ApiOperation)({ summary: 'Semantic search over course content (proxies to AI service)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Search results from AI service.' }),
    (0, swagger_1.ApiResponse)({ status: 502, description: 'AI service unavailable or error.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_courses_dto_1.SearchCoursesDto]),
    __metadata("design:returntype", Promise)
], AIIntegrationController.prototype, "search", null);
__decorate([
    (0, common_1.Post)('generate-question'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate a single question (preview, proxied to AI service)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Generated question.' }),
    (0, swagger_1.ApiResponse)({ status: 502, description: 'AI service unavailable or error.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [generate_question_dto_1.GenerateQuestionDto]),
    __metadata("design:returntype", Promise)
], AIIntegrationController.prototype, "generateQuestion", null);
__decorate([
    (0, common_1.Post)('generate-test'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate level test questions and save (proxied to AI service)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Generated test with question IDs.' }),
    (0, swagger_1.ApiResponse)({ status: 502, description: 'AI service unavailable or error.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [generate_test_dto_1.GenerateTestDto]),
    __metadata("design:returntype", Promise)
], AIIntegrationController.prototype, "generateTest", null);
__decorate([
    (0, common_1.Post)('embed-courses'),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger batch embedding of courses (proxied to AI service)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Embedding job result.' }),
    (0, swagger_1.ApiResponse)({ status: 502, description: 'AI service unavailable or error.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AIIntegrationController.prototype, "embedCourses", null);
exports.AIIntegrationController = AIIntegrationController = __decorate([
    (0, swagger_1.ApiTags)('ai'),
    (0, common_1.Controller)('ai'),
    __metadata("design:paramtypes", [ai_integration_service_1.AIIntegrationService])
], AIIntegrationController);
//# sourceMappingURL=ai-integration.controller.js.map