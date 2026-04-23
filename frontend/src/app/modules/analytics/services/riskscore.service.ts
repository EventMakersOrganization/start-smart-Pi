import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RiskScore } from '../models/analytics.models';

export interface WeakAreaInsight {
  topic: string;
  currentScore: number;
  suggestedDifficulty: 'easy' | 'medium' | 'hard';
  action: string;
  encouragement: string;
  source: 'level-test' | 'performance' | 'profile';
}

export interface AtRiskStudentInsight {
  userId: string;
  name: string;
  email: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  weakAreas: WeakAreaInsight[];
  weakSubskills: string[];
  recommendedFocus: string[];
  lastUpdated: string | Date | null;
}

export interface RiskRecalculationSummary {
  processedStudents: number;
  updatedScores: number;
  highRiskCount: number;
  mediumRiskCount: number;
  generatedAt: string;
  errors: string[];
}

@Injectable({
  providedIn: 'root',
})
export class RiskScoreService {
  private apiUrl = 'http://localhost:3000/api/riskscores';

  constructor(private http: HttpClient) {}

  getAllRiskScores(): Observable<RiskScore[]> {
    return this.http.get<RiskScore[]>(this.apiUrl);
  }

  getRiskScoreById(id: string): Observable<RiskScore> {
    return this.http.get<RiskScore>(`${this.apiUrl}/${id}`);
  }

  getRiskScoresByUser(userId: string): Observable<RiskScore[]> {
    return this.http.get<RiskScore[]>(`${this.apiUrl}/user/${userId}`);
  }

  createRiskScore(riskScore: Partial<RiskScore>): Observable<RiskScore> {
    return this.http.post<RiskScore>(this.apiUrl, riskScore);
  }

  updateRiskScore(id: string, riskScore: Partial<RiskScore>): Observable<RiskScore> {
    return this.http.patch<RiskScore>(`${this.apiUrl}/${id}`, riskScore);
  }

  deleteRiskScore(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getRiskScoreCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/count`);
  }

  recalculateRiskScores(limit?: number): Observable<RiskRecalculationSummary> {
    return this.http.post<RiskRecalculationSummary>(`${this.apiUrl}/recalculate`, {
      limit: typeof limit === 'number' ? limit : undefined,
    });
  }

  getAtRiskInsights(level: 'high' | 'medium' = 'high', limit = 25): Observable<AtRiskStudentInsight[]> {
    return this.http.get<AtRiskStudentInsight[]>(
      `${this.apiUrl}/at-risk-insights?level=${level}&limit=${limit}`,
    );
  }
}
