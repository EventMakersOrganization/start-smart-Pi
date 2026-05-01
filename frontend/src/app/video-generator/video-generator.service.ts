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
    scenes?: any[];
    fullTranscript?: string;
}

@Injectable({ providedIn: 'root' })
export class VideoGeneratorService {
    // IMPORTANT: The backend app has a global "api" prefix set in main.ts
    private readonly BASE = 'http://localhost:3000/api/video-generator';

    constructor(private http: HttpClient) { }

    generate(courseContent: string, language = 'en', presenterUrl?: string, presenterImage?: File, courseFile?: File): Observable<{ jobId: string; status: string }> {
        const fd = new FormData();
        fd.append('courseContent', courseContent || ''); // Match DTO
        fd.append('language', language);
        if (presenterUrl) fd.append('presenterUrl', presenterUrl); // Match DTO
        if (presenterImage) fd.append('presenter_image', presenterImage);
        if (courseFile) fd.append('course_file', courseFile);

        return this.http.post<{ jobId: string; status: string }>(`${this.BASE}/generate`, fd);
    }

    pollStatus(jobId: string): Observable<VideoJob> {
        return interval(4000).pipe(
            switchMap(() => this.http.get<VideoJob>(`${this.BASE}/status/${jobId}`)),
            takeWhile((job) => job.status === 'pending' || job.status === 'processing', true),
            share(),
        );
    }
}
