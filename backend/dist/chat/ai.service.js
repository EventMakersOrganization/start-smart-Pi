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
    async evaluateAnswer(payload) {
        try {
            const body = {
                question: payload?.question || {},
                student_answer: payload?.student_answer,
                time_taken: payload?.time_taken === undefined ? null : Number(payload.time_taken),
            };
            const { data } = await this.timedAiCall("/evaluate/answer", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/evaluate/answer`, body, {
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                is_correct: Boolean(data?.is_correct),
                score: Number(data?.score ?? 0),
                max_score: Number(data?.max_score ?? 100),
                partial_credit: Number(data?.partial_credit ?? 0),
                time_bonus: Number(data?.time_bonus ?? 0),
                feedback: String(data?.feedback || ""),
                correct_answer: data?.correct_answer === undefined
                    ? ""
                    : String(data?.correct_answer),
                detailed_result: data?.detailed_result && typeof data.detailed_result === "object"
                    ? data.detailed_result
                    : {},
            };
        }
        catch (error) {
            this.logger.error(`evaluateAnswer failed: ${error.message}`);
            throw error;
        }
    }
    async evaluateBatch(payload) {
        try {
            const submissions = Array.isArray(payload?.submissions)
                ? payload.submissions.map((item) => ({
                    question: item?.question || {},
                    student_answer: item?.student_answer,
                    time_taken: item?.time_taken === undefined ? null : Number(item.time_taken),
                }))
                : [];
            const { data } = await this.timedAiCall("/evaluate/batch", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/evaluate/batch`, { submissions }, { timeout: 60_000 }));
            });
            return {
                status: String(data?.status || "success"),
                count: Number(data?.count ?? 0),
                correct: Number(data?.correct ?? 0),
                incorrect: Number(data?.incorrect ?? 0),
                accuracy: Number(data?.accuracy ?? 0),
                total_score: Number(data?.total_score ?? 0),
                total_max_score: Number(data?.total_max_score ?? 0),
                percentage: Number(data?.percentage ?? 0),
                per_answer: Array.isArray(data?.per_answer) ? data.per_answer : [],
            };
        }
        catch (error) {
            this.logger.error(`evaluateBatch failed: ${error.message}`);
            throw error;
        }
    }
    async classifyDifficulty(payload) {
        try {
            const body = {
                question: payload?.question || {},
            };
            const { data } = await this.timedAiCall("/classify/difficulty", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/classify/difficulty`, body, {
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                difficulty: String(data?.difficulty || "medium"),
                confidence: Number(data?.confidence ?? 0),
                composite_score: Number(data?.composite_score ?? 0),
                feature_breakdown: data?.feature_breakdown && typeof data.feature_breakdown === "object"
                    ? data.feature_breakdown
                    : {},
                suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
            };
        }
        catch (error) {
            this.logger.error(`classifyDifficulty failed: ${error.message}`);
            throw error;
        }
    }
    async classifySuggestAdjustment(payload) {
        try {
            const body = {
                question: payload?.question || {},
            };
            const { data } = await this.timedAiCall("/classify/suggest-adjustment", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/classify/suggest-adjustment`, body, {
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                adjustment_needed: Boolean(data?.adjustment_needed),
                claimed: String(data?.claimed || ""),
                predicted: String(data?.predicted || ""),
                direction: String(data?.direction || ""),
                tips: Array.isArray(data?.tips) ? data.tips : [],
                current_score: Number(data?.current_score ?? 0),
            };
        }
        catch (error) {
            this.logger.error(`classifySuggestAdjustment failed: ${error.message}`);
            throw error;
        }
    }
    async classifyDifficultyBatch(payload) {
        try {
            const body = {
                questions: Array.isArray(payload?.questions) ? payload.questions : [],
            };
            const { data } = await this.timedAiCall("/classify/difficulty-batch", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/classify/difficulty-batch`, body, {
                    timeout: 60_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                count: Number(data?.count ?? 0),
                distribution: data?.distribution && typeof data.distribution === "object"
                    ? data.distribution
                    : {},
                average_score: Number(data?.average_score ?? 0),
                stdev_score: Number(data?.stdev_score ?? 0),
                mismatches: Array.isArray(data?.mismatches) ? data.mismatches : [],
                per_question: Array.isArray(data?.per_question)
                    ? data.per_question
                    : [],
            };
        }
        catch (error) {
            this.logger.error(`classifyDifficultyBatch failed: ${error.message}`);
            throw error;
        }
    }
    async recordFeedback(payload) {
        try {
            const body = {
                signal_type: String(payload?.signal_type || ""),
                value: Number(payload?.value ?? 0),
                metadata: payload?.metadata || {},
            };
            const { data } = await this.timedAiCall("/feedback/record", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/feedback/record`, body, {
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                id: String(data?.id || ""),
            };
        }
        catch (error) {
            this.logger.error(`recordFeedback failed: ${error.message}`);
            throw error;
        }
    }
    async recordUserRating(payload) {
        try {
            const body = {
                rating: Number(payload?.rating ?? 1),
                context: String(payload?.context || ""),
                metadata: payload?.metadata || {},
            };
            const { data } = await this.timedAiCall("/feedback/user-rating", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiBaseUrl}/feedback/user-rating`, body, {
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                id: String(data?.id || ""),
            };
        }
        catch (error) {
            this.logger.error(`recordUserRating failed: ${error.message}`);
            throw error;
        }
    }
    async getFeedbackRecommendations() {
        try {
            const { data } = await this.timedAiCall("/feedback/recommendations", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/feedback/recommendations`, {
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                generated_at: String(data?.generated_at || ""),
                signal_summary: data?.signal_summary || {},
                topic_accuracy: data?.topic_accuracy || {},
                recommendations: Array.isArray(data?.recommendations)
                    ? data.recommendations
                    : [],
            };
        }
        catch (error) {
            this.logger.error(`getFeedbackRecommendations failed: ${error.message}`);
            throw error;
        }
    }
    async getFeedbackStats(query) {
        try {
            const signalType = encodeURIComponent(String(query?.signal_type || ""));
            const lastN = Number(query?.last_n ?? 200);
            const { data } = await this.timedAiCall("/feedback/stats/{signal_type}", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/feedback/stats/${signalType}`, {
                    params: { last_n: Number.isFinite(lastN) ? lastN : 200 },
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                signal_type: String(data?.signal_type || query?.signal_type || ""),
                count: Number(data?.count ?? 0),
                mean: Number(data?.mean ?? 0),
                median: Number(data?.median ?? 0),
                min: Number(data?.min ?? 0),
                max: Number(data?.max ?? 0),
                std: Number(data?.std ?? 0),
            };
        }
        catch (error) {
            this.logger.error(`getFeedbackStats failed: ${error.message}`);
            throw error;
        }
    }
    async getMonitorStats(query) {
        try {
            const minutes = Number(query?.minutes ?? 60);
            const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
            const { data } = await this.timedAiCall("/monitor/stats", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/monitor/stats`, {
                    params: { minutes: safeMinutes },
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                window_minutes: Number(data?.window_minutes ?? safeMinutes),
                total_requests: Number(data?.total_requests ?? 0),
                successes: Number(data?.successes ?? 0),
                failures: Number(data?.failures ?? 0),
                success_rate: Number(data?.success_rate ?? 0),
                mean_latency: Number(data?.mean_latency ?? 0),
                median_latency: Number(data?.median_latency ?? 0),
                p95_latency: Number(data?.p95_latency ?? 0),
                per_endpoint: data?.per_endpoint && typeof data.per_endpoint === "object"
                    ? data.per_endpoint
                    : {},
            };
        }
        catch (error) {
            this.logger.error(`getMonitorStats failed: ${error.message}`);
            throw error;
        }
    }
    async getMonitorHealth() {
        try {
            const { data } = await this.timedAiCall("/monitor/health", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/monitor/health`, {
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                overall: String(data?.overall || "unknown"),
                components: data?.components && typeof data.components === "object"
                    ? data.components
                    : {},
                api_performance_15m: data?.api_performance_15m &&
                    typeof data.api_performance_15m === "object"
                    ? data.api_performance_15m
                    : {},
                checks: data?.checks && typeof data.checks === "object" ? data.checks : {},
                checked_at: String(data?.checked_at || ""),
            };
        }
        catch (error) {
            this.logger.error(`getMonitorHealth failed: ${error.message}`);
            throw error;
        }
    }
    async getMonitorErrors(query) {
        try {
            const lastN = Number(query?.last_n ?? 50);
            const safeLastN = Number.isFinite(lastN) && lastN > 0 ? lastN : 50;
            const { data } = await this.timedAiCall("/monitor/errors", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/monitor/errors`, {
                    params: { last_n: safeLastN },
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                count: Number(data?.count ?? 0),
                errors: Array.isArray(data?.errors) ? data.errors : [],
            };
        }
        catch (error) {
            this.logger.error(`getMonitorErrors failed: ${error.message}`);
            throw error;
        }
    }
    async getMonitorThroughput(query) {
        try {
            const minutes = Number(query?.minutes ?? 60);
            const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
            const { data } = await this.timedAiCall("/monitor/throughput", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/monitor/throughput`, {
                    params: { minutes: safeMinutes },
                    timeout: 30_000,
                }));
            });
            return {
                status: String(data?.status || "success"),
                window_minutes: Number(data?.window_minutes ?? safeMinutes),
                total_requests: Number(data?.total_requests ?? 0),
                requests_per_minute: Number(data?.requests_per_minute ?? 0),
            };
        }
        catch (error) {
            this.logger.error(`getMonitorThroughput failed: ${error.message}`);
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
            if (this.isAiServiceUnavailableError(error)) {
                this.logger.warn(`getLearningState fallback: ${this.getErrorMessage(error)}`);
                return {
                    status: "success",
                    learning_state: null,
                    initialized: false,
                    unavailable: true,
                    message: "AI service temporarily unavailable",
                };
            }
            this.logger.error(`getLearningState failed: ${this.getErrorMessage(error)}`);
            throw error;
        }
    }
    async getLearningAnalytics(studentId, forceRefresh = false) {
        const cacheKey = this.makeCacheKey("learning-analytics", { studentId });
        if (!forceRefresh) {
            const cached = await this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }
        try {
            const { data } = await this.timedAiCall("/analytics/learning/{student_id}", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/analytics/learning/${studentId}`, { timeout: 15_000 }));
            });
            await this.setInCache(cacheKey, data);
            return data;
        }
        catch (error) {
            if (error?.response?.status === 404) {
                this.logger.debug(`No learning analytics yet for student ${studentId}`);
                const emptyAnalytics = {
                    status: "success",
                    daily_progress: {
                        today_score: 0,
                        trend: "stable",
                        attempts: 0,
                    },
                    concepts: {
                        strong_concepts: [],
                        weak_concepts: [],
                        unlock_status: {
                            unlocked: [],
                            locked: [],
                            threshold: 60,
                        },
                    },
                    pace: {
                        pace_mode: "unknown",
                        confidence_score: 0,
                    },
                    predicted_success: [],
                    initialized: false,
                    message: "No learning analytics found yet for this student",
                };
                await this.setInCache(cacheKey, emptyAnalytics);
                return emptyAnalytics;
            }
            if (this.isAiServiceUnavailableError(error)) {
                this.logger.warn(`getLearningAnalytics fallback: ${this.getErrorMessage(error)}`);
                const emptyAnalytics = {
                    status: "success",
                    daily_progress: {
                        today_score: 0,
                        trend: "stable",
                        attempts: 0,
                    },
                    concepts: {
                        strong_concepts: [],
                        weak_concepts: [],
                        unlock_status: {
                            unlocked: [],
                            locked: [],
                            threshold: 60,
                        },
                    },
                    pace: {
                        pace_mode: "unknown",
                        confidence_score: 0,
                    },
                    predicted_success: [],
                    initialized: false,
                    unavailable: true,
                    message: "AI service temporarily unavailable",
                };
                await this.setInCache(cacheKey, emptyAnalytics);
                return emptyAnalytics;
            }
            this.logger.error(`getLearningAnalytics failed: ${this.getErrorMessage(error)}`);
            throw error;
        }
    }
    async getPaceAnalytics(studentId, forceRefresh = false) {
        const cacheKey = this.makeCacheKey("pace-analytics", { studentId });
        if (!forceRefresh) {
            const cached = await this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }
        try {
            const { data } = await this.timedAiCall("/analytics/pace/{student_id}", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/analytics/pace/${studentId}`, { timeout: 15_000 }));
            });
            const normalized = {
                status: "success",
                pace_mode: String(data?.pace_mode || "unknown"),
                trend: String(data?.trend || "stable"),
                confidence_score: Number(data?.confidence_score ?? 0),
                message: String(data?.message || ""),
            };
            await this.setInCache(cacheKey, normalized);
            return normalized;
        }
        catch (error) {
            if (error?.response?.status === 404) {
                this.logger.debug(`No pace analytics yet for student ${studentId}`);
                const emptyPace = {
                    status: "success",
                    pace_mode: "unknown",
                    trend: "stable",
                    confidence_score: 0,
                    initialized: false,
                    message: "No pace analytics found yet for this student",
                };
                await this.setInCache(cacheKey, emptyPace);
                return emptyPace;
            }
            if (this.isAiServiceUnavailableError(error)) {
                this.logger.warn(`getPaceAnalytics fallback: ${this.getErrorMessage(error)}`);
                const emptyPace = {
                    status: "success",
                    pace_mode: "unknown",
                    trend: "stable",
                    confidence_score: 0,
                    initialized: false,
                    unavailable: true,
                    message: "AI service temporarily unavailable",
                };
                await this.setInCache(cacheKey, emptyPace);
                return emptyPace;
            }
            this.logger.error(`getPaceAnalytics failed: ${this.getErrorMessage(error)}`);
            throw error;
        }
    }
    async getConceptsAnalytics(studentId, forceRefresh = false) {
        const cacheKey = this.makeCacheKey("concepts-analytics", { studentId });
        if (!forceRefresh) {
            const cached = await this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }
        try {
            const { data } = await this.timedAiCall("/analytics/concepts/{student_id}", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/analytics/concepts/${studentId}`, { timeout: 15_000 }));
            });
            const normalized = {
                status: "success",
                strong_concepts: Array.isArray(data?.strong_concepts)
                    ? data.strong_concepts
                    : [],
                weak_concepts: Array.isArray(data?.weak_concepts)
                    ? data.weak_concepts
                    : [],
                message: String(data?.message || ""),
            };
            await this.setInCache(cacheKey, normalized);
            return normalized;
        }
        catch (error) {
            if (error?.response?.status === 404) {
                this.logger.debug(`No concepts analytics yet for student ${studentId}`);
                const emptyConcepts = {
                    status: "success",
                    strong_concepts: [],
                    weak_concepts: [],
                    initialized: false,
                    message: "No concept analytics found yet for this student",
                };
                await this.setInCache(cacheKey, emptyConcepts);
                return emptyConcepts;
            }
            if (this.isAiServiceUnavailableError(error)) {
                this.logger.warn(`getConceptsAnalytics fallback: ${this.getErrorMessage(error)}`);
                const emptyConcepts = {
                    status: "success",
                    strong_concepts: [],
                    weak_concepts: [],
                    initialized: false,
                    unavailable: true,
                    message: "AI service temporarily unavailable",
                };
                await this.setInCache(cacheKey, emptyConcepts);
                return emptyConcepts;
            }
            this.logger.error(`getConceptsAnalytics failed: ${this.getErrorMessage(error)}`);
            throw error;
        }
    }
    async getInterventionsEffectiveness(studentId) {
        const cacheKey = this.makeCacheKey("interventions-effectiveness", {
            studentId,
        });
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            const { data } = await this.timedAiCall("/interventions/effectiveness/{student_id}", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/interventions/effectiveness/${studentId}`, { timeout: 15_000 }));
            });
            const stats = data?.stats || {};
            const normalized = {
                status: "success",
                student_id: String(data?.student_id || studentId),
                stats: {
                    count: Number(stats?.count ?? 0),
                    effective_rate: Number(stats?.effective_rate ?? 0),
                    avg_delta_score: Number(stats?.avg_delta_score ?? 0),
                    by_type: stats?.by_type && typeof stats.by_type === "object"
                        ? stats.by_type
                        : {},
                },
                message: String(data?.message || ""),
            };
            await this.setInCache(cacheKey, normalized);
            return normalized;
        }
        catch (error) {
            this.logger.error(`getInterventionsEffectiveness failed: ${error.message}`);
            throw error;
        }
    }
    async getInterventionsEffectivenessGlobal() {
        const cacheKey = this.makeCacheKey("interventions-effectiveness-global", {
            scope: "global",
        });
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            const { data } = await this.timedAiCall("/interventions/effectiveness", async () => {
                return await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiBaseUrl}/interventions/effectiveness`, {
                    timeout: 15_000,
                }));
            });
            const stats = data?.stats || {};
            const normalized = {
                status: "success",
                stats: {
                    count: Number(stats?.count ?? 0),
                    effective_rate: Number(stats?.effective_rate ?? 0),
                    avg_delta_score: Number(stats?.avg_delta_score ?? 0),
                    by_type: stats?.by_type && typeof stats.by_type === "object"
                        ? stats.by_type
                        : {},
                },
                message: String(data?.message || ""),
            };
            await this.setInCache(cacheKey, normalized);
            return normalized;
        }
        catch (error) {
            if (this.isAiServiceUnavailableError(error)) {
                this.logger.warn(`getInterventionsEffectivenessGlobal fallback: ${this.getErrorMessage(error)}`);
                const fallback = {
                    status: "success",
                    stats: {
                        count: 0,
                        effective_rate: 0,
                        avg_delta_score: 0,
                        by_type: {},
                    },
                    initialized: false,
                    unavailable: true,
                    message: "AI service temporarily unavailable",
                };
                await this.setInCache(cacheKey, fallback);
                return fallback;
            }
            this.logger.error(`getInterventionsEffectivenessGlobal failed: ${this.getErrorMessage(error)}`);
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
    isAiServiceUnavailableError(error) {
        if (!error) {
            return false;
        }
        const code = String(error?.code || "").toUpperCase();
        if ([
            "ECONNREFUSED",
            "ECONNRESET",
            "ETIMEDOUT",
            "ESOCKETTIMEDOUT",
            "EHOSTUNREACH",
            "ENOTFOUND",
        ].includes(code)) {
            return true;
        }
        if (error?.name === "AggregateError" || Array.isArray(error?.errors)) {
            return true;
        }
        return !error?.response && !error?.status;
    }
    getErrorMessage(error) {
        const base = String(error?.message || "").trim();
        if (base) {
            return base;
        }
        if (Array.isArray(error?.errors) && error.errors.length > 0) {
            const inner = error.errors
                .map((e) => String(e?.message || e || ""))
                .filter(Boolean)
                .slice(0, 3)
                .join(" | ");
            if (inner) {
                return inner;
            }
        }
        return "unknown error";
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map