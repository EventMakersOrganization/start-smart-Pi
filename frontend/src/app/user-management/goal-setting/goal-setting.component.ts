import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import {
  AdaptiveLearningService,
  GoalSettings,
  TargetLevel,
} from '../adaptive-learning.service';
import { AuthService } from '../auth.service';

type GoalStatus = 'on-track' | 'at-risk' | 'achieved';

interface GoalCard {
  key:
    | 'studyHours'
    | 'targetScore'
    | 'exercisesPerDay'
    | 'targetLevel'
    | 'deadline';
  title: string;
  icon: string;
  currentLabel: string;
  targetLabel: string;
  progress: number;
  status: GoalStatus;
}

@Component({
  selector: 'app-goal-setting',
  templateUrl: './goal-setting.component.html',
})
export class GoalSettingComponent implements OnInit {
  @Input() studentId: string | null = null;

  loading = false;
  saving = false;
  performances: any[] = [];
  topics: string[] = ['general'];
  goalCards: GoalCard[] = [];

  metrics = {
    weeklyStudyHours: 0,
    avgExercisesPerDay: 0,
    overallAverageScore: 0,
    currentLevel: 'beginner' as TargetLevel,
    averageScoreByTopic: {} as Record<string, number>,
  };

  goalForm = this.fb.group({
    studyHoursPerWeek: [
      8,
      [Validators.required, Validators.min(1), Validators.max(20)],
    ],
    targetTopic: ['general', [Validators.required]],
    targetScorePerTopic: [
      75,
      [Validators.required, Validators.min(50), Validators.max(100)],
    ],
    exercisesPerDay: [
      2,
      [Validators.required, Validators.min(1), Validators.max(10)],
    ],
    targetLevel: ['intermediate' as TargetLevel, [Validators.required]],
    deadline: ['', [Validators.required]],
  });

  constructor(
    private fb: FormBuilder,
    private adaptiveService: AdaptiveLearningService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.studentId = this.studentId || this.resolveStudentId();
    this.initializeFormFromStorage();
    if (!this.studentId) {
      this.rebuildGoalCards();
      return;
    }

    this.loadPerformances();

    this.goalForm.valueChanges.subscribe(() => {
      this.rebuildGoalCards();
    });
  }

