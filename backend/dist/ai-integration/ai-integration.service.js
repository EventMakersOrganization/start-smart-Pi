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
var AIIntegrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIIntegrationService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let AIIntegrationService = AIIntegrationService_1 = class AIIntegrationService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(AIIntegrationService_1.name);
        this.aiServiceUrl =
            this.configService.get('AI_SERVICE_URL') || 'http://localhost:8000';
        this.logger.log(`AI service URL: ${this.aiServiceUrl}`);
    }
    getErrorMessage(error, fallback) {
        if (error?.response?.data?.detail)
            return String(error.response.data.detail);
        if (error?.response?.data?.message)
            return String(error.response.data.message);
        if (error?.message && String(error.message).trim())
            return String(error.message);
        if (error?.code)
            return `${fallback} (${error.code})`;
        return fallback;
    }
    async searchCourses(query, nResults = 5) {
        this.logger.log(`searchCourses: query="${query}", nResults=${nResults}`);
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiServiceUrl}/search`, {
                query,
                n_results: nResults,
            }));
            this.logger.log(`searchCourses: received ${data?.results?.length ?? 0} results`);
            return data;
        }
        catch (error) {
            const message = this.getErrorMessage(error, 'AI service search failed');
            this.logger.error(`searchCourses failed: ${message}`);
            if (error?.code === 'ECONNREFUSED') {
                this.logger.error(`Ensure the Python AI service is running at ${this.aiServiceUrl}`);
            }
            throw new Error(message);
        }
    }
    async generateQuestion(subject, difficulty, topic) {
        this.logger.log(`generateQuestion: subject=${subject}, difficulty=${difficulty}, topic=${topic}`);
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiServiceUrl}/generate-question`, {
                subject,
                difficulty,
                topic,
            }));
            this.logger.log('generateQuestion: success');
            return data;
        }
        catch (error) {
            const message = this.getErrorMessage(error, 'AI service generate-question failed');
            this.logger.error(`generateQuestion failed: ${message}`);
            throw new Error(message);
        }
    }
    async generateLevelTest(subject, numQuestions, difficulty) {
        this.logger.log(`generateLevelTest: subject=${subject}, numQuestions=${numQuestions}, difficulty=${difficulty}`);
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiServiceUrl}/generate-level-test`, {
                subject,
                num_questions: numQuestions,
                difficulty,
            }));
            this.logger.log(`generateLevelTest: created ${data?.question_ids?.length ?? 0} questions`);
            return data;
        }
        catch (error) {
            const message = this.getErrorMessage(error, 'AI service generate-level-test failed');
            this.logger.error(`generateLevelTest failed: ${message}`);
            throw new Error(message);
        }
    }
    async embedAllCourses() {
        this.logger.log('embedAllCourses: calling batch-embed-courses');
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiServiceUrl}/batch-embed-courses`));
            this.logger.log(`embedAllCourses: processed=${data?.courses_processed}, created=${data?.embeddings_created}`);
            return data;
        }
        catch (error) {
            const message = this.getErrorMessage(error, 'AI service batch-embed-courses failed');
            this.logger.error(`embedAllCourses failed: ${message}`);
            throw new Error(message);
        }
    }
};
exports.AIIntegrationService = AIIntegrationService;
exports.AIIntegrationService = AIIntegrationService = AIIntegrationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], AIIntegrationService);
//# sourceMappingURL=ai-integration.service.js.map