import { ConfigService } from '@nestjs/config';
import { AnalyticsReadCacheService } from './analytics-read-cache.service';

describe('AnalyticsReadCacheService', () => {
  const makeConfig = (redisUrl = ''): ConfigService =>
    ({
      get: jest.fn((key: string, def?: string) => {
        if (key === 'REDIS_URL') {
          return redisUrl;
        }
        if (key === 'REDIS_CACHE_PREFIX') {
          return def ?? 'startsmart:backend';
        }
        return def;
      }),
    }) as unknown as ConfigService;

  it('should reuse L1 cache on second getOrSet with same key', async () => {
    const service = new AnalyticsReadCacheService(makeConfig(''));
    let calls = 0;
    const v1 = await service.getOrSet('test-key', async () => {
      calls++;
      return { x: 1 };
    });
    const v2 = await service.getOrSet('test-key', async () => {
      calls++;
      return { x: 2 };
    });
    expect(v1).toEqual({ x: 1 });
    expect(v2).toEqual({ x: 1 });
    expect(calls).toBe(1);
  });

  it('should report redisEnabled false when REDIS_URL is empty', () => {
    const service = new AnalyticsReadCacheService(makeConfig(''));
    expect(service.getStats().redisEnabled).toBe(false);
  });
});
