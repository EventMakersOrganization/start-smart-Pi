import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private readonly API_URL = 'http://localhost:3000/api';
  private readonly AI_URL = 'http://localhost:3000/api/ai';

  private readonly loadingSearchSubject = new BehaviorSubject<boolean>(false);
  private readonly loadingRecommendationsSubject = new BehaviorSubject<boolean>(false);

  /** Optional loading state streams if components want to bind directly */
  loadingSearch$ = this.loadingSearchSubject.asObservable();
  loadingRecommendations$ = this.loadingRecommendationsSubject.asObservable();

  constructor(private http: HttpClient) { }

  private handleError(operation: string) {
    return (error: HttpErrorResponse) => {
      const message =
        error?.error?.message ||
        error?.error?.detail ||
        error?.message ||
        `Request failed: ${operation}`;
      console.error(`[AiService] ${operation} failed:`, error);
      return throwError(() => new Error(message));
    };
  }

  searchCourses(query: string, nResults: number = 5): Observable<any> {
    this.loadingSearchSubject.next(true);
    return this.http
      .post(`${this.AI_URL}/search`, { query, nResults })
      .pipe(
        finalize(() => this.loadingSearchSubject.next(false)),
        catchError(this.handleError('searchCourses')),
      );
  }

  generateQuestion(subject: string, difficulty: string, topic: string): Observable<any> {
    return this.http
      .post(`${this.AI_URL}/generate-question`, { subject, difficulty, topic })
      .pipe(catchError(this.handleError('generateQuestion')));
  }

  generateLevelTest(
    subject: string,
    numQuestions: number = 5,
    difficulty: string = 'medium',
  ): Observable<any> {
    // NOTE: NestJS proxy expects numQuestions (not num_questions)
    return this.http
      .post(`${this.AI_URL}/generate-test`, { subject, numQuestions, difficulty })
      .pipe(catchError(this.handleError('generateLevelTest')));
  }

  getPersonalizedRecommendations(userId: string): Observable<any> {
    this.loadingRecommendationsSubject.next(true);
    return this.http
      .get(`${this.API_URL}/recommendations/${userId}`)
      .pipe(
        finalize(() => this.loadingRecommendationsSubject.next(false)),
        catchError(this.handleError('getPersonalizedRecommendations')),
      );
  }

  getCourses(): Observable<any> {
    return this.http
      .get(`${this.API_URL}/courses`)
      .pipe(catchError(this.handleError('getCourses')));
  }

  searchCoursesBasic(query: string): Observable<any> {
    return this.http
      .get(`${this.API_URL}/courses?search=${encodeURIComponent(query)}`)
      .pipe(catchError(this.handleError('searchCoursesBasic')));
  }
}
