import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AuthService } from '../../../../user-management/auth.service';
import {
  AnalyticsService,
  CohortAnalyticsItem,
  InterventionTrackingItem,
  RetentionAnalyticsData,
  RetentionTrendPoint,
  UnifiedStudentAnalytics,
} from '../../services/analytics.service';

interface InstructorStudentRow {
  userId: string;
  name: string;
  riskLevel: string;
  dropoutProbability: number;
  interventionStatus: 'applied' | 'pending';
  engagementScore: number;
  activityFrequency: number;
  completionRate: number;
  lastActivityAt: string;
}

@Component({
  selector: 'app-comprehensive-analytics-dashboard',
  templateUrl: './comprehensive-analytics-dashboard.component.html',
  styleUrls: ['./comprehensive-analytics-dashboard.component.css'],
})
export class ComprehensiveAnalyticsDashboardComponent implements OnInit {
  /** True when this page is rendered inside admin or instructor shell (hide duplicate nav/aside). */
  get embedInParentShell(): boolean {
    const u = this.router.url.split('?')[0];
    return u.includes('/admin/comprehensive-analytics') || u.includes('/instructor/comprehensive-analytics');
  }

  loading = true;
  loadingRows = false;
  error: string | null = null;

  user: {
    first_name?: string;
    last_name?: string;
    avatar?: string;
    role?: string;
  } | null = null;

  retention: RetentionAnalyticsData = {
    totalUsers: 0,
    retainedUsers: 0,
    returningUsers: 0,
    dropoutRate: 0,
    trend: [],
  };

  cohorts: CohortAnalyticsItem[] = [];
  interventions: InterventionTrackingItem[] = [];
  insights: string[] = [];

  instructorRows: InstructorStudentRow[] = [];

