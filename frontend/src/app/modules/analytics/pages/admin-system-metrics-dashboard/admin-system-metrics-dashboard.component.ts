import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, catchError, of, Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../user-management/auth.service';
import {
  ActivityByHourResponse,
  ActivityChannelSplitResponse,
  AiEventFeedItem,
  AiServiceMonitorSnapshot,
  AnalyticsService,
  DashboardData,
  RecentAlertItem,
  StudentRiskListItem,
} from '../../services/analytics.service';
import { ExportService } from '../../services/export.service';

interface KpiCardVm {
  label: string;
  value: string;
  icon: string;
  iconBgClass: string;
  iconTextClass: string;
  trendIcon: string;
  trendValue: string;
  badgeClass: string;
}

@Component({
  selector: 'app-admin-system-metrics-dashboard',
  templateUrl: './admin-system-metrics-dashboard.component.html',
  styleUrls: ['./admin-system-metrics-dashboard.component.css'],
})
export class AdminSystemMetricsDashboardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  user = this.authService.getUser();

  loading = true;
  loadError: string | null = null;

  /** When hosted under `/admin/system-metrics`, hide duplicate chrome (parent admin shell provides nav). */
  get embedInAdminShell(): boolean {
    return this.router.url.includes('/admin/system-metrics');
  }

  dashboardData: DashboardData = {
    totalUsers: 0,
    activeUsers: 0,
    highRiskUsers: 0,
    totalAlerts: 0,
    totalUsersDeltaPct: null,
    activeUsersDeltaPct: null,
    highRiskUsersDeltaPct: null,
    totalAlertsDeltaPct: null,
    averageRiskScore: 0,
    aiDecisionsToday: 0,
  };

  kpiCards: KpiCardVm[] = [];

  activityHour: ActivityByHourResponse | null = null;
  channelSplit: ActivityChannelSplitResponse | null = null;
  aiMonitor: AiServiceMonitorSnapshot | null = null;
  feedEvents: AiEventFeedItem[] = [];

  recentAlerts: RecentAlertItem[] = [];
  studentRiskList: StudentRiskListItem[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private analyticsService: AnalyticsService,
    private exportService: ExportService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadDashboard();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasActivityDrill(): boolean {
    return !!this.route.snapshot.queryParamMap.get('activityStart');
  }

  get activitySelectedIndex(): number | null {
    const raw = this.route.snapshot.queryParamMap.get('activityIndex');
    if (raw == null) {
      return null;
    }
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }

  formatDelta(delta: number | null): string {
    if (delta == null) {
      return '—';
    }
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta}% vs prior`;
  }

  onActivityBucketClick(ev: { index: number; hourLabel: string }): void {
    const ah = this.activityHour;
    if (!ah?.windowStartUtc) {
      return;
    }
    const base = new Date(ah.windowStartUtc).getTime();
    const start = new Date(base + ev.index * 3600000);
    const end = new Date(start.getTime() + 3600000);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        activityStart: start.toISOString(),
        activityEnd: end.toISOString(),
        activityIndex: ev.index,
      },
      queryParamsHandling: 'merge',
    });
  }

  clearActivityDrill(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        activityStart: null,
        activityEnd: null,
        activityIndex: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  getAdminName(): string {
    const firstName = this.user?.first_name || '';
    const lastName = this.user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Admin profile';
  }

  logout(): void {
    this.authService.logout();
  }

  /** Max activity count in the hourly series (for bar normalization). */
  get activityMax(): number {
    const a = this.activityHour?.activityCounts || [];
    return Math.max(1, ...a);
  }

  barHeightPercent(count: number, series: 'activity' | 'session'): number {
    const max = this.activityMax;
    const raw = series === 'activity' ? count : Math.min(count, max);
    return Math.round((raw / max) * 100);
  }

  eventIcon(type: string): string {
    switch (type) {
      case 'explainability':
        return 'psychology';
      case 'alert':
        return 'warning';
      case 'risk':
        return 'balance';
      default:
        return 'timeline';
    }
  }

  eventBadgeClass(type: string): string {
    switch (type) {
      case 'explainability':
        return 'bg-violet-100 text-violet-800';
      case 'alert':
        return 'bg-amber-100 text-amber-800';
      case 'risk':
        return 'bg-sky-100 text-sky-800';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  formatRelativeTime(iso: string): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) {
      return '';
    }
    const diff = Date.now() - t;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) {
      return `${sec}s ago`;
    }
    const min = Math.floor(sec / 60);
    if (min < 60) {
      return `${min}m ago`;
    }
    const hr = Math.floor(min / 60);
    if (hr < 48) {
      return `${hr}h ago`;
    }
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
  }

  exportKpiCsv(): void {
    this.exportService.exportToCSV(this.getKpiRows(), this.getFilename('admin-kpi'));
  }

  exportKpiExcel(): void {
    this.exportService.exportToExcel(this.getKpiRows(), this.getFilename('admin-kpi'));
  }

  exportStudentRiskCsv(): void {
    this.exportService.exportToCSV(
      this.getStudentRiskRows(),
      this.getFilename('admin-student-risk-list'),
    );
  }

  exportStudentRiskExcel(): void {
    this.exportService.exportToExcel(
      this.getStudentRiskRows(),
      this.getFilename('admin-student-risk-list'),
    );
  }

  exportAlertsCsv(): void {
    this.exportService.exportToCSV(this.getAlertRows(), this.getFilename('admin-alerts'));
  }

  exportAlertsExcel(): void {
    this.exportService.exportToExcel(this.getAlertRows(), this.getFilename('admin-alerts'));
  }

  private loadDashboard(): void {
    this.loading = true;
    this.loadError = null;

    const q = this.route.snapshot.queryParamMap;
    const aStart = q.get('activityStart') || undefined;
    const aEnd = q.get('activityEnd') || undefined;
    const hourStart = aStart && aEnd ? aStart : undefined;
    const hourEnd = aStart && aEnd ? aEnd : undefined;

    forkJoin({
      dash: this.analyticsService.getDashboardData(),
      hour: this.analyticsService.getActivityByHour(hourStart, hourEnd).pipe(catchError(() => of(null))),
      channel: this.analyticsService.getActivityChannelSplit().pipe(catchError(() => of(null))),
      monitor: this.analyticsService.getAiServiceMonitor().pipe(
        catchError(() => of({ ok: false, error: 'Unavailable' } as AiServiceMonitorSnapshot)),
      ),
      feed: this.analyticsService.getAiEventsFeed(20).pipe(catchError(() => of([]))),
      risks: this.analyticsService.getStudentRiskList().pipe(catchError(() => of([]))),
      alerts: this.analyticsService.getRecentAlerts(50).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ dash, hour, channel, monitor, feed, risks, alerts }) => {
        this.dashboardData = dash;
        this.kpiCards = this.buildKpiCards(dash);
        this.activityHour = hour;
        this.channelSplit = channel;
        this.aiMonitor = monitor;
        this.feedEvents = feed;
        this.studentRiskList = risks;
        this.recentAlerts = alerts;
        this.loading = false;
      },
      error: () => {
        this.loadError = 'Failed to load dashboard. Check your session and try again.';
        this.loading = false;
      },
    });
  }

  private buildKpiCards(d: DashboardData): KpiCardVm[] {
    const fmt = (n: number) => n.toLocaleString();
    const trend = (delta: number | null, invertBad?: boolean): { icon: string; text: string; badge: string } => {
      if (delta == null) {
        return {
          icon: 'remove',
          text: 'No prior window',
          badge: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
        };
      }
      const sign = delta > 0 ? '+' : '';
      const good = invertBad ? delta < 0 : delta > 0;
      const icon = delta > 0 ? 'trending_up' : delta < 0 ? 'trending_down' : 'remove';
      return {
        icon,
        text: `${sign}${delta}% vs prior`,
        badge: good
          ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30'
          : 'text-amber-800 bg-amber-50 dark:bg-amber-900/30',
      };
    };

    const tUsers = trend(d.totalUsersDeltaPct, false);
    const tActive = trend(d.activeUsersDeltaPct, false);
    const tRisk = trend(d.highRiskUsersDeltaPct, true);
    const tAlerts = trend(d.totalAlertsDeltaPct, true);

    return [
      {
        label: 'Total Users',
        value: fmt(d.totalUsers),
        icon: 'groups',
        iconBgClass: 'bg-blue-50',
        iconTextClass: 'text-blue-700',
        trendIcon: tUsers.icon,
        trendValue: tUsers.text,
        badgeClass: tUsers.badge,
      },
      {
        label: 'Active Users',
        value: fmt(d.activeUsers),
        icon: 'bolt',
        iconBgClass: 'bg-emerald-50',
        iconTextClass: 'text-secondary',
        trendIcon: tActive.icon,
        trendValue: tActive.text,
        badgeClass: tActive.badge,
      },
      {
        label: 'High Risk Users',
        value: fmt(d.highRiskUsers),
        icon: 'warning',
        iconBgClass: 'bg-red-50',
        iconTextClass: 'text-error',
        trendIcon: tRisk.icon,
        trendValue: tRisk.text,
        badgeClass: tRisk.badge,
      },
      {
        label: 'Total Alerts',
        value: fmt(d.totalAlerts),
        icon: 'notifications_active',
        iconBgClass: 'bg-purple-50',
        iconTextClass: 'text-tertiary',
        trendIcon: tAlerts.icon,
        trendValue: tAlerts.text,
        badgeClass: tAlerts.badge,
      },
    ];
  }

  private getKpiRows(): Array<Record<string, string | number>> {
    return [
      { metric: 'Total Users', value: this.dashboardData.totalUsers },
      { metric: 'Active Users', value: this.dashboardData.activeUsers },
      { metric: 'High Risk Users', value: this.dashboardData.highRiskUsers },
      { metric: 'Total Alerts', value: this.dashboardData.totalAlerts },
    ];
  }

  private getStudentRiskRows(): Array<Record<string, string | number>> {
    return this.studentRiskList.map((student) => ({
      userId: student.userId,
      name: student.name,
      email: student.email,
      riskScore: student.riskScore,
      riskLevel: student.riskLevel,
      alertStatus: student.alertStatus,
    }));
  }

  private getAlertRows(): Array<Record<string, string | boolean>> {
    return this.recentAlerts.map((alert) => ({
      alertId: alert._id || '',
      userId: this.resolveAlertUserId(alert),
      riskLevel: String(alert.riskLevel || alert.severity || 'unknown').toLowerCase(),
      message: alert.message,
      resolved: Boolean(alert.resolved),
      timestamp: this.formatDateTime(alert.timestamp || alert.createdAt),
    }));
  }

  private resolveAlertUserId(alert: RecentAlertItem): string {
    return alert.userId || alert.student?._id || '-';
  }

  private formatDateTime(value?: string | Date): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString();
  }

  private getFilename(prefix: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `${prefix}-${date}`;
  }

  trackByKpiLabel(_: number, item: KpiCardVm): string {
    return item.label;
  }

  trackByHourIndex(index: number, _item: string | number): number {
    return index;
  }

  trackByFeedEvent(_: number, item: AiEventFeedItem): string {
    return item.id;
  }
}
