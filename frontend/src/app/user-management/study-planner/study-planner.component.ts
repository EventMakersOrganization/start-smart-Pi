import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  AdaptiveLearningService,
  ReviewUrgency,
  SpacedRepetitionResponse,
  SpacedRepetitionSession,
} from '../adaptive-learning.service';

type DayLabel = 'Lun' | 'Mar' | 'Mer' | 'Jeu' | 'Ven' | 'Sam' | 'Dim';

interface PlannerSession {
  topic: string;
  urgency: ReviewUrgency;
  lastScore: number;
  estimatedMinutes: number;
  plannedDate: string;
  recommendedDifficulty: string;
  completed: boolean;
  source: 'spaced' | 'weak-area' | 'learning-path';
}

interface WeekDayColumn {
  label: DayLabel;
  dateKey: string;
  displayDate: string;
  sessions: PlannerSession[];
  totalMinutes: number;
}

@Component({
  selector: 'app-study-planner',
  templateUrl: './study-planner.component.html',
  styleUrls: ['./study-planner.component.css'],
})
export class StudyPlannerComponent implements OnInit, OnChanges {
  @Input() studentId = '';

  readonly dayLabels: DayLabel[] = [
    'Lun',
    'Mar',
    'Mer',
    'Jeu',
    'Ven',
    'Sam',
    'Dim',
  ];
  readonly defaultSessionMinutes = 30;
  readonly maxMinutesPerDay = 120;

  isLoading = false;
  errorMessage = '';

  weekColumns: WeekDayColumn[] = [];
  allSessions: PlannerSession[] = [];
  todaySessions: PlannerSession[] = [];

  stats = {
    overdue: 0,
    dueToday: 0,
    thisWeek: 0,
  };

  private spacedSchedule: SpacedRepetitionSession[] = [];

  constructor(private adaptiveService: AdaptiveLearningService) {}

  ngOnInit(): void {
    this.setupWeekColumns();
    if (this.studentId) {
      this.loadPlannerData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['studentId'] && !changes['studentId'].firstChange) {
      this.setupWeekColumns();
      if (this.studentId) {
        this.loadPlannerData();
      }
    }
  }

  autoPlanWeek(): void {
    const highPriority = this.spacedSchedule
      .filter((s) => s.urgency === 'overdue' || s.urgency === 'due_today')
      .sort(
        (a, b) => this.urgencyOrder(a.urgency) - this.urgencyOrder(b.urgency),
      );

    const carried = this.allSessions.filter(
      (s) => s.urgency !== 'overdue' && s.urgency !== 'due_today',
    );

    const weekDates = this.weekColumns.map((d) => d.dateKey);
    const sessionCounts = new Map<string, number>();
    weekDates.forEach((date) => sessionCounts.set(date, 0));

    const plannedHighPriority: PlannerSession[] = [];
    highPriority.forEach((session, index) => {
      let targetDayIndex = index % weekDates.length;
      let guard = 0;

      while (
        guard < weekDates.length &&
        (sessionCounts.get(weekDates[targetDayIndex]) || 0) *
          this.defaultSessionMinutes >=
          this.maxMinutesPerDay
      ) {
        targetDayIndex = (targetDayIndex + 1) % weekDates.length;
        guard += 1;
      }

      const dateKey = weekDates[targetDayIndex];
      sessionCounts.set(dateKey, (sessionCounts.get(dateKey) || 0) + 1);

      plannedHighPriority.push({
        topic: session.topic,
        urgency: session.urgency,
        lastScore: session.lastScore,
        estimatedMinutes: this.defaultSessionMinutes,
        plannedDate: dateKey,
        recommendedDifficulty: session.recommendedDifficulty,
        completed: this.isCompleted(dateKey, session.topic),
        source: 'spaced',
      });
    });

    this.allSessions = [...plannedHighPriority, ...carried];
    this.refreshCalendarData();
    this.persistPlanner();
  }

  markSessionCompleted(session: PlannerSession): void {
    session.completed = true;
    this.persistCompletion(session.plannedDate, session.topic, true);
    this.refreshCalendarData();
    this.persistPlanner();
  }

  isOverdue(session: PlannerSession): boolean {
    return session.urgency === 'overdue';
  }

