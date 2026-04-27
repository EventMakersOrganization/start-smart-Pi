import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { VideoGeneratorService, VideoJob } from './video-generator.service';

type UIState = 'idle' | 'loading' | 'done' | 'error';

@Component({
    selector: 'app-video-generator',
    templateUrl: './video-generator.component.html',
    styleUrls: ['./video-generator.component.css'],
})
export class VideoGeneratorComponent implements OnDestroy {
    courseContent = '';
    language: 'en' | 'fr' = 'en';

    state: UIState = 'idle';
    progress = 0;
    currentStep = '';
    job: VideoJob | null = null;

    private pollSub?: Subscription;

    readonly STEPS: Record<string, { label: string; progress: number }> = {
        queued: { label: 'Job queued…', progress: 5 },
        generating_script: { label: 'Generating video script with AI…', progress: 30 },
        rendering_slides: { label: 'Rendering presentation slides…', progress: 60 },
        avatar_video: { label: 'Creating talking avatar (D-ID)…', progress: 85 },
        complete: { label: 'Done!', progress: 100 },
        failed: { label: 'Generation failed', progress: 0 },
    };

    constructor(private svc: VideoGeneratorService) { }

    generate() {
        if (!this.courseContent.trim() || this.state === 'loading') return;

        this.state = 'loading';
        this.progress = 5;
        this.currentStep = 'Submitting job…';
        this.job = null;

        this.svc.generate(this.courseContent, this.language).subscribe({
            next: ({ jobId }) => {
                this.pollSub = this.svc.pollStatus(jobId).subscribe({
                    next: (job) => this._onPoll(job),
                    error: () => {
                        this.state = 'error';
                        this.currentStep = 'Connection to AI service lost.';
                    },
                });
            },
            error: (err) => {
                this.state = 'error';
                this.currentStep = 'Failed to submit job. Is the backend running?';
                console.error(err);
            },
        });
    }

    reset() {
        this.pollSub?.unsubscribe();
        this.state = 'idle';
        this.job = null;
        this.progress = 0;
        this.currentStep = '';
        this.courseContent = '';
    }

    ngOnDestroy() {
        this.pollSub?.unsubscribe();
    }

    private _onPoll(job: VideoJob) {
        this.job = job;

        // Determine progress from step field (not directly in VideoJob — we stored it in the Python side)
        // Since we only get status from the response, estimate from status:
        if (job.status === 'done') {
            this.state = 'done';
            this.progress = 100;
            this.currentStep = 'Video ready!';
        } else if (job.status === 'error') {
            this.state = 'error';
            this.currentStep = job.error || 'An error occurred';
        } else {
            // Animate progress smoothly while processing
            this.state = 'loading';
            if (this.progress < 90) this.progress += 5;
            this.currentStep = 'Processing… please wait';
        }
    }
}
