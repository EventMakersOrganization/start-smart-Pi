import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export interface AiChatResponse {
    answer: string;
    sources: Array<{
        course_id: string;
        course_title: string;
        chunk_text: string;
        similarity: number;
    }>;
    confidence: number;
    is_valid: boolean;
}
export interface SemanticSearchResult {
    chunk_id: string;
    chunk_text: string;
    course_id: string;
    course_title: string;
    similarity: number;
}
export declare class AiService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly aiBaseUrl;
    private readonly cache;
    private readonly CACHE_TTL_MS;
    private readonly redisPrefix;
    private redisClient;
    private readonly latencyByEndpoint;
    constructor(httpService: HttpService, configService: ConfigService);
    askChatbot(question: string, conversationHistory?: Array<{
        role: string;
        content: string;
    }>, studentId?: string, mode?: string): Promise<AiChatResponse>;
    semanticSearch(query: string, nResults?: number): Promise<SemanticSearchResult[]>;
    startLevelTest(studentId: string, subjects?: string[]): Promise<any>;
    submitAnswer(sessionId: string, answer: string): Promise<any>;
    completeLevelTest(sessionId: string): Promise<any>;
    getLevelTestSession(sessionId: string): Promise<any>;
    getPersonalizedRecommendations(studentProfile: Record<string, any>, nResults?: number): Promise<any>;
    healthCheck(): Promise<{
        status: string;
        model?: string;
    }>;
    getAiLatencyStats(): Record<string, any>;
    private pruneCache;
    private tryInitRedis;
    private makeCacheKey;
    private getFromCache;
    private setInCache;
    private timedAiCall;
    private recordLatency;
}
