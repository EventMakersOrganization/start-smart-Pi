import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { apiUrl, socketBaseUrl, publicApiOrigin, assetUrl } from '../../core/api-url';

export interface CodeProblem {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    languageTemplates: any;
    testCases: any[];
}

export interface SoloSession {
    sessionId: string;
    userId: string;
    problems: CodeProblem[];
    currentProblemIndex: number;
    score: number;
    solved: number;
    totalProblems: number;
    startTime: number;
    accuracy: number;
}

@Injectable({
    providedIn: 'root'
})
export class CodebattleService {
    private apiUrl = apiUrl('/api/codebattle');

    private currentSessionSubject = new BehaviorSubject<SoloSession | null>(null);
    currentSession$ = this.currentSessionSubject.asObservable();

    private modeSubject = new BehaviorSubject<'solo' | 'multiplayer' | null>(null);
    mode$ = this.modeSubject.asObservable();

    constructor(private http: HttpClient) { }

    setMode(mode: 'solo' | 'multiplayer') {
        this.modeSubject.next(mode);
    }

    getMode() {
        return this.modeSubject.value;
    }

    startSolo(difficulty: string, count: number, userId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/solo/start`, { difficulty, count, userId });
    }

    setSession(session: SoloSession) {
        this.currentSessionSubject.next(session);
    }

    getSession() {
        return this.currentSessionSubject.value;
    }

    executeSolo(sessionId: string, code: string, language: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/solo/execute`, { sessionId, code, language });
    }

    submitSolo(sessionId: string, code: string, timeLeft: number, language: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/solo/submit`, { sessionId, code, timeLeft, language });
    }

    runSolo(code: string, language: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/solo/run`, { code, language });
    }
}
