import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { ExplainabilityLog } from '../models/analytics.models';

@Injectable({
  providedIn: 'root',
})
export class ExplainabilityService {
  private apiUrl = '/api/analytics/explainability';

  constructor(private http: HttpClient) {}

  /**
   * Get all explainability logs (paginated, filterable)
   */
  getAllExplanations(
    skip: number = 0,
    limit: number = 50,
    filters?: { userId?: string; decision?: string; dateRange?: { start?: Date; end?: Date } }
  ): Observable<ExplainabilityLog[]> {
    let params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString());

    if (filters?.userId) {
      params = params.set('userId', filters.userId);
    }

    if (filters?.decision) {
      params = params.set('decision', filters.decision);
    }

    if (filters?.dateRange?.start) {
      params = params.set('startDate', filters.dateRange.start.toISOString());
    }

    if (filters?.dateRange?.end) {
      params = params.set('endDate', filters.dateRange.end.toISOString());
    }

    return this.http.get<ExplainabilityLog[]>(this.apiUrl, { params });
  }

  /**
   * Get explanations for a specific user/student
   */
  getExplanationsByUser(userId: string): Observable<ExplainabilityLog[]> {
    return this.http.get<ExplainabilityLog[]>(`${this.apiUrl}/user/${userId}`);
  }

  /**
   * Get a single explanation by ID
   */
  getExplanationById(explanationId: string): Observable<ExplainabilityLog> {
    return this.http.get<ExplainabilityLog>(`${this.apiUrl}/${explanationId}`);
  }

  /**
   * Get total count of explanations (for pagination)
   */
  getExplanationCount(filters?: {
    decision?: string;
    dateRange?: { start?: Date; end?: Date };
  }): Observable<{ count: number }> {
    let params = new HttpParams();

    if (filters?.decision) {
      params = params.set('decision', filters.decision);
    }

    if (filters?.dateRange?.start) {
      params = params.set('startDate', filters.dateRange.start.toISOString());
    }

    if (filters?.dateRange?.end) {
      params = params.set('endDate', filters.dateRange.end.toISOString());
    }

    return this.http.get<{ count: number }>(`${this.apiUrl}/count`, { params });
  }

  /**
   * Get explanations filtered by risk level
   */
  getExplanationsByRiskLevel(minRisk: number, maxRisk: number): Observable<ExplainabilityLog[]> {
    const params = new HttpParams()
      .set('minRisk', minRisk.toString())
      .set('maxRisk', maxRisk.toString());

    return this.http.get<ExplainabilityLog[]>(`${this.apiUrl}/risk-level`, { params });
  }

  /**
   * Get most recent explanations (default: last 50)
   */
  getRecentExplanations(limit: number = 50): Observable<ExplainabilityLog[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ExplainabilityLog[]>(`${this.apiUrl}/recent`, { params });
  }

  /**
   * Get explanations by decision type
   */
  getExplanationsByDecision(decision: string): Observable<ExplainabilityLog[]> {
    return this.http.get<ExplainabilityLog[]>(`${this.apiUrl}/decision/${decision}`);
  }
}
