import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { AuthService } from '../auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Step {
  order: number;
  topic: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
}

interface LearningPathResponse {
  currentLevel: string;
  targetLevel: string;
  estimatedWeeks: number;
  steps: Step[];
}

@Component({
  selector: 'app-learning-path',
  templateUrl: './learning-path.component.html',
  styleUrls: ['./learning-path.component.css'],
})
export class LearningPathComponent implements OnInit, OnDestroy {
  @Input() studentId: string = '';

  learningPath: LearningPathResponse | null = null;
  loading: boolean = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private adaptiveLearningService: AdaptiveLearningService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    if (!this.studentId) {
      const user = this.authService.getUser();
      this.studentId = user?._id || user?.id || '';
    }

    if (this.studentId) {
      this.loadLearningPath();
    } else {
      this.loading = false;
      this.error = 'Student not found';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLearningPath(): void {
    this.loading = true;
    this.error = null;

    this.adaptiveLearningService
      .getLearningPath(this.studentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.learningPath = data;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading learning path:', err);
          this.error = 'Failed to load learning path';
          this.loading = false;
        },
      });
  }

  getProgressPercentage(): number {
    if (!this.learningPath || this.learningPath.steps.length === 0) {
      return 0;
    }

    const completedSteps = this.learningPath.steps.filter(
      (s) => s.status === 'completed',
    ).length;
    return Math.round((completedSteps / this.learningPath.steps.length) * 100);
  }

  getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'low':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending':
        return 'schedule';
      case 'in-progress':
        return 'play_circle';
      case 'completed':
        return 'check_circle';
      default:
        return 'circle';
    }
  }

  getStepCardClass(step: Step): string {
    if (step.status === 'completed') {
      return 'opacity-60';
    }
    if (step.status === 'in-progress') {
      return 'ring-2 ring-blue-400 shadow-lg shadow-blue-100';
    }
    return '';
  }

  capitalizeTopic(topic: string): string {
    return topic
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  getCompletedCount(): number {
    return (
      this.learningPath?.steps.filter((s) => s.status === 'completed').length ||
      0
    );
  }

  getInProgressCount(): number {
    return (
      this.learningPath?.steps.filter((s) => s.status === 'in-progress')
        .length || 0
    );
  }

  getPendingCount(): number {
    return (
      this.learningPath?.steps.filter((s) => s.status === 'pending').length || 0
    );
  }
}
