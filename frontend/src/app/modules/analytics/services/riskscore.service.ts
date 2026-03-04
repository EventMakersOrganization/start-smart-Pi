import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RiskScore } from '../models/analytics.models';

@Injectable({
  providedIn: 'root',
})
export class RiskScoreService {
  private apiUrl = 'http://localhost:3000/riskscores';

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
}
