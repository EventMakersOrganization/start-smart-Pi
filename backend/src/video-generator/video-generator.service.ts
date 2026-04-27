import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GenerateVideoDto } from './dto/generate-video.dto';

@Injectable()
export class VideoGeneratorService {
    private readonly logger = new Logger(VideoGeneratorService.name);
    private readonly AI_URL = process.env['AI_SERVICE_URL'] || 'http://localhost:8000';

    constructor(private readonly http: HttpService) { }

    /** Submit a video generation job to the Python AI service. */
    async generateVideo(dto: GenerateVideoDto): Promise<{ jobId: string; status: string }> {
        this.logger.log(`[VideoGenerator] Submitting job | lang=${dto.language}`);
        const resp = await firstValueFrom(
            this.http.post(`${this.AI_URL}/video/generate`, {
                course_content: dto.courseContent,
                language: dto.language || 'en',
                presenter_url: dto.presenterUrl || null,
            }),
        );
        return { jobId: resp.data.job_id, status: resp.data.status };
    }

    /** Poll job status from the Python AI service. */
    async getStatus(jobId: string): Promise<{
        jobId: string;
        status: string;
        avatarUrl: string | null;
        slideCount: number;
        scriptTitle: string | null;
        error: string | null;
    }> {
        try {
            const resp = await firstValueFrom(
                this.http.get(`${this.AI_URL}/video/status/${jobId}`),
            );
            const d = resp.data;
            return {
                jobId: d.job_id,
                status: d.status,
                avatarUrl: d.avatar_url ?? null,
                slideCount: d.slide_count ?? 0,
                scriptTitle: d.script_title ?? null,
                error: d.error ?? null,
            };
        } catch (err: any) {
            this.logger.error(`[VideoGenerator] Status poll failed: ${err.message}`);
            return {
                jobId,
                status: 'error',
                avatarUrl: null,
                slideCount: 0,
                scriptTitle: null,
                error: 'Failed to reach AI service',
            };
        }
    }
}