  getUrgencyBadgeClass(urgency: ReviewUrgency): string {
    switch (urgency) {
      case 'overdue':
        return 'bg-red-100 text-red-700 border border-red-200';
      case 'due_today':
        return 'bg-amber-100 text-amber-700 border border-amber-200';
      case 'upcoming':
        return 'bg-sky-100 text-sky-700 border border-sky-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  }

  getTopicColor(topic: string): string {
    const palette = [
      '#0ea5e9',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#14b8a6',
      '#f97316',
      '#6366f1',
      '#84cc16',
      '#ec4899',
    ];

    const hash = topic.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return palette[hash % palette.length];
  }

  private loadPlannerData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      spaced: this.adaptiveService.getSpacedRepetitionSchedule(this.studentId),
      weakAreas: this.adaptiveService
        .getWeakAreaRecommendations(this.studentId)
        .pipe(catchError(() => of([]))),
      learningPath: this.adaptiveService
        .getLearningPath(this.studentId)
        .pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ spaced, weakAreas, learningPath }) => {
        this.spacedSchedule = this.normalizeSpacedSchedule(spaced);
        const generatedPlan = this.generateInitialPlan(
          this.spacedSchedule,
          weakAreas,
          learningPath,
        );

        const savedPlan = this.readPersistedPlanner();
        this.allSessions = savedPlan.length > 0 ? savedPlan : generatedPlan;

        this.refreshCalendarData();
        this.persistPlanner();
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage =
          'Impossible de charger le study planner pour le moment.';
        this.isLoading = false;
      },
    });
  }

  private normalizeSpacedSchedule(
    response: SpacedRepetitionResponse | null,
  ): SpacedRepetitionSession[] {
    if (!response || !Array.isArray(response.schedule)) {
      return [];
    }
    return response.schedule;
  }

  private generateInitialPlan(
    schedule: SpacedRepetitionSession[],
    weakAreas: any,
    learningPath: any,
  ): PlannerSession[] {
    const sessions: PlannerSession[] = [];
    const weekDates = this.weekColumns.map((d) => d.dateKey);
    const today = this.startOfDay(new Date());
    const todayKey = this.toDateKey(today);
    const weekEnd = this.startOfDay(new Date(weekDates[weekDates.length - 1]));

    schedule.forEach((item) => {
      const reviewDate = this.startOfDay(new Date(item.nextReviewDate));
      let plannedDate = this.toDateKey(reviewDate);

      if (reviewDate < today || item.urgency === 'overdue') {
        plannedDate = todayKey;
      } else if (reviewDate > weekEnd) {
        plannedDate = weekDates[weekDates.length - 1];
      }

      if (!weekDates.includes(plannedDate)) {
        plannedDate = todayKey;
      }

      sessions.push({
        topic: item.topic,
        urgency: item.urgency,
        lastScore: item.lastScore,
        estimatedMinutes: this.defaultSessionMinutes,
        plannedDate,
        recommendedDifficulty: item.recommendedDifficulty,
        completed: this.isCompleted(plannedDate, item.topic),
        source: 'spaced',
      });
    });

    const weakTopicCandidates = this.extractWeakAreaTopics(weakAreas);
    weakTopicCandidates.forEach((topic) => {
      if (sessions.some((s) => s.topic.toLowerCase() === topic.toLowerCase())) {
        return;
      }

      sessions.push({
        topic,
        urgency: 'upcoming',
        lastScore: 0,
        estimatedMinutes: this.defaultSessionMinutes,
        plannedDate: weekDates[Math.min(2, weekDates.length - 1)],
        recommendedDifficulty: 'beginner',
        completed: this.isCompleted(
          weekDates[Math.min(2, weekDates.length - 1)],
          topic,
        ),
        source: 'weak-area',
      });
    });

    const pathTopics = this.extractLearningPathTopics(learningPath);
    pathTopics.forEach((topic, index) => {
      if (sessions.some((s) => s.topic.toLowerCase() === topic.toLowerCase())) {
        return;
      }

      const dateKey = weekDates[Math.min(3 + index, weekDates.length - 1)];
      sessions.push({
        topic,
        urgency: 'scheduled',
        lastScore: 0,
        estimatedMinutes: this.defaultSessionMinutes,
        plannedDate: dateKey,
        recommendedDifficulty: 'intermediate',
        completed: this.isCompleted(dateKey, topic),
        source: 'learning-path',
      });
    });

    return sessions.sort(
      (a, b) => this.urgencyOrder(a.urgency) - this.urgencyOrder(b.urgency),
    );
  }

  private extractWeakAreaTopics(weakAreas: any): string[] {
    if (!weakAreas) {
      return [];
    }

    if (Array.isArray(weakAreas)) {
      return weakAreas
        .map((item) => item?.topic || item?.name)
        .filter((topic): topic is string => Boolean(topic))
        .slice(0, 4);
    }

    if (Array.isArray(weakAreas.recommendations)) {
      return weakAreas.recommendations
        .map((item: any) => item?.topic || item?.title)
        .filter((topic: string) => Boolean(topic))
        .slice(0, 4);
    }

    return [];
  }

  private extractLearningPathTopics(learningPath: any): string[] {
    if (!learningPath) {
      return [];
    }

    if (Array.isArray(learningPath.path)) {
      return learningPath.path
        .map((item: any) => item?.topic || item?.title)
        .filter((topic: string) => Boolean(topic))
        .slice(0, 3);
    }

    if (Array.isArray(learningPath)) {
      return learningPath
        .map((item: any) => item?.topic || item?.title)
        .filter((topic: string) => Boolean(topic))
        .slice(0, 3);
    }

    return [];
  }

  private refreshCalendarData(): void {
    const byDate = new Map<string, PlannerSession[]>();
    this.weekColumns.forEach((day) => byDate.set(day.dateKey, []));

    this.allSessions.forEach((session) => {
      if (byDate.has(session.plannedDate)) {
        byDate.get(session.plannedDate)!.push(session);
      }
    });

    this.weekColumns = this.weekColumns.map((day) => {
      const sessions = (byDate.get(day.dateKey) || []).sort(
        (a, b) => this.urgencyOrder(a.urgency) - this.urgencyOrder(b.urgency),
      );

      const totalMinutes = sessions.reduce(
        (sum, session) => sum + session.estimatedMinutes,
        0,
      );

      return {
        ...day,
        sessions,
        totalMinutes,
      };
    });

    const todayKey = this.toDateKey(this.startOfDay(new Date()));
    this.todaySessions = (byDate.get(todayKey) || []).sort(
      (a, b) => this.urgencyOrder(a.urgency) - this.urgencyOrder(b.urgency),
    );

    this.stats.overdue = this.allSessions.filter(
      (s) => s.urgency === 'overdue',
    ).length;
    this.stats.dueToday = this.allSessions.filter(
      (s) => s.urgency === 'due_today',
    ).length;
    this.stats.thisWeek = this.allSessions.length;
  }

  private setupWeekColumns(): void {
    const monday = this.getWeekMonday(new Date());
    this.weekColumns = this.dayLabels.map((label, index) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + index);
      return {
        label,
        dateKey: this.toDateKey(current),
        displayDate: current.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
        }),
        sessions: [],
        totalMinutes: 0,
      };
    });
  }

  private getWeekMonday(reference: Date): Date {
    const day = reference.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(reference);
    monday.setDate(reference.getDate() + diff);
    return this.startOfDay(monday);
  }

  private startOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private urgencyOrder(urgency: ReviewUrgency): number {
    if (urgency === 'overdue') return 0;
    if (urgency === 'due_today') return 1;
    if (urgency === 'upcoming') return 2;
    return 3;
  }

  private plannerStorageKey(): string {
    return `study_planner_week_${this.studentId}`;
  }

  private completionStorageKey(): string {
    return `study_planner_completed_${this.studentId}`;
  }

  private readPersistedPlanner(): PlannerSession[] {
    if (!this.studentId) {
      return [];
    }

    try {
      const raw = localStorage.getItem(this.plannerStorageKey());
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((entry: PlannerSession) => ({
        ...entry,
        completed: this.isCompleted(entry.plannedDate, entry.topic),
      }));
    } catch {
      return [];
    }
  }

  private persistPlanner(): void {
    if (!this.studentId) {
      return;
    }

    localStorage.setItem(
      this.plannerStorageKey(),
      JSON.stringify(this.allSessions),
    );
  }

  private isCompleted(dateKey: string, topic: string): boolean {
    try {
      const raw = localStorage.getItem(this.completionStorageKey());
      if (!raw) {
        return false;
      }

      const parsed = JSON.parse(raw) as Record<string, boolean>;
      return Boolean(parsed[this.completionEntryKey(dateKey, topic)]);
    } catch {
      return false;
    }
  }

  private persistCompletion(
    dateKey: string,
    topic: string,
    value: boolean,
  ): void {
    if (!this.studentId) {
      return;
    }

    let store: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(this.completionStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          store = parsed;
        }
      }
    } catch {
      store = {};
    }

    store[this.completionEntryKey(dateKey, topic)] = value;
    localStorage.setItem(this.completionStorageKey(), JSON.stringify(store));
  }

  private completionEntryKey(dateKey: string, topic: string): string {
    return `${dateKey}::${topic.toLowerCase()}`;
  }
}