  readonly retentionWindowDays = 30;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadComprehensiveAnalytics();
  }

  get displayError(): string {
    if (!this.error) {
      return '';
    }

    const normalized = this.error.toLowerCase();
    if (normalized.includes('session expired') || normalized.includes('401') || normalized.includes('unauthorized')) {
      return 'Session expired. Please log in again.';
    }

    return this.error;
  }

  get isAdmin(): boolean {
    return this.userRole === 'admin';
  }

  get isInstructor(): boolean {
    return this.userRole === 'instructor';
  }

  get totalInterventions(): number {
    return this.interventions.length;
  }

  get pendingInterventions(): number {
    return this.interventions.filter((row) => row.status === 'pending').length;
  }

  get appliedInterventions(): number {
    return this.interventions.filter((row) => row.status === 'applied').length;
  }

  get retentionRate(): number {
    if (this.retention.totalUsers <= 0) {
      return 0;
    }

    return Math.round((this.retention.retainedUsers / this.retention.totalUsers) * 100);
  }

  get averageCohortRisk(): number {
    if (this.cohorts.length === 0) {
      return 0;
    }

    const total = this.cohorts.reduce((sum, item) => sum + Number(item.averageRisk || 0), 0);
    return Number((total / this.cohorts.length).toFixed(2));
  }

  get signupCohorts(): CohortAnalyticsItem[] {
    return this.cohorts.filter((item) => item.cohort.startsWith('signup:')).slice(0, 6);
  }

  get courseCohorts(): CohortAnalyticsItem[] {
    return this.cohorts.filter((item) => item.cohort.startsWith('course:')).slice(0, 6);
  }

  get performanceCohorts(): CohortAnalyticsItem[] {
    return this.cohorts.filter((item) => item.cohort.startsWith('performance:')).slice(0, 6);
  }

  get trendWindow(): RetentionAnalyticsData['trend'] {
    return this.retention.trend.slice(-10);
  }

  get maxTrendActiveUsers(): number {
    if (this.trendWindow.length === 0) {
      return 1;
    }

    return Math.max(...this.trendWindow.map((row) => row.activeUsers), 1);
  }

  get userRole(): string {
    return String(this.user?.role || '').toLowerCase();
  }

  getDisplayName(): string {
    const firstName = this.user?.first_name || '';
    const lastName = this.user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName.length > 0) {
      return fullName;
    }

    return this.isAdmin ? 'Platform Admin' : 'Instructor';
  }

  getInitials(): string {
    const fullName = this.getDisplayName().trim();
    if (fullName.length === 0) {
      return 'NA';
    }

    const parts = fullName.split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  getCohortLabel(cohort: string): string {
    const [type, value] = cohort.split(':');
    if (!type || !value) {
      return cohort;
    }

    if (type === 'signup') {
      return `Signup ${value}`;
    }

    if (type === 'course') {
      return `Course ${value}`;
    }

    if (type === 'performance') {
      return `Performance ${value}`;
    }

    return cohort;
  }

  getRiskBadgeClass(level: string): string {
    const normalized = String(level || '').toLowerCase();

    if (normalized === 'critical') {
      return 'bg-red-700 text-white';
    }

    if (normalized === 'high') {
      return 'bg-red-100 text-red-700';
    }

    if (normalized === 'medium') {
      return 'bg-amber-100 text-amber-700';
    }

    return 'bg-emerald-100 text-emerald-700';
  }

  getBarHeight(value: number): number {
    const ratio = value / this.maxTrendActiveUsers;
    return Math.max(10, Math.min(100, Math.round(ratio * 100)));
  }

  getReturningHeight(activeUsers: number, returningUsers: number): number {
    if (activeUsers <= 0) {
      return 0;
    }

    return Math.max(8, (returningUsers / activeUsers) * 100);
  }

  trackByCohort(_: number, item: CohortAnalyticsItem): string {
    return item.cohort;
  }

  trackByInsight(_: number, item: string): string {
    return item;
  }

  trackByStudent(_: number, item: InstructorStudentRow): string {
    return item.userId;
  }

  trackByTrendPoint(_: number, point: RetentionTrendPoint): string {
    return point.date;
  }

  private loadComprehensiveAnalytics(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      retention: this.analyticsService.getRetentionAnalytics(this.retentionWindowDays).pipe(
        catchError(() =>
          of({
            totalUsers: 0,
            retainedUsers: 0,
            returningUsers: 0,
            dropoutRate: 0,
            trend: [],
          } as RetentionAnalyticsData),
        ),
      ),
      cohorts: this.analyticsService.getCohortAnalytics().pipe(catchError(() => of([] as CohortAnalyticsItem[]))),
      insights: this.analyticsService.getInsights().pipe(catchError(() => of({ insights: [] }))),
      interventions: this.analyticsService.getInterventions().pipe(
        catchError(() => of([] as InterventionTrackingItem[])),
      ),
    }).subscribe({
      next: (payload) => {
        this.retention = payload.retention;
        this.cohorts = payload.cohorts;
        this.insights = payload.insights?.insights || [];
        this.interventions = payload.interventions;

        if (this.isInstructor && this.interventions.length > 0) {
          this.loadInstructorRows(this.interventions.slice(0, 12));
          return;
        }

        this.instructorRows = [];
        this.loading = false;
      },
      error: (err: unknown) => {
        console.error('Failed to load comprehensive analytics', err);
        this.error = 'Session expired or API unavailable. Please sign in again.';
        this.loading = false;
      },
    });
  }

  private loadInstructorRows(interventions: InterventionTrackingItem[]): void {
    this.loadingRows = true;

    const calls = interventions.map((intervention) =>
      this.analyticsService.getUnifiedAnalytics(intervention.userId).pipe(
        map((unified) => ({ intervention, unified })),
        catchError(() => of({ intervention, unified: null as UnifiedStudentAnalytics | null })),
      ),
    );

    forkJoin(calls).subscribe({
      next: (results) => {
        this.instructorRows = results.map(({ intervention, unified }) => ({
          userId: intervention.userId,
          name: intervention.name,
          riskLevel: intervention.riskLevel,
          dropoutProbability: Number((intervention.dropoutProbability * 100).toFixed(0)),
          interventionStatus: intervention.status,
          engagementScore: this.resolveEngagementScore(unified),
          activityFrequency: Number((unified?.activityMetrics?.weeklyActivityFrequency || 0).toFixed(2)),
          completionRate: Number((unified?.performanceMetrics?.completionRate || 0).toFixed(2)),
          lastActivityAt: this.resolveDate(unified?.activityMetrics?.lastActivityAt || null),
        }));

        this.loadingRows = false;
        this.loading = false;
      },
      error: (err: unknown) => {
        console.error('Failed to load instructor unified rows', err);
        this.loadingRows = false;
        this.loading = false;
      },
    });
  }

  private resolveEngagementScore(unified: UnifiedStudentAnalytics | null): number {
    if (!unified) {
      return 0;
    }

    const score =
      unified.activityMetrics.weeklyActivityFrequency * 3 +
      unified.gameMetrics.sessionsPlayed * 2 +
      unified.performanceMetrics.completionRate * 4;

    const bounded = Math.max(0, Math.min(100, score));
    return Number(bounded.toFixed(2));
  }

  private resolveDate(dateValue: string | Date | null): string {
    if (!dateValue) {
      return 'No activity';
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      return 'No activity';
    }

    return parsed.toLocaleDateString();
  }
}
