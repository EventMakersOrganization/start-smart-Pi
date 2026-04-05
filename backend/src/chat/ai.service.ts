import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import Redis from "ioredis";
import { createHash } from "crypto";

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
  private readonly cache = new Map<string, { data: any; ts: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly redisPrefix: string;
  private redisClient: Redis | null = null;
  private readonly latencyByEndpoint = new Map<string, number[]>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiBaseUrl = this.configService.get<string>(
      "AI_SERVICE_URL",
      "http://localhost:8000",
    );
    this.redisPrefix = this.configService.get<string>(
      "REDIS_CACHE_PREFIX",
      "startsmart:backend:ai",
    );
    this.tryInitRedis();
    this.logger.log(`AI Service URL: ${this.aiBaseUrl}`);
  }

  async askChatbot(
    question: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    studentId?: string,
    mode?: string,
  ): Promise<AiChatResponse> {
    const cacheKey = this.makeCacheKey("chatbot", {
      question: question.trim().toLowerCase(),
      historyTail: (conversationHistory || []).slice(-4),
      studentId: studentId || "",
      mode: mode || "",
    });
    const cached = await this.getFromCache<AiChatResponse>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Cache hit for chatbot: "${question.substring(0, 40)}..."`,
      );
      return cached;
    }

    try {
      const { data } = await this.timedAiCall("/chatbot/ask", async () => {
        return await firstValueFrom(
          this.httpService.post(
            `${this.aiBaseUrl}/chatbot/ask`,
            {
              question,
              conversation_history: conversationHistory || [],
              student_id: studentId || null,
              mode: mode || null,
            },
            { timeout: 120_000 },
          ),
        );
      });

      const result: AiChatResponse = {
        answer: data.answer || "Sorry, I could not generate an answer.",
        sources: data.sources || [],
        confidence: data.validation?.confidence ?? 0,
        is_valid: data.validation?.is_valid ?? false,
      };

      console.log("RAW LLM RESPONSE:", result.answer);

      await this.setInCache(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(`AI chatbot request failed: ${error.message}`);
      return {
        answer: "I am temporarily unavailable. Please try again in a moment.",
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
    const cacheKey = this.makeCacheKey("semantic-search", {
      query: query.trim().toLowerCase(),
      nResults,
    });
    const cached = await this.getFromCache<SemanticSearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }
    try {
      const { data } = await this.timedAiCall("/search-chunks", async () => {
        return await firstValueFrom(
          this.httpService.post(
            `${this.aiBaseUrl}/search-chunks`,
            {
              query,
              n_results: nResults,
            },
            { timeout: 30_000 },
          ),
        );
      });
      const results = (data.results || []).map((r: any) => ({
        chunk_id: r.chunk_id || "",
        chunk_text: r.chunk_text || "",
        course_id: r.course_id || "",
        course_title: (r.metadata || {}).course_title || "",
        similarity: r.similarity || 0,
      }));
      await this.setInCache(cacheKey, results);
      return results;
    } catch (error) {
      this.logger.error(`Semantic search failed: ${error.message}`);
      return [];
    }
  }

  // ----- Sprint 7: Level-test proxies -----

  async startLevelTest(studentId: string, subjects?: string[]): Promise<any> {
    try {
      const { data } = await this.timedAiCall("/level-test/start", async () => {
        return await firstValueFrom(
          this.httpService.post(
            `${this.aiBaseUrl}/level-test/start`,
            { student_id: studentId, subjects: subjects || null },
            { timeout: 120_000 },
          ),
        );
      });
      return data;
    } catch (error) {
      this.logger.error(`startLevelTest failed: ${error.message}`);
      throw error;
    }
  }

  async submitAnswer(sessionId: string, answer: string): Promise<any> {
    try {
      const { data } = await this.timedAiCall(
        "/level-test/submit-answer",
        async () => {
          return await firstValueFrom(
            this.httpService.post(
              `${this.aiBaseUrl}/level-test/submit-answer`,
              { session_id: sessionId, answer },
              { timeout: 120_000 },
            ),
          );
        },
      );
      return data;
    } catch (error) {
      this.logger.error(`submitAnswer failed: ${error.message}`);
      throw error;
    }
  }

  async completeLevelTest(sessionId: string): Promise<any> {
    try {
      const { data } = await this.timedAiCall(
        "/level-test/complete",
        async () => {
          return await firstValueFrom(
            this.httpService.post(
              `${this.aiBaseUrl}/level-test/complete`,
              { session_id: sessionId },
              { timeout: 60_000 },
            ),
          );
        },
      );
      return data;
    } catch (error) {
      this.logger.error(`completeLevelTest failed: ${error.message}`);
      throw error;
    }
  }

  async getLevelTestSession(sessionId: string): Promise<any> {
    try {
      const { data } = await this.timedAiCall(
        "/level-test/session",
        async () => {
          return await firstValueFrom(
            this.httpService.get(
              `${this.aiBaseUrl}/level-test/session/${sessionId}`,
              { timeout: 10_000 },
            ),
          );
        },
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
      const { data } = await this.timedAiCall(
        "/recommendations/personalized",
        async () => {
          return await firstValueFrom(
            this.httpService.post(
              `${this.aiBaseUrl}/recommendations/personalized`,
              { student_profile: studentProfile, n_results: nResults },
              { timeout: 30_000 },
            ),
          );
        },
      );
      return data;
    } catch (error) {
      this.logger.error(
        `getPersonalizedRecommendations failed: ${error.message}`,
      );
      throw error;
    }
  }

  async getLearningState(studentId: string): Promise<any> {
    try {
      const { data } = await this.timedAiCall("/learning-state", async () => {
        return await firstValueFrom(
          this.httpService.get(
            `${this.aiBaseUrl}/learning-state/${studentId}`,
            {
              timeout: 15_000,
            },
          ),
        );
      });
      return data;
    } catch (error) {
      this.logger.error(`getLearningState failed: ${error.message}`);
      throw error;
    }
  }

  async getLearningAnalytics(studentId: string, refresh = false): Promise<any> {
    try {
      const { data } = await this.timedAiCall(
        "/analytics/learning",
        async () => {
          return await firstValueFrom(
            this.httpService.get(
              `${this.aiBaseUrl}/analytics/learning/${studentId}`,
              {
                params: refresh ? { refresh: "true" } : undefined,
                timeout: 20_000,
              },
            ),
          );
        },
      );
      return data;
    } catch (error) {
      this.logger.error(`getLearningAnalytics failed: ${error.message}`);
      throw error;
    }
  }

  async getPaceAnalytics(studentId: string, refresh = false): Promise<any> {
    try {
      const { data } = await this.timedAiCall("/analytics/pace", async () => {
        return await firstValueFrom(
          this.httpService.get(
            `${this.aiBaseUrl}/analytics/pace/${studentId}`,
            {
              params: refresh ? { refresh: "true" } : undefined,
              timeout: 20_000,
            },
          ),
        );
      });
      return data;
    } catch (error) {
      this.logger.error(`getPaceAnalytics failed: ${error.message}`);
      throw error;
    }
  }

  async getConceptsAnalytics(studentId: string, refresh = false): Promise<any> {
    try {
      const { data } = await this.timedAiCall(
        "/analytics/concepts",
        async () => {
          return await firstValueFrom(
            this.httpService.get(
              `${this.aiBaseUrl}/analytics/concepts/${studentId}`,
              {
                params: refresh ? { refresh: "true" } : undefined,
                timeout: 20_000,
              },
            ),
          );
        },
      );
      return data;
    } catch (error) {
      this.logger.error(`getConceptsAnalytics failed: ${error.message}`);
      throw error;
    }
  }

  async getInterventionsEffectiveness(studentId: string): Promise<any> {
    try {
      const { data } = await this.timedAiCall(
        "/interventions/effectiveness/student",
        async () => {
          return await firstValueFrom(
            this.httpService.get(
              `${this.aiBaseUrl}/interventions/effectiveness/${studentId}`,
              { timeout: 20_000 },
            ),
          );
        },
      );
      return data;
    } catch (error) {
      this.logger.error(
        `getInterventionsEffectiveness failed: ${error.message}`,
      );
      throw error;
    }
  }

  async getInterventionsEffectivenessGlobal(): Promise<any> {
    try {
      const { data } = await this.timedAiCall(
        "/interventions/effectiveness/global",
        async () => {
          return await firstValueFrom(
            this.httpService.get(
              `${this.aiBaseUrl}/interventions/effectiveness`,
              { timeout: 20_000 },
            ),
          );
        },
      );
      return data;
    } catch (error) {
      this.logger.error(
        `getInterventionsEffectivenessGlobal failed: ${error.message}`,
      );
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; model?: string }> {
    try {
      const { data } = await this.timedAiCall("/health", async () => {
        return await firstValueFrom(
          this.httpService.get(`${this.aiBaseUrl}/health`, { timeout: 5_000 }),
        );
      });
      return { status: "ok", model: data.ollama_model };
    } catch {
      return { status: "unavailable" };
    }
  }

  getAiLatencyStats() {
    const out: Record<string, any> = {};
    for (const [endpoint, values] of this.latencyByEndpoint.entries()) {
      const sorted = [...values].sort((a, b) => a - b);
      const count = sorted.length;
      if (!count) continue;
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

  private tryInitRedis() {
    const redisUrl = this.configService.get<string>("REDIS_URL", "");
    if (!redisUrl) return;
    try {
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      client.on("error", (err) => {
        this.logger.warn(`Redis cache error: ${err?.message || err}`);
      });
      this.redisClient = client;
      this.logger.log("Redis cache configured for AiService");
    } catch (error) {
      this.redisClient = null;
      this.logger.warn(
        `Redis init failed, using memory cache only: ${error.message}`,
      );
    }
  }

  private makeCacheKey(scope: string, payload: Record<string, any>): string {
    const raw = JSON.stringify(payload);
    const digest = createHash("sha256").update(raw).digest("hex");
    return `${this.redisPrefix}:${scope}:${digest}`;
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    // First try Redis
    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw) {
          return JSON.parse(raw) as T;
        }
      } catch {
        // fall through to memory
      }
    }
    // Memory fallback
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
      return cached.data as T;
    }
    return null;
  }

  private async setInCache<T>(key: string, value: T): Promise<void> {
    this.cache.set(key, { data: value, ts: Date.now() });
    this.pruneCache();
    if (this.redisClient) {
      try {
        await this.redisClient.set(
          key,
          JSON.stringify(value),
          "PX",
          this.CACHE_TTL_MS,
        );
      } catch {
        // keep memory cache as fallback
      }
    }
  }

  private async timedAiCall<T>(
    endpoint: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const t0 = Date.now();
    try {
      const result = await fn();
      const elapsed = Date.now() - t0;
      this.recordLatency(endpoint, elapsed);
      return result;
    } catch (error) {
      const elapsed = Date.now() - t0;
      this.recordLatency(endpoint, elapsed);
      throw error;
    }
  }

  private recordLatency(endpoint: string, elapsedMs: number): void {
    const vals = this.latencyByEndpoint.get(endpoint) || [];
    vals.push(elapsedMs);
    // keep sliding window bounded in memory
    if (vals.length > 500) {
      vals.splice(0, vals.length - 500);
    }
    this.latencyByEndpoint.set(endpoint, vals);
  }
}
