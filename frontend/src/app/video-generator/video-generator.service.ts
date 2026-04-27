import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, switchMap, takeWhile, share } from 'rxjs';

export interface VideoJob {
    jobId: string;
    status: 'pending' | 'processing' | 'done' | 'error';
    avatarUrl: string | null;
    slideCount: number;
    scriptTitle: string | null;
    error: string | null;
}

@Injectable({ providedIn: 'root' })
export class VideoGeneratorService {
    // IMPORTANT: The backend app has a global "api" prefix set in main.ts
    private readonly BASE = 'http://localhost:3000/api/video-generator';

    constructor(private http: HttpClient) { }

    generate(courseContent: string, language = 'en', presenterUrl?: string): Observable<{ jobId: string; status: string }> {
        return this.http.post<{ jobId: string; status: string }>(`${this.BASE}/generate`, {
            courseContent,
            language,
            presenterUrl: presenterUrl || undefined,
        });
    }

    pollStatus(jobId: string): Observable<VideoJob> {
        return interval(4000).pipe(
            switchMap(() => this.http.get<VideoJob>(`${this.BASE}/status/${jobId}`)),
            takeWhile((job) => job.status === 'pending' || job.status === 'processing', true),
            share(),
        );
    }
}
