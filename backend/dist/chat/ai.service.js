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
const ioredis_1 = require("ioredis");
const crypto_1 = require("crypto");
let AiService = AiService_1 = class AiService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(AiService_1.name);
        this.cache = new Map();
        this.CACHE_TTL_MS = 5 * 60 * 1000;
        this.redisClient = null;
        this.latencyByEndpoint = new Map();
        this.aiBaseUrl = this.configService.get("AI_SERVICE_URL", "http://localhost:8000");
        this.redisPrefix = this.configService.get("REDIS_CACHE_PREFIX", "startsmart:backend:ai");
        this.tryInitRedis();
        this.logger.log(`AI Service URL: ${this.aiBaseUrl}`);
    }
    async askChatbot(question, conversationHistory) {
        const cacheKey = this.makeCacheKey("chatbot", {
            question: question.trim().toLowerCase(),
            historyTail: (conversationHistory || []).slice(-4),
        });
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
            this.logger.debug(`Cache hit for chatbot: "${question.substring(0, 40)}..."`);
            return cached;
        }
        try {
            const { data } = await this.timedAiCall("/chatbot/ask", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/chatbot/ask`, {
                    question,
                    conversation_history: conversationHistory || [],
                }, { timeout: 120_000 }));
            });
            const result = {
                answer: data.answer || "Sorry, I could not generate an answer.",
                sources: data.sources || [],
                confidence: data.validation?.confidence ?? 0,
                is_valid: data.validation?.is_valid ?? false,
            };
            await this.setInCache(cacheKey, result);
            return result;
        }
        catch (error) {
            this.logger.error(`AI chatbot request failed: ${error.message}`);
            return {
                answer: "I am temporarily unavailable. Please try again in a moment.",
                sources: [],
                confidence: 0,
                is_valid: false,
            };
        }
    }
    async semanticSearch(query, nResults = 10) {
        const cacheKey = this.makeCacheKey("semantic-search", {
            query: query.trim().toLowerCase(),
            nResults,
        });
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            const { data } = await this.timedAiCall("/search-chunks", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/search-chunks`, {
                    query,
                    n_results: nResults,
                }, { timeout: 30_000 }));
            });
            const results = (data.results || []).map((r) => ({
                chunk_id: r.chunk_id || "",
                chunk_text: r.chunk_text || "",
                course_id: r.course_id || "",
                course_title: (r.metadata || {}).course_title || "",
                similarity: r.similarity || 0,
            }));
            await this.setInCache(cacheKey, results);
            return results;
        }
        catch (error) {
            this.logger.error(`Semantic search failed: ${error.message}`);
            return [];
        }
    }
    async startLevelTest(studentId, subjects) {
        try {
            const { data } = await this.timedAiCall("/level-test/start", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/level-test/start`, { student_id: studentId, subjects: subjects || null }, { timeout: 120_000 }));
            });
            return data;
        }
        catch (error) {
            this.logger.error(`startLevelTest failed: ${error.message}`);
            throw error;
        }
    }
    async submitAnswer(sessionId, answer) {
        try {
            const { data } = await this.timedAiCall("/level-test/submit-answer", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/level-test/submit-answer`, { session_id: sessionId, answer }, { timeout: 120_000 }));
            });
            return data;
        }
        catch (error) {
            this.logger.error(`submitAnswer failed: ${error.message}`);
            throw error;
        }
    }
    async completeLevelTest(sessionId) {
        try {
            const { data } = await this.timedAiCall("/level-test/complete", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/level-test/complete`, { session_id: sessionId }, { timeout: 60_000 }));
            });
            return data;
        }
        catch (error) {
            this.logger.error(`completeLevelTest failed: ${error.message}`);
            throw error;
        }
    }
    async getLevelTestSession(sessionId) {
        try {
            const { data } = await this.timedAiCall("/level-test/session", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/level-test/session/${sessionId}`, { timeout: 10_000 }));
            });
            return data;
        }
        catch (error) {
            this.logger.error(`getLevelTestSession failed: ${error.message}`);
            throw error;
        }
    }
    async getPersonalizedRecommendations(studentProfile, nResults = 5) {
        try {
            const { data } = await this.timedAiCall("/recommendations/personalized", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/recommendations/personalized`, { student_profile: studentProfile, n_results: nResults }, { timeout: 30_000 }));
            });
            return data;
        }
        catch (error) {
            this.logger.error(`getPersonalizedRecommendations failed: ${error.message}`);
            throw error;
        }
    }
    async recordLearningEvent(studentId, payload) {
        try {
            const { data } = await this.timedAiCall("/learning-state/event", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/learning-state/event`, {
                    student_id: studentId,
                    event_type: payload.event_type,
                    score: payload.score,
                    duration_sec: payload.duration_sec,
                    metadata: payload.metadata || {},
                }, { timeout: 30_000 }));
            });
            return data;
        }
        catch (error) {
            this.logger.error(`recordLearningEvent failed: ${error.message}`);
            throw error;
        }
    }
    async getLearningState(studentId) {
        try {
            const { data } = await this.timedAiCall("/learning-state/{student_id}", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/learning-state/${studentId}`, {
                    timeout: 15_000,
                }));
            });
            return data;
        }
        catch (error) {
            if (error?.response?.status === 404) {
                this.logger.debug(`No adaptive learning state yet for student ${studentId}`);
                return {
                    status: "success",
                    learning_state: null,
                    initialized: false,
                    message: "No learning state found yet for this student",
                };
            }
            this.logger.error(`getLearningState failed: ${error.message}`);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const { data } = await this.timedAiCall("/health", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/health`, { timeout: 5_000 }));
            });
            return { status: "ok", model: data.ollama_model };
        }
        catch {
            return { status: "unavailable" };
        }
    }
    getAiLatencyStats() {
        const out = {};
        for (const [endpoint, values] of this.latencyByEndpoint.entries()) {
            const sorted = [...values].sort((a, b) => a - b);
            const count = sorted.length;
            if (!count)
                continue;
            const mean = sorted.reduce((a, b) => a + b, 0) / count;
            const p95Idx = Math.min(count - 1, Math.floor(count * 0.95));
            out[endpoint] = {
                count,
                mean_ms: Math.round(mean),
                p95_ms: Math.round(sorted[p95Idx]),
                max_ms: Math.round(sorted[count - 1]),
            };
        }
        return out;
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
    tryInitRedis() {
        const redisUrl = this.configService.get("REDIS_URL", "");
        if (!redisUrl)
            return;
        try {
            const client = new ioredis_1.default(redisUrl, {
                maxRetriesPerRequest: 1,
                lazyConnect: true,
            });
            client.on("error", (err) => {
                this.logger.warn(`Redis cache error: ${err?.message || err}`);
            });
            this.redisClient = client;
            this.logger.log("Redis cache configured for AiService");
        }
        catch (error) {
            this.redisClient = null;
            this.logger.warn(`Redis init failed, using memory cache only: ${error.message}`);
        }
    }
    makeCacheKey(scope, payload) {
        const raw = JSON.stringify(payload);
        const digest = (0, crypto_1.createHash)("sha256").update(raw).digest("hex");
        return `${this.redisPrefix}:${scope}:${digest}`;
    }
    async getFromCache(key) {
        if (this.redisClient) {
            try {
                const raw = await this.redisClient.get(key);
                if (raw) {
                    return JSON.parse(raw);
                }
            }
            catch {
            }
        }
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
            return cached.data;
        }
        return null;
    }
    async setInCache(key, value) {
        this.cache.set(key, { data: value, ts: Date.now() });
        this.pruneCache();
        if (this.redisClient) {
            try {
                await this.redisClient.set(key, JSON.stringify(value), "PX", this.CACHE_TTL_MS);
            }
            catch {
            }
        }
    }
    async timedAiCall(endpoint, fn) {
        const t0 = Date.now();
        try {
            const result = await fn();
            const elapsed = Date.now() - t0;
            this.recordLatency(endpoint, elapsed);
            return result;
        }
        catch (error) {
            const elapsed = Date.now() - t0;
            this.recordLatency(endpoint, elapsed);
            throw error;
        }
    }
    recordLatency(endpoint, elapsedMs) {
        const vals = this.latencyByEndpoint.get(endpoint) || [];
        vals.push(elapsedMs);
        if (vals.length > 500) {
            vals.splice(0, vals.length - 500);
        }
        this.latencyByEndpoint.set(endpoint, vals);
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map