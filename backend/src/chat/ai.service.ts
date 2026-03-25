import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiBaseUrl: string;
  private readonly cache = new Map<string, { data: AiChatResponse; ts: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiBaseUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
    this.logger.log(`AI Service URL: ${this.aiBaseUrl}`);
  }

  async askChatbot(
    question: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ): Promise<AiChatResponse> {
    const cacheKey = question.trim().toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
      this.logger.debug(`Cache hit for: "${question.substring(0, 40)}..."`);
      return cached.data;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiBaseUrl}/chatbot/ask`, {
          question,
          conversation_history: conversationHistory || [],
        }, { timeout: 120_000 }),
      );

      const result: AiChatResponse = {
        answer: data.answer || 'Sorry, I could not generate an answer.',
        sources: data.sources || [],
        confidence: data.validation?.confidence ?? 0,
        is_valid: data.validation?.is_valid ?? false,
      };

      this.cache.set(cacheKey, { data: result, ts: Date.now() });
      this.pruneCache();
      return result;
    } catch (error) {
      this.logger.error(`AI chatbot request failed: ${error.message}`);
      return {
        answer:
          'I am temporarily unavailable. Please try again in a moment.',
        sources: [],
        confidence: 0,
        is_valid: false,
      };
    }
  }

  async semanticSearch(
    query: string,
    nResults = 10,
  ): Promise<SemanticSearchResult[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiBaseUrl}/search-chunks`, {
          query,
          n_results: nResults,
        }, { timeout: 30_000 }),
      );
      return (data.results || []).map((r: any) => ({
        chunk_id: r.chunk_id || '',
        chunk_text: r.chunk_text || '',
        course_id: r.course_id || '',
        course_title: (r.metadata || {}).course_title || '',
        similarity: r.similarity || 0,
      }));
    } catch (error) {
      this.logger.error(`Semantic search failed: ${error.message}`);
      return [];
    }
  }

  // ----- Sprint 7: Level-test proxies -----

  async startLevelTest(
    studentId: string,
    subjects?: string[],
  ): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${this.aiBaseUrl}/level-test/start`,
          { student_id: studentId, subjects: subjects || null },
          { timeout: 120_000 },
        ),
      );
      return data;
    } catch (error) {
      this.logger.error(`startLevelTest failed: ${error.message}`);
      throw error;
    }
  }

  async submitAnswer(sessionId: string, answer: string): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${this.aiBaseUrl}/level-test/submit-answer`,
          { session_id: sessionId, answer },
          { timeout: 120_000 },
        ),
      );
      return data;
    } catch (error) {
      this.logger.error(`submitAnswer failed: ${error.message}`);
      throw error;
    }
  }

  async completeLevelTest(sessionId: string): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${this.aiBaseUrl}/level-test/complete`,
          { session_id: sessionId },
          { timeout: 60_000 },
        ),
      );
      return data;
    } catch (error) {
      this.logger.error(`completeLevelTest failed: ${error.message}`);
      throw error;
    }
  }

  async getLevelTestSession(sessionId: string): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${this.aiBaseUrl}/level-test/session/${sessionId}`,
          { timeout: 10_000 },
        ),
      );
      return data;
    } catch (error) {
      this.logger.error(`getLevelTestSession failed: ${error.message}`);
      throw error;
    }
  }

  async getPersonalizedRecommendations(
    studentProfile: Record<string, any>,
    nResults = 5,
  ): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${this.aiBaseUrl}/recommendations/personalized`,
          { student_profile: studentProfile, n_results: nResults },
          { timeout: 30_000 },
        ),
      );
      return data;
    } catch (error) {
      this.logger.error(
        `getPersonalizedRecommendations failed: ${error.message}`,
      );
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; model?: string }> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.aiBaseUrl}/health`, { timeout: 5_000 }),
      );
      return { status: 'ok', model: data.ollama_model };
    } catch {
      return { status: 'unavailable' };
    }
  }

  private pruneCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.ts > this.CACHE_TTL_MS) {
        this.cache.delete(key);
      }
    }
    if (this.cache.size > 200) {
      const oldest = [...this.cache.entries()].sort(
        (a, b) => a[1].ts - b[1].ts,
      );
      for (let i = 0; i < 50; i++) {
        this.cache.delete(oldest[i][0]);
      }
    }
  }
}
