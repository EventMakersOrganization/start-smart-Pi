import { Component, OnInit } from '@angular/core';
import { RiskScoreService } from '../../services/riskscore.service';
import { AlertService } from '../../services/alert.service';
import { RiskScore, Alert } from '../../models/analytics.models';

@Component({
  selector: 'app-admin-explainability',
  templateUrl: './admin-explainability.component.html',
  styleUrls: ['./admin-explainability.component.css'],
})
export class AdminExplainabilityComponent implements OnInit {
  riskScores: RiskScore[] = [];
  selectedRiskScore: RiskScore | null = null;
  selectedStudentAlerts: Alert[] = [];
  loading: boolean = true;
  loadingAlerts: boolean = false;
  error: string = '';

  constructor(
    private riskScoreService: RiskScoreService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadRiskScores();
  }

  loadRiskScores(): void {
    this.loading = true;
    this.error = '';

    this.riskScoreService.getAllRiskScores().subscribe({
      next: (scores) => {
        this.riskScores = scores;
        this.loading = false;
        
        // Auto-select first risk score if available
        if (this.riskScores.length > 0) {
          this.selectRiskScore(this.riskScores[0]);
        }
      },
      error: (err) => {
        console.error('Error loading risk scores:', err);
        this.error = 'Failed to load risk scores. Please try again.';
        this.loading = false;
      },
    });
  }

  selectRiskScore(riskScore: RiskScore): void {
    this.selectedRiskScore = riskScore;
    this.loadAlertsForStudent(riskScore);
  }

  loadAlertsForStudent(riskScore: RiskScore): void {
    this.loadingAlerts = true;
    
    // Get student ID from user field
    const studentId = typeof riskScore.user === 'string' ? riskScore.user : riskScore.user?._id || riskScore.user?.id;
    
    if (!studentId) {
      this.selectedStudentAlerts = [];
      this.loadingAlerts = false;
      return;
    }

    this.alertService.getAlertsByStudent(studentId).subscribe({
      next: (alerts) => {
        this.selectedStudentAlerts = alerts;
        this.loadingAlerts = false;
      },
      error: (err) => {
        console.error('Error loading alerts:', err);
        this.selectedStudentAlerts = [];
        this.loadingAlerts = false;
      },
    });
  }

  refreshData(): void {
    this.loadRiskScores();
  }

  getRiskBadgeClass(riskLevel: string): string {
    switch (riskLevel?.toLowerCase()) {
      case 'low':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      case 'medium':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      case 'high':
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    }
  }

  getSeverityBadgeClass(severity: string): string {
    switch (severity?.toLowerCase()) {
      case 'low':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      case 'medium':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      case 'high':
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    }
  }

  getRiskLabel(riskLevel: string): string {
    if (!riskLevel) return 'Unknown';
    return riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).toLowerCase();
  }

  getUserName(user: any): string {
    if (!user) return 'Unknown User';
    if (typeof user === 'string') return user;
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    if (user.email) return user.email;
    return 'Unknown User';
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getResolvedCount(): number {
    return this.selectedStudentAlerts.filter(a => a.resolved).length;
  }

  getUnresolvedCount(): number {
    return this.selectedStudentAlerts.filter(a => !a.resolved).length;
  }
}
