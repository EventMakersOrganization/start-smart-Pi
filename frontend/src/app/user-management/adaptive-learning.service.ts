import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdaptiveLearningService {

  private apiUrl = 'http://localhost:3000/api/adaptive';

  constructor(private http: HttpClient) {}

  getProfile(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/profiles/${userId}`);
  }

  createProfile(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/profiles`, data);
  }

  updateProfile(userId: string, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/profiles/${userId}`, data
    );
  }

  getPerformances(studentId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/performances/student/${studentId}`
    );
  }

  getRecommendations(studentId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/recommendations/student/${studentId}`
    );
  }

  startLevelTest(studentId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/level-test/${studentId}`, {}
    );
  }

  submitLevelTest(
    testId: string,
    answers: any[]
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/level-test/${testId}/submit`,
      { answers }
    );
  }

  getLevelTest(studentId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/level-test/student/${studentId}`
    );
  }

  markRecommendationViewed(id: string): Observable<any> {
  return this.http.patch(
    `${this.apiUrl}/recommendations/${id}/viewed`, {}
  );
}

generateRecommendations(studentId: string): Observable<any> {
  return this.http.post(
    `${this.apiUrl}/recommendations/generate/${studentId}`, {}
  );
}
}