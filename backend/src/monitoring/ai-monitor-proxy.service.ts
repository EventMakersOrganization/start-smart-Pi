import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

export interface AiServiceMonitorSnapshot {
  ok: boolean;
  overall?: string;
  avgLatencyMs?: number;
  requestsPerMinute?: number;
  error?: string;
}

@Injectable()
export class AiMonitorProxyService {
  private readonly baseUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(
    /\/$/,
    '',
  );

  constructor(private readonly http: HttpService) {}

  async getSnapshot(): Promise<AiServiceMonitorSnapshot> {
    try {
      const [healthRes, tpRes] = await Promise.all([
        firstValueFrom(
          this.http.get<Record<string, unknown>>(`${this.baseUrl}/monitor/health`, {
            timeout: 10000,
          }),
        ),
        firstValueFrom(
          this.http.get<Record<string, unknown>>(`${this.baseUrl}/monitor/throughput?minutes=15`, {
            timeout: 10000,
          }),
        ),
      ]);

      const health = healthRes.data as Record<string, unknown>;
      const tp = tpRes.data as Record<string, unknown>;
      const apiPerf = health?.api_performance_15m as Record<string, unknown> | undefined;
      const medianSec =
        typeof apiPerf?.median_latency === 'number'
          ? (apiPerf.median_latency as number)
          : undefined;
      const rpm =
        typeof tp?.requests_per_minute === 'number'
          ? (tp.requests_per_minute as number)
          : typeof (tp as any)?.requestsPerMinute === 'number'
            ? ((tp as any).requestsPerMinute as number)
            : undefined;

      return {
        ok: true,
        overall: typeof health?.overall === 'string' ? health.overall : undefined,
        avgLatencyMs: medianSec != null ? Math.round(medianSec * 1000) : undefined,
        requestsPerMinute: rpm,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  }
}
