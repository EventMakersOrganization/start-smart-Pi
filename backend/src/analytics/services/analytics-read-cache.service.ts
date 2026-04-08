import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Bump when cached payload shape changes. */
export const ANALYTICS_CACHE_SCHEMA_VERSION = 'v1';

export interface AnalyticsReadCacheStats {
  entryCount: number;
  ttlMs: number;
  schemaVersion: string;
  /** True when REDIS_URL is set and client connected for cross-instance cache sharing. */
  redisEnabled: boolean;
}

/**
 * Short-lived TTL cache for expensive analytics reads.
 * - L1: in-memory Map (per process)
 * - L2 (optional): Redis when REDIS_URL is set — same logical keys as L1, prefixed for multi-instance consistency
 *
 * TTL from ANALYTICS_CACHE_TTL_SECONDS env (default 45s, clamped 5–300).
 */
@Injectable()
export class AnalyticsReadCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsReadCacheService.name);
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly slowLogMs: number;
  private readonly redisLogicalPrefix: string;
  private redisClient: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    const raw = parseInt(process.env.ANALYTICS_CACHE_TTL_SECONDS || '45', 10);
    const sec = Number.isFinite(raw) ? Math.min(300, Math.max(5, raw)) : 45;
    this.ttlMs = sec * 1000;
    const slowRaw = parseInt(process.env.ANALYTICS_SLOW_QUERY_LOG_MS || '500', 10);
    this.slowLogMs = Number.isFinite(slowRaw) && slowRaw > 0 ? slowRaw : 500;
    const basePrefix = this.configService.get<string>('REDIS_CACHE_PREFIX', 'startsmart:backend');
    this.redisLogicalPrefix = `${basePrefix}:analytics`;
    this.tryInitRedis();
  }

  onModuleDestroy(): void {
    if (this.redisClient) {
      this.redisClient.quit().catch(() => undefined);
    }
  }

  getTtlMs(): number {
    return this.ttlMs;
  }

  getStats(): AnalyticsReadCacheStats {
    return {
      entryCount: this.store.size,
      ttlMs: this.ttlMs,
      schemaVersion: ANALYTICS_CACHE_SCHEMA_VERSION,
      redisEnabled: this.redisClient != null,
    };
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (existing && existing.expiresAt > now) {
      return existing.value as T;
    }

    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(this.redisKey(key));
        if (raw) {
          const value = JSON.parse(raw) as T;
          this.store.set(key, { value, expiresAt: now + this.ttlMs });
          return value;
        }
      } catch {
        // fall through to factory
      }
    }

    const t0 = Date.now();
    const value = await factory();
    const elapsed = Date.now() - t0;
    if (elapsed >= this.slowLogMs) {
      this.logger.warn(`Slow analytics query [${key}] ${elapsed}ms`);
    }

    this.store.set(key, { value, expiresAt: now + this.ttlMs });
    if (this.redisClient) {
      try {
        await this.redisClient.set(this.redisKey(key), JSON.stringify(value), 'PX', this.ttlMs);
      } catch {
        // L1 still holds the value
      }
    }
    this.pruneExpired(now);
    return value;
  }

  private redisKey(logicalKey: string): string {
    return `${this.redisLogicalPrefix}:${logicalKey}`;
  }

  private tryInitRedis(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL', '');
    if (!redisUrl) {
      return;
    }
    try {
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      client.on('error', (err) => {
        this.logger.warn(`Redis analytics cache error: ${err?.message || err}`);
      });
      this.redisClient = client;
      this.logger.log('Redis mirroring enabled for analytics read cache');
    } catch (error) {
      this.redisClient = null;
      this.logger.warn(
        `Redis init failed for analytics cache, using memory only: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private pruneExpired(now: number): void {
    if (this.store.size <= 250) {
      return;
    }
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt <= now) {
        this.store.delete(k);
      }
    }
  }
}
