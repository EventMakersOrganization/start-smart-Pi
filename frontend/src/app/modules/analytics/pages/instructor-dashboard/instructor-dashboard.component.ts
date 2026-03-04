import { Component, OnInit } from '@angular/core';
import { RiskScoreService } from '../../services/riskscore.service';
import { AlertService } from '../../services/alert.service';
import { RiskScore, Alert, RiskLevel, AlertSeverity } from '../../models/analytics.models';

interface StudentRiskData {
  student: any;
  riskScore: RiskScore | null;
  currentGrade: string;
  lastActivity: string;
  engagementTrend: number[];
}

@Component({
  selector: 'app-instructor-dashboard',
  templateUrl: './instructor-dashboard.component.html',
  styleUrls: ['./instructor-dashboard.component.css'],
})
export class InstructorDashboardComponent implements OnInit {
  // Expose enums to template
  RiskLevel = RiskLevel;
  AlertSeverity = AlertSeverity;

  riskScores: RiskScore[] = [];
  alerts: Alert[] = [];
  unresolvedAlerts: Alert[] = [];
  studentRiskData: StudentRiskData[] = [];
  loading = true;
  error: string | null = null;

  // KPI data
  averageScore = 0;
  engagementRate = 0;
  overallRiskLevel: RiskLevel = RiskLevel.LOW;

  constructor(
    private riskScoreService: RiskScoreService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    // Load all risk scores
    this.riskScoreService.getAllRiskScores().subscribe({
      next: (scores) => {
        this.riskScores = scores;
        this.calculateKPIs();
        this.prepareStudentRiskData();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading risk scores:', err);
        this.error = 'Failed to load risk scores';
        this.loading = false;
      },
    });

    // Load unresolved alerts
    this.alertService.getUnresolvedAlerts().subscribe({
      next: (alerts) => {
        this.unresolvedAlerts = alerts;
      },
      error: (err) => {
        console.error('Error loading alerts:', err);
      },
    });

    // Load all alerts
    this.alertService.getAllAlerts().subscribe({
      next: (alerts) => {
        this.alerts = alerts;
      },
      error: (err) => {
        console.error('Error loading all alerts:', err);
      },
    });
  }

  calculateKPIs(): void {
    if (this.riskScores.length === 0) return;

    // Calculate average score
    const totalScore = this.riskScores.reduce((sum, rs) => sum + rs.score, 0);
    this.averageScore = Math.round((totalScore / this.riskScores.length) * 100) / 100;

    // Mock engagement rate (would come from actual engagement data)
    this.engagementRate = 92;

    // Determine overall risk level
    const highRiskCount = this.riskScores.filter(
      (rs) => rs.riskLevel === RiskLevel.HIGH
    ).length;
    const mediumRiskCount = this.riskScores.filter(
      (rs) => rs.riskLevel === RiskLevel.MEDIUM
    ).length;

    if (highRiskCount > 0) {
      this.overallRiskLevel = RiskLevel.HIGH;
    } else if (mediumRiskCount > this.riskScores.length / 2) {
      this.overallRiskLevel = RiskLevel.MEDIUM;
    } else {
      this.overallRiskLevel = RiskLevel.LOW;
    }
  }

  prepareStudentRiskData(): void {
    this.studentRiskData = this.riskScores.map((riskScore) => ({
      student: riskScore.user,
      riskScore: riskScore,
      currentGrade: `${riskScore.score}%`,
      lastActivity: this.getRandomLastActivity(),
      engagementTrend: this.generateMockTrend(),
    }));
  }

  getRandomLastActivity(): string {
    const activities = ['Today', '6 hours ago', '2 days ago', '3 days ago', '1 week ago'];
    return activities[Math.floor(Math.random() * activities.length)];
  }

  generateMockTrend(): number[] {
    return Array(5)
      .fill(0)
      .map(() => Math.floor(Math.random() * 7) + 1);
  }

  getRiskBadgeClass(riskLevel: RiskLevel): string {
    switch (riskLevel) {
      case RiskLevel.HIGH:
        return 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400';
      case RiskLevel.MEDIUM:
        return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
      case RiskLevel.LOW:
        return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  getRiskLabel(riskLevel: RiskLevel): string {
    switch (riskLevel) {
      case RiskLevel.HIGH:
        return 'High Risk';
      case RiskLevel.MEDIUM:
        return 'Moderate';
      case RiskLevel.LOW:
        return 'Stable';
      default:
        return 'Unknown';
    }
  }

  getAlertBadgeClass(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.HIGH:
        return 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30';
      case AlertSeverity.MEDIUM:
        return 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30';
      case AlertSeverity.LOW:
        return 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30';
      default:
        return 'bg-slate-50 dark:bg-slate-900/10 border-slate-100 dark:border-slate-900/30';
    }
  }

  getAlertIconColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.HIGH:
        return 'text-rose-600';
      case AlertSeverity.MEDIUM:
        return 'text-amber-600';
      case AlertSeverity.LOW:
        return 'text-emerald-600';
      default:
        return 'text-slate-600';
    }
  }

  getAlertIcon(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.HIGH:
        return 'priority_high';
      case AlertSeverity.MEDIUM:
        return 'hourglass_empty';
      case AlertSeverity.LOW:
        return 'auto_awesome';
      default:
        return 'info';
    }
  }

  getStudentName(student: any): string {
    if (!student) return 'Unknown';
    if (typeof student === 'string') return 'Student';
    return `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
  }

  sendMessage(studentId: string): void {
    console.log('Send message to student:', studentId);
    // TODO: Implement message functionality in future sprint
  }
}
