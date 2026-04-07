import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import { AuthService } from '../../../../user-management/auth.service';
import {
  AnalyticsService,
  AlertTrendData,
  DashboardData,
  RecentAlertItem,
  RiskDistributionData,
  StudentRiskListItem,
} from '../../services/analytics.service';
import { ExportService } from '../../services/export.service';

@Component({
  selector: 'app-analytics-instructor-dashboard',
  templateUrl: './instructor-dashboard.component.html',
  styleUrls: ['./instructor-dashboard.component.css'],
})
export class AnalyticsInstructorDashboardComponent implements OnInit {
  loading = true;
  error: string | null = null;
  user: any = null;

  dashboard: DashboardData = {
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

  riskDistribution: RiskDistributionData = {
    low: 0,
    medium: 0,
    high: 0,
    lowPercentage: 0,
    mediumPercentage: 0,
    highPercentage: 0,
    total: 0,
  };

  alertTrend: AlertTrendData = {
    labels: [],
    values: [],
  };

  recentAlerts: RecentAlertItem[] = [];
  studentRiskList: StudentRiskListItem[] = [];

  constructor(
    private analyticsService: AnalyticsService,
    private authService: AuthService,
    private router: Router,
    private exportService: ExportService,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadInstructorDashboard();
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

  getInstructorName(): string {
    const firstName = this.user?.first_name || '';
    const lastName = this.user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Instructor';
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  loadInstructorDashboard(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      dashboard: this.analyticsService.getDashboardData().pipe(
        catchError(() =>
          of({
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
          } as DashboardData),
        ),
      ),
      recentAlerts: this.analyticsService.getRecentAlerts(10).pipe(catchError(() => of([] as RecentAlertItem[]))),
      riskDistribution: this.analyticsService.getRiskDistribution().pipe(
        catchError(() =>
          of({
            low: 0,
            medium: 0,
            high: 0,
            lowPercentage: 0,
            mediumPercentage: 0,
            highPercentage: 0,
            total: 0,
          } as RiskDistributionData),
        ),
      ),
      alertTrend: this.analyticsService.getAlertTrends(7).pipe(
        catchError(() =>
          of({
            labels: [],
            values: [],
          } as AlertTrendData),
        ),
      ),
      studentRiskList: this.analyticsService.getStudentRiskList().pipe(catchError(() => of([] as StudentRiskListItem[]))),
    }).subscribe({
      next: (data) => {
        this.dashboard = data.dashboard;
        this.recentAlerts = data.recentAlerts;
        this.riskDistribution = data.riskDistribution;
        this.alertTrend = data.alertTrend;
        this.studentRiskList = data.studentRiskList;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load instructor dashboard data:', err);
        this.error = 'Session expired or API unavailable. Please sign in again.';
        this.loading = false;
      },
    });
  }

  resolveAlertUserId(alert: RecentAlertItem): string {
    return alert.userId || alert.student?._id || '-';
  }

  resolveRiskLevel(alert: RecentAlertItem): string {
    return String(alert.riskLevel || alert.severity || 'unknown').toLowerCase();
  }

  formatTimestamp(alert: RecentAlertItem): string {
    const dateValue = alert.timestamp || alert.createdAt;
    if (!dateValue) {
      return '-';
    }

    return new Date(dateValue).toLocaleString();
  }

  getTrendBarHeight(value: number): number {
    const source = this.alertTrend.values && this.alertTrend.values.length > 0
      ? this.alertTrend.values
      : [1];
    const maxValue = Math.max(...source, 1);
    const normalized = (value / maxValue) * 100;
    return Math.max(10, Math.min(100, normalized));
  }

  getOverallHealth(): number {
    return Math.max(0, Math.min(100, 100 - this.riskDistribution.highPercentage));
  }

  getRiskDistributionGradient(): string {
    const low = Math.max(0, this.riskDistribution.lowPercentage);
    const medium = Math.max(0, this.riskDistribution.mediumPercentage);
    const high = Math.max(0, this.riskDistribution.highPercentage);

    const lowEnd = low;
    const mediumEnd = low + medium;
    const highEnd = low + medium + high;

    return `conic-gradient(
      #006c49 0% ${lowEnd}%,
      #40009c ${lowEnd}% ${mediumEnd}%,
      #ba1a1a ${mediumEnd}% ${highEnd}%,
      #e5eeff ${highEnd}% 100%
    )`;
  }

  exportKpiCsv(): void {
    this.exportService.exportToCSV(this.getKpiRows(), this.getFilename('instructor-kpi'));
  }

  exportKpiExcel(): void {
    this.exportService.exportToExcel(this.getKpiRows(), this.getFilename('instructor-kpi'));
  }

  exportStudentRiskCsv(): void {
    this.exportService.exportToCSV(
      this.getStudentRiskRows(),
      this.getFilename('instructor-student-risk-list'),
    );
  }

  exportStudentRiskExcel(): void {
    this.exportService.exportToExcel(
      this.getStudentRiskRows(),
      this.getFilename('instructor-student-risk-list'),
    );
  }

  exportAlertsCsv(): void {
    this.exportService.exportToCSV(this.getAlertRows(), this.getFilename('instructor-alerts'));
  }

  exportAlertsExcel(): void {
    this.exportService.exportToExcel(this.getAlertRows(), this.getFilename('instructor-alerts'));
  }

  private getKpiRows(): Array<Record<string, string | number>> {
    return [
      {
        metric: 'Total Students',
        value: this.dashboard.totalUsers,
      },
      {
        metric: 'Active Students',
        value: this.dashboard.activeUsers,
      },
      {
        metric: 'High Risk Students',
        value: this.dashboard.highRiskUsers,
      },
      {
        metric: 'Total Alerts',
        value: this.dashboard.totalAlerts,
      },
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

  private getAlertRows(): Array<Record<string, string | number | boolean>> {
    return this.recentAlerts.map((alert) => ({
      alertId: alert._id || '',
      userId: this.resolveAlertUserId(alert),
      riskLevel: this.resolveRiskLevel(alert),
      message: alert.message,
      resolved: Boolean(alert.resolved),
      timestamp: this.formatTimestamp(alert),
    }));
  }

  private getFilename(prefix: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `${prefix}-${date}`;
  }

  trackByTrendIndex(index: number, _value: number): number {
    return index;
  }

  trackByStudentUserId(_: number, student: StudentRiskListItem): string {
    return student.userId;
  }

  trackByRecentAlert(_: number, alert: RecentAlertItem): string {
    if (alert._id) {
      return String(alert._id);
    }
    const t = alert.timestamp || alert.createdAt;
    return `${this.resolveAlertUserId(alert)}-${t ? new Date(t).getTime() : alert.message}`;
  }
}
