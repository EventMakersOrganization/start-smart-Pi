import { Component, OnInit } from '@angular/core';
import { RiskScoreService } from '../../services/riskscore.service';
import { AlertService } from '../../services/alert.service';
import { RiskScore, Alert, RiskLevel, AlertSeverity } from '../../models/analytics.models';

@Component({
  selector: 'app-deep-analytics',
  templateUrl: './deep-analytics.component.html',
  styleUrls: ['./deep-analytics.component.css'],
})
export class DeepAnalyticsComponent implements OnInit {
  // Data
  riskScores: RiskScore[] = [];
  alerts: Alert[] = [];
  
  // Aggregated metrics
  totalStudents = 0;
  highRiskStudents = 0;
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
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadAnalyticsData();
  }

  loadAnalyticsData(): void {
    this.loading = true;
    this.error = null;

    // Load risk scores
    this.riskScoreService.getAllRiskScores().subscribe({
      next: (scores) => {
        this.riskScores = scores;
        this.calculateRiskMetrics();
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading risk scores:', err);
        this.error = 'Failed to load risk scores';
        this.loading = false;
      },
    });

    // Load alerts
    this.alertService.getAllAlerts().subscribe({
      next: (alerts) => {
        this.alerts = alerts;
        this.calculateAlertMetrics();
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading alerts:', err);
        this.error = 'Failed to load alerts';
        this.loading = false;
      },
    });
  }

  calculateRiskMetrics(): void {
    this.totalStudents = this.riskScores.length;

    // Count by risk level
    this.highRiskStudents = this.riskScores.filter(
      (rs) => rs.riskLevel === RiskLevel.HIGH
    ).length;
    this.mediumRiskStudents = this.riskScores.filter(
      (rs) => rs.riskLevel === RiskLevel.MEDIUM
    ).length;
    this.lowRiskStudents = this.riskScores.filter(
      (rs) => rs.riskLevel === RiskLevel.LOW
    ).length;

    // Calculate distribution for visualization
    this.riskDistribution = [
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

  checkLoadingComplete(): void {
    // Check if both API calls have completed
    if (this.riskScores.length >= 0 && this.alerts.length >= 0) {
      this.loading = false;
    }
  }

  getAtRiskPercentage(): number {
    if (this.totalStudents === 0) return 0;
    return Math.round(((this.highRiskStudents + this.mediumRiskStudents) / this.totalStudents) * 100);
  }

  getAlertResolutionRate(): number {
    if (this.totalAlerts === 0) return 0;
    return Math.round((this.resolvedAlerts / this.totalAlerts) * 100);
  }
}
