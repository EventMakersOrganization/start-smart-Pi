import { Component } from '@angular/core';
import { AuthService } from '../../../../user-management/auth.service';
import {
  AnalyticsService,
  DashboardData,
  RecentAlertItem,
  StudentRiskListItem,
} from '../../services/analytics.service';
import { ExportService } from '../../services/export.service';

@Component({
  selector: 'app-admin-system-metrics-dashboard',
  templateUrl: './admin-system-metrics-dashboard.component.html',
  styleUrls: ['./admin-system-metrics-dashboard.component.css'],
})
export class AdminSystemMetricsDashboardComponent {
  user = this.authService.getUser();

  dashboardData: DashboardData = {
    totalUsers: 0,
    activeUsers: 0,
    highRiskUsers: 0,
    totalAlerts: 0,
  };

  recentAlerts: RecentAlertItem[] = [];
  studentRiskList: StudentRiskListItem[] = [];

  kpiCards = [
    {
      label: 'Total Users',
      value: '24,812',
      icon: 'groups',
      iconBgClass: 'bg-blue-50',
      iconTextClass: 'text-blue-700',
      trendIcon: 'trending_up',
      trendValue: '12%',
      badgeClass: 'text-secondary bg-secondary-container/20',
    },
    {
      label: 'Active Users',
      value: '18,490',
      icon: 'bolt',
      iconBgClass: 'bg-emerald-50',
      iconTextClass: 'text-secondary',
      trendIcon: 'trending_up',
      trendValue: '5.2%',
      badgeClass: 'text-secondary bg-secondary-container/20',
    },
    {
      label: 'High Risk Users',
      value: '412',
      icon: 'warning',
      iconBgClass: 'bg-red-50',
      iconTextClass: 'text-error',
      trendIcon: 'trending_down',
      trendValue: '2%',
      badgeClass: 'text-secondary bg-secondary-container/20',
    },
    {
      label: 'Total Alerts',
      value: '1,024',
      icon: 'notifications_active',
      iconBgClass: 'bg-purple-50',
      iconTextClass: 'text-tertiary',
      trendIcon: 'priority_high',
      trendValue: 'Priority',
      badgeClass: 'text-white bg-error uppercase tracking-tighter text-[10px]',
    },
  ];

  decisionEvents = [
    {
      title: 'AI Threshold Adjusted',
      description: 'Risk detection sensitivity increased for STEM modules',
      timeAgo: '14 mins ago',
      source: 'Automatic',
      icon: 'gavel',
      iconBadgeClass: 'bg-red-100 text-error',
    },
    {
      title: 'Bulk Enrollment Sync',
      description: '420 new users synchronized from Faculty API',
      timeAgo: '2 hrs ago',
      source: 'System',
      icon: 'person_add',
      iconBadgeClass: 'bg-blue-100 text-primary',
    },
    {
      title: 'Security Audit Complete',
      description: 'Zero vulnerabilities found in adaptive engine core',
      timeAgo: '5 hrs ago',
      source: 'External',
      icon: 'verified',
      iconBadgeClass: 'bg-emerald-100 text-secondary',
    },
  ];

  constructor(
    private authService: AuthService,
    private analyticsService: AnalyticsService,
    private exportService: ExportService,
  ) {
    this.loadExportData();
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

  private loadExportData(): void {
    this.analyticsService.getDashboardData().subscribe({
      next: (data) => {
        this.dashboardData = data;
      },
      error: (error) => {
        console.error('Failed to load KPI export data', error);
      },
    });

    this.analyticsService.getStudentRiskList().subscribe({
      next: (data) => {
        this.studentRiskList = data;
      },
      error: (error) => {
        console.error('Failed to load student risk export data', error);
      },
    });

    this.analyticsService.getRecentAlerts(50).subscribe({
      next: (data) => {
        this.recentAlerts = data;
      },
      error: (error) => {
        console.error('Failed to load alert export data', error);
      },
    });
  }

  private getKpiRows(): Array<Record<string, string | number>> {
    if (this.dashboardData.totalUsers > 0 || this.dashboardData.totalAlerts > 0) {
      return [
        { metric: 'Total Users', value: this.dashboardData.totalUsers },
        { metric: 'Active Users', value: this.dashboardData.activeUsers },
        { metric: 'High Risk Users', value: this.dashboardData.highRiskUsers },
        { metric: 'Total Alerts', value: this.dashboardData.totalAlerts },
      ];
    }

    return this.kpiCards.map((item) => ({
      metric: item.label,
      value: item.value,
      trend: item.trendValue,
    }));
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
}
