import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RiskScoreService } from '../../services/riskscore.service';
import { AlertService } from '../../services/alert.service';
import { ExplainabilityService } from '../../services/explainability.service';
import { RiskScore, Alert, ExplainabilityLog } from '../../models/analytics.models';
import { AuthService } from '../../../../user-management/auth.service';

@Component({
  selector: 'app-admin-explainability',
  templateUrl: './admin-explainability.component.html',
  styleUrls: ['./admin-explainability.component.css'],
})
export class AdminExplainabilityComponent implements OnInit {
  user = this.authService.getUser();

  get embedInAdminShell(): boolean {
    return this.router.url.includes('/admin/explainability');
  }
  riskScores: RiskScore[] = [];
  selectedRiskScore: RiskScore | null = null;
  selectedStudentAlerts: Alert[] = [];
  explanations: ExplainabilityLog[] = [];
  filteredExplanations: ExplainabilityLog[] = [];
  
  loading: boolean = true;
  loadingAlerts: boolean = false;
  loadingExplanations: boolean = false;
  error: string = '';

  // Filter options
  selectedRiskFilter: string = 'all';
  selectedDecisionFilter: string = 'all';
  searchQuery: string = '';

  constructor(
    private riskScoreService: RiskScoreService,
    private alertService: AlertService,
    private explainabilityService: ExplainabilityService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadExplanations();
  }

  loadExplanations(): void {
    this.loadingExplanations = true;
    this.error = '';

    this.explainabilityService.getRecentExplanations(100).subscribe({
      next: (explanations) => {
        this.explanations = explanations;
        this.applyFilters();
        this.loadingExplanations = false;
      },
      error: (err) => {
        console.error('Error loading explanations:', err);
        this.error = 'Failed to load AI explanations. Please try again.';
        this.loadingExplanations = false;
      },
    });
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

  /**
   * Apply active filters to explanations
   */
  applyFilters(): void {
    let filtered = [...this.explanations];

    // Apply risk level filter
    if (this.selectedRiskFilter !== 'all') {
      filtered = filtered.filter((exp) => {
        const riskLevel = this.getRiskLevel(exp.riskScore);
        return riskLevel === this.selectedRiskFilter;
      });
    }

    // Apply decision filter
    if (this.selectedDecisionFilter !== 'all') {
      filtered = filtered.filter((exp) => exp.decision === this.selectedDecisionFilter);
    }

    // Apply search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (exp) =>
          exp.userId.toLowerCase().includes(query) ||
          exp.explanation.toLowerCase().includes(query) ||
          exp.decision.toLowerCase().includes(query)
      );
    }

    this.filteredExplanations = filtered;
  }

  /**
   * On risk filter change
   */
  onRiskFilterChange(): void {
    this.applyFilters();
  }

  /**
   * On decision filter change
   */
  onDecisionFilterChange(): void {
    this.applyFilters();
  }

  /**
   * On search input change
   */
  onSearchChange(): void {
    this.applyFilters();
  }

  refreshData(): void {
    this.loadExplanations();
    this.loadRiskScores();
  }

  /**
   * Get risk level based on score
   */
  getRiskLevel(riskScore: number): string {
    if (riskScore >= 80) return 'high';
    if (riskScore >= 50) return 'medium';
    return 'low';
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

  /**
   * Get unique decision types for filter dropdown
   */
  getUniquDecisionTypes(): string[] {
    const decisions = new Set(this.explanations.map((e) => e.decision));
    return Array.from(decisions).sort();
  }

  /**
   * Format decision type from underscore to space-separated
   */
  formatDecisionType(decision: string): string {
    return decision.replace(/_/g, ' ');
  }

  /**
   * Get count of high-risk explanations
   */
  getHighRiskCount(): number {
    return this.explanations.filter((e) => e.riskScore >= 80).length;
  }

  /**
   * Get average risk score across all explanations
   */
  getAverageRiskScore(): number {
    if (this.explanations.length === 0) return 0;
    const total = this.explanations.reduce((sum, e) => sum + e.riskScore, 0);
    return Math.round((total / this.explanations.length) * 10) / 10;
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

  trackByExplanationId(_: number, item: ExplainabilityLog): string {
    if (item._id) {
      return String(item._id);
    }
    return `${item.userId}-${item.decision}-${item.createdAt ? new Date(item.createdAt).getTime() : ''}`;
  }
}
