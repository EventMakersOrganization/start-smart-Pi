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
    constructor(httpService: HttpService, configService: ConfigService);
    askChatbot(question: string, conversationHistory?: Array<{
        role: string;
        content: string;
    }>): Promise<AiChatResponse>;
    semanticSearch(query: string, nResults?: number): Promise<SemanticSearchResult[]>;
    healthCheck(): Promise<{
        status: string;
        model?: string;
    }>;
    private pruneCache;
}
