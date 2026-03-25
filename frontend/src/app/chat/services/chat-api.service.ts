import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatApiService {
  private apiUrl = 'http://localhost:3000/api/chat';

  constructor(private http: HttpClient) {}

  getSessions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/sessions`);
  }

  getHistory(sessionType: string, sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/history/${sessionType}/${sessionId}`);
  }

  createAiSession(title?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/session`, { title });
  }

  createInstructorSession(instructorId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/instructor/session`, { instructorId });
  }

  createRoom(name: string, participants: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/room`, { name, participants });
  }

  getUsersByRole(role: string): Observable<any> {
    const t = new Date().getTime();
    return this.http.get(`http://localhost:3000/api/user?role=${role}&t=${t}`);
  }

  semanticSearch(query: string, nResults = 10): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai/search`, {
      params: { q: query, n: nResults.toString() },
    });
  }

  aiHealthCheck(): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai/health`);
  }
}
