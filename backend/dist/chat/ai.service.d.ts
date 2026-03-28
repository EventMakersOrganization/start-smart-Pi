import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
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
export interface LearningEventPayload {
    event_type: "quiz" | "exercise" | "chat" | "brainrush";
    score?: number;
    duration_sec?: number;
    metadata?: Record<string, any>;
}
export interface EvaluateAnswerPayload {
    question: Record<string, any>;
    student_answer: any;
    time_taken?: number | null;
}
export interface EvaluateBatchPayload {
    submissions: Array<{
        question: Record<string, any>;
        student_answer: any;
        time_taken?: number | null;
    }>;
}
export interface ClassifyDifficultyPayload {
    question: Record<string, any>;
}
export interface ClassifyDifficultyBatchPayload {
    questions: Array<Record<string, any>>;
}
export interface RecordFeedbackPayload {
    signal_type: string;
    value: number;
    metadata?: Record<string, any>;
}
export interface UserRatingPayload {
    rating: number;
    context?: string;
    metadata?: Record<string, any>;
}
export interface FeedbackStatsQuery {
    signal_type: string;
    last_n?: number;
}
export interface MonitorStatsQuery {
    minutes?: number;
}
export interface MonitorErrorsQuery {
    last_n?: number;
}
export interface MonitorThroughputQuery {
    minutes?: number;
}
export interface MonitorHealthResponse {
    status: string;
    overall?: string;
    components?: Record<string, any>;
    api_performance_15m?: Record<string, any>;
    checks?: Record<string, any>;
    checked_at?: string;
}
export interface MonitorErrorsResponse {
    status: string;
    count: number;
    errors: Array<{
        endpoint?: string;
        latency?: number;
        metadata?: Record<string, any>;
        timestamp?: string;
    }>;
}
export interface MonitorThroughputResponse {
    status: string;
    window_minutes: number;
    total_requests: number;
    requests_per_minute: number;
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
    }>): Promise<AiChatResponse>;
    semanticSearch(query: string, nResults?: number): Promise<SemanticSearchResult[]>;
    startLevelTest(studentId: string, subjects?: string[]): Promise<any>;
    submitAnswer(sessionId: string, answer: string): Promise<any>;
    completeLevelTest(sessionId: string): Promise<any>;
    getLevelTestSession(sessionId: string): Promise<any>;
    getPersonalizedRecommendations(studentProfile: Record<string, any>, nResults?: number): Promise<any>;
    evaluateAnswer(payload: EvaluateAnswerPayload): Promise<any>;
    evaluateBatch(payload: EvaluateBatchPayload): Promise<any>;
    classifyDifficulty(payload: ClassifyDifficultyPayload): Promise<any>;
    classifySuggestAdjustment(payload: ClassifyDifficultyPayload): Promise<any>;
    classifyDifficultyBatch(payload: ClassifyDifficultyBatchPayload): Promise<any>;
    recordFeedback(payload: RecordFeedbackPayload): Promise<any>;
    recordUserRating(payload: UserRatingPayload): Promise<any>;
    getFeedbackRecommendations(): Promise<any>;
    getFeedbackStats(query: FeedbackStatsQuery): Promise<any>;
    getMonitorStats(query: MonitorStatsQuery): Promise<any>;
    getMonitorHealth(): Promise<MonitorHealthResponse>;
    getMonitorErrors(query: MonitorErrorsQuery): Promise<MonitorErrorsResponse>;
    getMonitorThroughput(query: MonitorThroughputQuery): Promise<MonitorThroughputResponse>;
    recordLearningEvent(studentId: string, payload: LearningEventPayload): Promise<any>;
    getLearningState(studentId: string): Promise<any>;
    getLearningAnalytics(studentId: string, forceRefresh?: boolean): Promise<any>;
    getPaceAnalytics(studentId: string, forceRefresh?: boolean): Promise<any>;
    getConceptsAnalytics(studentId: string, forceRefresh?: boolean): Promise<any>;
    getInterventionsEffectiveness(studentId: string): Promise<any>;
    getInterventionsEffectivenessGlobal(): Promise<any>;
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
    private isAiServiceUnavailableError;
    private getErrorMessage;
}
