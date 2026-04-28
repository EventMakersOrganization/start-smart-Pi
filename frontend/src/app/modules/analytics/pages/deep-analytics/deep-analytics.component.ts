import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { RiskScoreService } from '../../services/riskscore.service';
import { AlertService } from '../../services/alert.service';
import { RiskScore, Alert, RiskLevel, AlertSeverity } from '../../models/analytics.models';
import { AuthService } from '../../../../user-management/auth.service';

@Component({
  selector: 'app-deep-analytics',
  templateUrl: './deep-analytics.component.html',
  styleUrls: ['./deep-analytics.component.css'],
})
export class DeepAnalyticsComponent implements OnInit {
  user: any = null;

  // Data
  riskScores: RiskScore[] = [];
  alerts: Alert[] = [];
  
  // Aggregated metrics
  totalStudents = 0;
  highRiskStudents = 0;
  criticalRiskStudents = 0;
  mediumRiskStudents = 0;
  lowRiskStudents = 0;
  totalAlerts = 0;
  highSeverityAlerts = 0;
  mediumSeverityAlerts = 0;
  lowSeverityAlerts = 0;
  unresolvedAlerts = 0;
  resolvedAlerts = 0;
  
  // State
  loading = true;
  error: string | null = null;

  // Risk distribution for chart
  riskDistribution: { level: string; count: number; percentage: number }[] = [];
  
  // Alert severity distribution
  alertDistribution: { severity: string; count: number; percentage: number }[] = [];

  constructor(
    private riskScoreService: RiskScoreService,
    private alertService: AlertService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadAnalyticsData();
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

  loadAnalyticsData(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      riskScores: this.riskScoreService.getAllRiskScores().pipe(catchError(() => of([] as RiskScore[]))),
      alerts: this.alertService.getAllAlerts().pipe(catchError(() => of([] as Alert[]))),
    }).subscribe({
      next: ({ riskScores, alerts }) => {
        this.riskScores = riskScores;
        this.alerts = alerts;
        this.calculateRiskMetrics();
        this.calculateAlertMetrics();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading deep analytics data:', err);
        this.error = 'Session expired or API unavailable. Please sign in again.';
        this.loading = false;
      },
    });
  }

  calculateRiskMetrics(): void {
    this.totalStudents = this.riskScores.length;

    // Count by risk level
    this.highRiskStudents = this.riskScores.filter(
      (rs) => String(rs.riskLevel || '').toLowerCase() === RiskLevel.HIGH
    ).length;
    this.criticalRiskStudents = this.riskScores.filter(
      (rs) => String(rs.riskLevel || '').toLowerCase() === RiskLevel.CRITICAL
    ).length;
    this.mediumRiskStudents = this.riskScores.filter(
      (rs) => String(rs.riskLevel || '').toLowerCase() === RiskLevel.MEDIUM
    ).length;
    this.lowRiskStudents = this.riskScores.filter(
      (rs) => String(rs.riskLevel || '').toLowerCase() === RiskLevel.LOW
    ).length;

    // Calculate distribution for visualization
    this.riskDistribution = [
      {
        level: 'Critical Risk',
        count: this.criticalRiskStudents,
        percentage: this.totalStudents > 0
          ? Math.round((this.criticalRiskStudents / this.totalStudents) * 100)
          : 0,
      },
      {
        level: 'High Risk',
        count: this.highRiskStudents,
        percentage: this.totalStudents > 0 
          ? Math.round((this.highRiskStudents / this.totalStudents) * 100) 
          : 0,
      },
      {
        level: 'Medium Risk',
        count: this.mediumRiskStudents,
        percentage: this.totalStudents > 0 
          ? Math.round((this.mediumRiskStudents / this.totalStudents) * 100) 
          : 0,
      },
      {
        level: 'Low Risk',
        count: this.lowRiskStudents,
        percentage: this.totalStudents > 0 
          ? Math.round((this.lowRiskStudents / this.totalStudents) * 100) 
          : 0,
      },
    ];
  }

  calculateAlertMetrics(): void {
    this.totalAlerts = this.alerts.length;

    // Count by severity
    this.highSeverityAlerts = this.alerts.filter(
      (alert) => alert.severity === AlertSeverity.HIGH
    ).length;
    this.mediumSeverityAlerts = this.alerts.filter(
      (alert) => alert.severity === AlertSeverity.MEDIUM
    ).length;
    this.lowSeverityAlerts = this.alerts.filter(
      (alert) => alert.severity === AlertSeverity.LOW
    ).length;

    // Count resolved/unresolved
    this.unresolvedAlerts = this.alerts.filter((alert) => !alert.resolved).length;
    this.resolvedAlerts = this.alerts.filter((alert) => alert.resolved).length;

    // Calculate distribution for visualization
    this.alertDistribution = [
      {
        severity: 'High Severity',
        count: this.highSeverityAlerts,
        percentage: this.totalAlerts > 0 
          ? Math.round((this.highSeverityAlerts / this.totalAlerts) * 100) 
          : 0,
      },
      {
        severity: 'Medium Severity',
        count: this.mediumSeverityAlerts,
        percentage: this.totalAlerts > 0 
          ? Math.round((this.mediumSeverityAlerts / this.totalAlerts) * 100) 
          : 0,
      },
      {
        severity: 'Low Severity',
        count: this.lowSeverityAlerts,
        percentage: this.totalAlerts > 0 
          ? Math.round((this.lowSeverityAlerts / this.totalAlerts) * 100) 
          : 0,
      },
    ];
  }

  getAtRiskPercentage(): number {
    if (this.totalStudents === 0) return 0;
    return Math.round(
      ((this.criticalRiskStudents + this.highRiskStudents + this.mediumRiskStudents) / this.totalStudents) * 100,
    );
  }

  getAlertResolutionRate(): number {
    if (this.totalAlerts === 0) return 0;
    return Math.round((this.resolvedAlerts / this.totalAlerts) * 100);
  }

  trackByRiskDistLevel(_: number, row: { level: string }): string {
    return row.level;
  }

  trackByAlertDistSeverity(_: number, row: { severity: string }): string {
    return row.severity;
  }
}
