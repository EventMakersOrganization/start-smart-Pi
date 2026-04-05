import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BrainrushService {
  private nestUrl = 'http://localhost:3000/api/brainrush';
  private aiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) { }

  // ── NestJS backend ────────────────────────
  createRoom(mode: string, topic: string, difficulty: string): Observable<any> {
    return this.http.post(`${this.nestUrl}/create-room`, { mode, topic, difficulty });
  }

  joinRoom(roomCode: string): Observable<any> {
    return this.http.post(`${this.nestUrl}/join-room`, { roomCode });
  }

  getNextQuestion(sessionId: string): Observable<any> {
    return this.http.get(`${this.nestUrl}/${sessionId}/next-question`);
  }

  submitAnswer(sessionId: string, questionId: string, answer: string, responseTime: number): Observable<any> {
    return this.http.post(`${this.nestUrl}/${sessionId}/submit-answer`, { questionId, answer, responseTime });
  }

  finishGame(sessionId: string): Observable<any> {
    return this.http.post(`${this.nestUrl}/${sessionId}/finish`, {});
  }

  initializeSoloSession(sessionId: string, topic: string, difficulty: string): Observable<any> {
    return this.http.post(`${this.nestUrl}/${sessionId}/initialize-solo`, { topic, difficulty });
  }

  // ── AI Service (FastAPI port 8000) ────────
  /**
   * Generate a full question set from the AI service.
   * Returns: { status, questions: [{type, question, options, correct_answer, difficulty, topic, points, time_limit}] }
   */
  /** `num_questions` must be 10, 15, or 20 (AI service contract). */
  generateAiSession(subject: string, difficulty: string, numQuestions = 10, studentId?: string): Observable<any> {
    const body: any = { subject, difficulty, num_questions: numQuestions };
    if (studentId) body.student_id = studentId;
    return this.http.post(`${this.aiUrl}/brainrush/generate-session`, body);
  }

  /**
   * Generate a single question from the AI service.
   */
  generateAiQuestion(subject: string, difficulty: string, topic = 'general', studentId?: string): Observable<any> {
    const body: any = { subject, difficulty, topic, question_type: 'MCQ' };
    if (studentId) body.student_id = studentId;
    return this.http.post(`${this.aiUrl}/brainrush/generate-question`, body);
  }

  /**
   * Get distinct subjects (e.g. "Programmation Procédurale 1") from the course database.
   */
  getSubjects(): Observable<any> {
    return this.http.get(`${this.aiUrl}/brainrush/subjects`);
  }
}
