import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BrainrushService {
  private apiUrl = 'http://localhost:3000/api/brainrush'; // Adjust port

  constructor(private http: HttpClient) {}

  private getHeaders() {
    const token = localStorage.getItem('authToken');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  startSoloGame(difficulty: 'easy' | 'medium' | 'hard'): Observable<any> {
    return this.http.post(`${this.apiUrl}/start-solo`, { initialDifficulty: difficulty }, { headers: this.getHeaders() });
  }

  createRoom(difficulty: 'easy' | 'medium' | 'hard', roomCode?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-room`, { initialDifficulty: difficulty, roomCode }, { headers: this.getHeaders() });
  }

  joinRoom(roomCode: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/join-room`, { roomCode }, { headers: this.getHeaders() });
  }

  submitAnswer(gameSessionId: string, questionId: string, answer: string, timeSpent: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/submit-answer`, {
      gameSessionId,
      questionId,
      answer,
      timeSpent
    }, { headers: this.getHeaders() });
  }

  getLeaderboard(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/leaderboard`, { headers: this.getHeaders() });
  }
}
