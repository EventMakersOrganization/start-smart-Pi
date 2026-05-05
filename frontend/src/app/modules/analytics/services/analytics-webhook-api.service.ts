import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl, socketBaseUrl, publicApiOrigin, assetUrl } from '../../../core/api-url';

export interface AnalyticsWebhookItem {
  _id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsWebhookApiService {
  private readonly base = apiUrl('/api/analytics/webhooks');

  constructor(private readonly http: HttpClient) {}

  list(): Observable<AnalyticsWebhookItem[]> {
    return this.http.get<AnalyticsWebhookItem[]>(this.base);
  }

  create(body: {
    name: string;
    url: string;
    secret: string;
    events?: string[];
  }): Observable<AnalyticsWebhookItem> {
    return this.http.post<AnalyticsWebhookItem>(this.base, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  test(id: string): Observable<{ ok: boolean; error?: string }> {
    return this.http.post<{ ok: boolean; error?: string }>(`${this.base}/${id}/test`, {});
  }
}
