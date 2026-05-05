import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
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
    private router: Router,
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
          // Fallback: build a minimal learning path from profile to keep UX usable.
          this.adaptiveLearningService.getProfile(this.studentId).subscribe({
            next: (profile) => {
              const weaknesses = Array.isArray(profile?.weaknesses)
                ? profile.weaknesses
                : [];
              const strengths = Array.isArray(profile?.strengths)
                ? profile.strengths
                : [];

              const topics = [...weaknesses, ...strengths].slice(0, 6);
              const inferredSteps = (topics.length ? topics : ['general']).map(
                (topic: string, i: number) => ({
                  order: i + 1,
                  topic,
                  action:
                    i < weaknesses.length
                      ? `Reinforce ${topic} with guided exercises and a quiz.`
                      : `Consolidate ${topic} with mixed practice tasks.`,
                  priority: (i < weaknesses.length ? 'high' : 'medium') as
                    | 'high'
                    | 'medium'
                    | 'low',
                  status: 'pending' as 'pending' | 'in-progress' | 'completed',
                }),
              );

              this.learningPath = {
                currentLevel: profile?.level || 'beginner',
                targetLevel:
                  profile?.level === 'beginner'
                    ? 'intermediate'
                    : profile?.level === 'intermediate'
                      ? 'advanced'
                      : 'advanced',
                estimatedWeeks: Math.max(2, inferredSteps.length + 2),
                steps: inferredSteps,
              };
              this.error = null;
              this.loading = false;
            },
            error: () => {
              this.error = 'Failed to load learning path';
              this.loading = false;
            },
          });
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

  getTopicIcon(topic: string): string {
    const t = topic.toLowerCase();
    if (t.includes('base') || t.includes('donnée') || t.includes('db') || t.includes('sql')) return 'database';
    if (t.includes('code') || t.includes('programmation') || t.includes('js') || t.includes('ts')) return 'code';
    if (t.includes('cloud') || t.includes('azure') || t.includes('aws')) return 'cloud';
    if (t.includes('devops') || t.includes('docker') || t.includes('jenkins')) return 'settings_suggest';
    if (t.includes('web') || t.includes('front') || t.includes('html')) return 'web';
    if (t.includes('back') || t.includes('api') || t.includes('node')) return 'lan';
    if (t.includes('mobile') || t.includes('android') || t.includes('ios')) return 'smartphone';
    if (t.includes('test') || t.includes('qualité') || t.includes('qa')) return 'rule';
    if (t.includes('agile') || t.includes('scrum') || t.includes('projet')) return 'assignment';
    if (t.includes('design') || t.includes('ui') || t.includes('ux')) return 'palette';
    if (t.includes('ai') || t.includes('ml') || t.includes('data')) return 'psychology';
    return 'school';
  }

  getLevelColor(level: string): string {
    const l = level.toLowerCase();
    if (l.includes('beginner')) return 'blue';
    if (l.includes('intermediate')) return 'indigo';
    if (l.includes('advanced')) return 'purple';
    if (l.includes('expert')) return 'fuchsia';
    return 'slate';
  }

  getLevelIcon(level: string): string {
    const l = level.toLowerCase();
    if (l.includes('beginner')) return 'star_rate_half';
    if (l.includes('intermediate')) return 'star';
    if (l.includes('advanced')) return 'military_tech';
    if (l.includes('expert')) return 'diamond';
    return 'school';
  }

  navigateToStep(step: Step): void {
    // Navigate to My Courses and use the topic as a query parameter
    // The My Courses component is configured to automatically open the matching subject.
    this.router.navigate(['/student-dashboard/my-courses'], {
      queryParams: { subject: step.topic },
    });
  }
}
