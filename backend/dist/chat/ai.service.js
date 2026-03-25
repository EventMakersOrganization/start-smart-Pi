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
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let AiService = AiService_1 = class AiService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(AiService_1.name);
        this.cache = new Map();
        this.CACHE_TTL_MS = 5 * 60 * 1000;
        this.aiBaseUrl = this.configService.get('AI_SERVICE_URL', 'http://localhost:8000');
        this.logger.log(`AI Service URL: ${this.aiBaseUrl}`);
    }
    async askChatbot(question, conversationHistory) {
        const cacheKey = question.trim().toLowerCase();
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
            this.logger.debug(`Cache hit for: "${question.substring(0, 40)}..."`);
            return cached.data;
        }
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/chatbot/ask`, {
                question,
                conversation_history: conversationHistory || [],
            }, { timeout: 120_000 }));
            const result = {
                answer: data.answer || 'Sorry, I could not generate an answer.',
                sources: data.sources || [],
                confidence: data.validation?.confidence ?? 0,
                is_valid: data.validation?.is_valid ?? false,
            };
            this.cache.set(cacheKey, { data: result, ts: Date.now() });
            this.pruneCache();
            return result;
        }
        catch (error) {
            this.logger.error(`AI chatbot request failed: ${error.message}`);
            return {
                answer: 'I am temporarily unavailable. Please try again in a moment.',
                sources: [],
                confidence: 0,
                is_valid: false,
            };
        }
    }
    async semanticSearch(query, nResults = 10) {
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/search-chunks`, {
                query,
                n_results: nResults,
            }, { timeout: 30_000 }));
            return (data.results || []).map((r) => ({
                chunk_id: r.chunk_id || '',
                chunk_text: r.chunk_text || '',
                course_id: r.course_id || '',
                course_title: (r.metadata || {}).course_title || '',
                similarity: r.similarity || 0,
            }));
        }
        catch (error) {
            this.logger.error(`Semantic search failed: ${error.message}`);
            return [];
        }
    }
    async healthCheck() {
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/health`, { timeout: 5_000 }));
            return { status: 'ok', model: data.ollama_model };
        }
        catch {
            return { status: 'unavailable' };
        }
    }
    pruneCache() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now - entry.ts > this.CACHE_TTL_MS) {
                this.cache.delete(key);
            }
        }
        if (this.cache.size > 200) {
            const oldest = [...this.cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
            for (let i = 0; i < 50; i++) {
                this.cache.delete(oldest[i][0]);
            }
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map