  saveGoals(): void {
    if (!this.studentId) return;
    if (this.goalForm.invalid) {
      this.goalForm.markAllAsTouched();
      return;
    }

    this.saving = true;

    const existing = this.adaptiveService.getGoalSettings(this.studentId);
    const payload: GoalSettings = {
      studyHoursPerWeek: Number(this.goalForm.value.studyHoursPerWeek || 8),
      targetTopic: String(this.goalForm.value.targetTopic || 'general'),
      targetScorePerTopic: Number(
        this.goalForm.value.targetScorePerTopic || 75,
      ),
      exercisesPerDay: Number(this.goalForm.value.exercisesPerDay || 2),
      targetLevel: (this.goalForm.value.targetLevel ||
        'intermediate') as TargetLevel,
      deadline: String(this.goalForm.value.deadline || ''),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    this.adaptiveService.saveGoalSettings(this.studentId, payload);
    this.saving = false;
    this.rebuildGoalCards();
  }

  resetGoals(): void {
    if (!this.studentId) return;

    this.adaptiveService.resetGoalSettings(this.studentId);
    this.goalForm.patchValue(this.getDefaultGoalValues());
    this.rebuildGoalCards();
  }

  getProgressBarClass(status: GoalStatus): string {
    if (status === 'achieved') return 'bg-emerald-500';
    if (status === 'on-track') return 'bg-blue-500';
    return 'bg-orange-500';
  }

  getStatusPillClass(status: GoalStatus): string {
    if (status === 'achieved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'on-track') return 'bg-blue-100 text-blue-700';
    return 'bg-orange-100 text-orange-700';
  }

  trackByGoal(_: number, card: GoalCard): string {
    return card.key;
  }

  private initializeFormFromStorage(): void {
    if (!this.studentId) {
      this.goalForm.patchValue(this.getDefaultGoalValues());
      return;
    }

    const saved = this.adaptiveService.getGoalSettings(this.studentId);
    if (saved) {
      this.goalForm.patchValue({
        studyHoursPerWeek: saved.studyHoursPerWeek,
        targetTopic: saved.targetTopic,
        targetScorePerTopic: saved.targetScorePerTopic,
        exercisesPerDay: saved.exercisesPerDay,
        targetLevel: saved.targetLevel,
        deadline: saved.deadline,
      });
      return;
    }

    this.goalForm.patchValue(this.getDefaultGoalValues());
  }

  private loadPerformances(): void {
    if (!this.studentId) return;

    this.loading = true;
    this.adaptiveService.getPerformances(this.studentId).subscribe({
      next: (items) => {
        this.performances = Array.isArray(items) ? items : [];
        this.buildMetrics();
        this.rebuildGoalCards();
        this.loading = false;
      },
      error: () => {
        this.performances = [];
        this.buildMetrics();
        this.rebuildGoalCards();
        this.loading = false;
      },
    });
  }

  private buildMetrics(): void {
    const last7Days = this.performances.filter((p: any) => {
      const date = new Date(p.attemptDate).getTime();
      return (
        !Number.isNaN(date) && date >= Date.now() - 7 * 24 * 60 * 60 * 1000
      );
    });

    const weeklyMinutes = last7Days.reduce(
      (sum: number, p: any) => sum + (Number(p.timeSpent) || 0),
      0,
    );

    const scoreByTopic: Record<string, { total: number; count: number }> = {};
    this.performances.forEach((p: any) => {
      const topic = String(p.topic || 'general').trim() || 'general';
      if (!scoreByTopic[topic]) {
        scoreByTopic[topic] = { total: 0, count: 0 };
      }
      scoreByTopic[topic].total += Number(p.score) || 0;
      scoreByTopic[topic].count++;
    });

    const averageScoreByTopic: Record<string, number> = {};
    Object.keys(scoreByTopic).forEach((topic) => {
      const item = scoreByTopic[topic];
      averageScoreByTopic[topic] = item.count > 0 ? item.total / item.count : 0;
    });

    const allScores = this.performances.map((p: any) => Number(p.score) || 0);
    const overallAverageScore =
      allScores.length > 0
        ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
        : 0;

    this.metrics = {
      weeklyStudyHours: Math.round((weeklyMinutes / 60) * 10) / 10,
      avgExercisesPerDay: Math.round((last7Days.length / 7) * 10) / 10,
      overallAverageScore: Math.round(overallAverageScore * 10) / 10,
      currentLevel: this.estimateLevel(overallAverageScore),
      averageScoreByTopic,
    };

    this.topics = Object.keys(averageScoreByTopic).length
      ? Object.keys(averageScoreByTopic).sort((a, b) => a.localeCompare(b))
      : ['general'];

    const selectedTopic = String(this.goalForm.value.targetTopic || 'general');
    if (!this.topics.includes(selectedTopic)) {
      this.goalForm.patchValue(
        { targetTopic: this.topics[0] },
        { emitEvent: false },
      );
    }
  }

  private rebuildGoalCards(): void {
    const targetStudyHours = Number(this.goalForm.value.studyHoursPerWeek || 1);
    const targetScore = Number(this.goalForm.value.targetScorePerTopic || 50);
    const targetExercises = Number(this.goalForm.value.exercisesPerDay || 1);
    const targetTopic = String(this.goalForm.value.targetTopic || 'general');
    const targetLevel = (this.goalForm.value.targetLevel ||
      'beginner') as TargetLevel;
    const deadline = String(this.goalForm.value.deadline || '');

    const currentTopicScore =
      this.metrics.averageScoreByTopic[targetTopic] || 0;
    const levelProgress = this.levelProgress(
      this.metrics.currentLevel,
      targetLevel,
    );

    const studyHoursProgress = this.progressRatio(
      this.metrics.weeklyStudyHours,
      targetStudyHours,
    );
    const targetScoreProgress = this.progressRatio(
      currentTopicScore,
      targetScore,
    );
    const exercisesProgress = this.progressRatio(
      this.metrics.avgExercisesPerDay,
      targetExercises,
    );

    const deadlineData = this.deadlineProgress(deadline);

    this.goalCards = [
      {
        key: 'studyHours',
        title: 'Study Hours / Week',
        icon: 'schedule',
        currentLabel: `${this.metrics.weeklyStudyHours.toFixed(1)}h`,
        targetLabel: `${targetStudyHours}h`,
        progress: studyHoursProgress,
        status: this.progressStatus(studyHoursProgress),
      },
      {
        key: 'targetScore',
        title: `Target Score (${targetTopic})`,
        icon: 'track_changes',
        currentLabel: `${Math.round(currentTopicScore)}%`,
        targetLabel: `${targetScore}%`,
        progress: targetScoreProgress,
        status: this.progressStatus(targetScoreProgress),
      },
      {
        key: 'exercisesPerDay',
        title: 'Exercises / Day',
        icon: 'fitness_center',
        currentLabel: `${this.metrics.avgExercisesPerDay.toFixed(1)} / day`,
        targetLabel: `${targetExercises} / day`,
        progress: exercisesProgress,
        status: this.progressStatus(exercisesProgress),
      },
      {
        key: 'targetLevel',
        title: 'Target Level',
        icon: 'military_tech',
        currentLabel: this.metrics.currentLevel,
        targetLabel: targetLevel,
        progress: levelProgress,
        status: this.progressStatus(levelProgress),
      },
      {
        key: 'deadline',
        title: 'Deadline',
        icon: 'event',
        currentLabel: deadlineData.currentLabel,
        targetLabel: deadlineData.targetLabel,
        progress: deadlineData.progress,
        status: deadlineData.status,
      },
    ];
  }

  private progressRatio(current: number, target: number): number {
    if (target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  }

  private progressStatus(progress: number): GoalStatus {
    if (progress >= 100) return 'achieved';
    if (progress >= 70) return 'on-track';
    return 'at-risk';
  }

  private estimateLevel(avgScore: number): TargetLevel {
    if (avgScore >= 70) return 'advanced';
    if (avgScore >= 40) return 'intermediate';
    return 'beginner';
  }

  private levelProgress(current: TargetLevel, target: TargetLevel): number {
    const order: Record<TargetLevel, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };

    const currentValue = order[current];
    const targetValue = order[target];
    return Math.max(
      0,
      Math.min(100, Math.round((currentValue / targetValue) * 100)),
    );
  }

  private deadlineProgress(deadline: string): {
    progress: number;
    status: GoalStatus;
    currentLabel: string;
    targetLabel: string;
  } {
    if (!deadline) {
      return {
        progress: 0,
        status: 'at-risk',
        currentLabel: 'No deadline set',
        targetLabel: 'Pick a date',
      };
    }

    const saved = this.studentId
      ? this.adaptiveService.getGoalSettings(this.studentId)
      : null;
    const createdAt = saved?.createdAt || new Date().toISOString();

    const start = new Date(createdAt).getTime();
    const end = new Date(deadline).getTime();
    const now = Date.now();

    if (Number.isNaN(end)) {
      return {
        progress: 0,
        status: 'at-risk',
        currentLabel: 'Invalid date',
        targetLabel: 'Set a valid deadline',
      };
    }

    if (now >= end) {
      return {
        progress: 100,
        status: 'at-risk',
        currentLabel: 'Deadline reached',
        targetLabel: new Date(deadline).toLocaleDateString(),
      };
    }

    const total = Math.max(1, end - start);
    const elapsed = Math.max(0, now - start);
    const progress = Math.max(
      0,
      Math.min(100, Math.round((elapsed / total) * 100)),
    );
    const daysRemaining = Math.max(
      0,
      Math.ceil((end - now) / (1000 * 60 * 60 * 24)),
    );

    return {
      progress,
      status: daysRemaining > 7 ? 'on-track' : 'at-risk',
      currentLabel: `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} left`,
      targetLabel: new Date(deadline).toLocaleDateString(),
    };
  }

  private getDefaultGoalValues(): Partial<GoalSettings> {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    return {
      studyHoursPerWeek: 8,
      targetTopic: 'general',
      targetScorePerTopic: 75,
      exercisesPerDay: 2,
      targetLevel: 'intermediate',
      deadline: nextMonth.toISOString().slice(0, 10),
    };
  }

  private resolveStudentId(): string | null {
    const user = this.authService.getUser();
    return user?._id || user?.id || null;
  }
}
