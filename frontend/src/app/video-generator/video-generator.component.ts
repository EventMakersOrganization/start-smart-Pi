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
    presenterUrl = '';
    selectedFile: File | null = null; // Professor portrait
    selectedCourseFile: File | null = null; // Course document (PDF/DOCX/TXT)

    state: UIState = 'idle';
    progress = 0;
    currentStep = '';
    job: VideoJob | null = null;
    currentSlideIdx = 0;

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

    onFileSelected(event: any) {
        this.selectedFile = event.target.files[0];
    }

    onCourseFileSelected(event: any) {
        this.selectedCourseFile = event.target.files[0];
    }

    generate() {
        if (!this.courseContent.trim() && !this.selectedCourseFile) return;
        if (this.state === 'loading') return;

        this.state = 'loading';
        this.progress = 5;
        this.currentStep = 'Submitting job…';
        this.job = null;

        this.svc.generate(this.courseContent, this.language, this.presenterUrl, this.selectedFile || undefined, this.selectedCourseFile || undefined).subscribe({
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
        this.presenterUrl = '';
        this.selectedFile = null;
        this.selectedCourseFile = null;
        this.currentSlideIdx = 0;
    }

    nextSlide() {
        if (this.job && this.currentSlideIdx < this.job.slideCount - 1) {
            this.currentSlideIdx++;
        }
    }

    prevSlide() {
        if (this.currentSlideIdx > 0) {
            this.currentSlideIdx--;
        }
    }

    getSlideUrl(index: number): string {
        if (!this.job) return '';
        // Point to the Python service static mount
        return `http://localhost:8000/static/video/${this.job.jobId}/slides/slide_${(index + 1).toString().padStart(2, '0')}.png`;
    }

    ngOnDestroy() {
        this.pollSub?.unsubscribe();
    }

    onTimeUpdate(event: Event) {
        const video = event.target as HTMLVideoElement;
        const currentTime = video.currentTime;

        if (!this.job || !this.job.scenes) return;

        let accumulatedTime = 0;
        for (let i = 0; i < this.job.scenes.length; i++) {
            const scene = this.job.scenes[i];
            const duration = scene.duration_estimate_seconds || 20; // fallback

            if (currentTime >= accumulatedTime && currentTime < (accumulatedTime + duration)) {
                this.currentSlideIdx = i;
                break;
            }
            accumulatedTime += duration;
        }
    }

    private _onPoll(job: VideoJob) {
        this.job = job;

        if (job.status === 'done') {
            this.state = 'done';
            this.progress = 100;
            this.currentStep = 'Video ready!';
        } else if (job.status === 'error') {
            this.state = 'error';
            this.currentStep = job.error || 'An error occurred';
        } else {
            this.state = 'loading';
            if (this.progress < 90) this.progress += 5;
            this.currentStep = 'Processing… please wait';
        }
    }
}
