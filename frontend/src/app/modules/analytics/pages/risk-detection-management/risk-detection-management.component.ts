import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AtRiskStudentInsight,
  RiskRecalculationSummary,
  RiskScoreService,
} from '../../services/riskscore.service';
import { RiskScore, RiskLevel } from '../../models/analytics.models';
import { AuthService } from '../../../../user-management/auth.service';

@Component({
  selector: 'app-risk-detection-management',
  templateUrl: './risk-detection-management.component.html',
  styleUrls: ['./risk-detection-management.component.css'],
})
export class RiskDetectionManagementComponent implements OnInit {
  user: any = null;
  riskScores: RiskScore[] = [];
  riskScoreForm: FormGroup;
  loading = true;
  error: string | null = null;
  successMessage: string | null = null;
  insightsLoading = false;
  riskScanRunning = false;
  lastScanAt: Date | null = null;
  atRiskInsights: AtRiskStudentInsight[] = [];
  
  // Modal state
  showModal = false;
  isEditMode = false;
  selectedRiskScore: RiskScore | null = null;
  
  // View details modal
  showDetailsModal = false;
  detailsRiskScore: RiskScore | null = null;

  // Expose enum to template
  riskLevels = Object.values(RiskLevel);

  constructor(
    private fb: FormBuilder,
    private riskScoreService: RiskScoreService,
    private authService: AuthService,
    private router: Router,
  ) {
    this.riskScoreForm = this.fb.group({
      user: ['', Validators.required],
      score: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      riskLevel: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadRiskScores();
    this.loadAtRiskInsights();
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

  loadRiskScores(): void {
    this.loading = true;
    this.error = null;
    
    this.riskScoreService.getAllRiskScores().subscribe({
      next: (scores) => {
        this.riskScores = scores;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading risk scores:', err);
        this.error = 'Session expired or API unavailable. Please sign in again.';
        this.loading = false;
      },
    });
  }

  loadAtRiskInsights(): void {
    this.insightsLoading = true;
    this.riskScoreService.getAtRiskInsights('medium', 30).subscribe({
      next: (rows) => {
        this.atRiskInsights = Array.isArray(rows) ? rows : [];
        this.insightsLoading = false;
      },
      error: () => {
        this.atRiskInsights = [];
        this.insightsLoading = false;
      },
    });
  }

  runContinuousRiskScanNow(): void {
    this.riskScanRunning = true;
    this.error = null;

    this.riskScoreService.recalculateRiskScores(1000).subscribe({
      next: (summary: RiskRecalculationSummary) => {
        this.lastScanAt = summary?.generatedAt ? new Date(summary.generatedAt) : new Date();
        this.successMessage =
          `Risk scan complete: ${summary.updatedScores}/${summary.processedStudents} students updated, ` +
          `${summary.highRiskCount} high risk and ${summary.mediumRiskCount} medium risk.`;
        this.riskScanRunning = false;
        this.loadRiskScores();
        this.loadAtRiskInsights();
      },
      error: () => {
        this.error = 'Failed to run continuous risk scan.';
        this.riskScanRunning = false;
      },
    });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedRiskScore = null;
    this.riskScoreForm.reset();
    this.showModal = true;
    this.clearMessages();
  }

  openEditModal(riskScore: RiskScore): void {
    this.isEditMode = true;
    this.selectedRiskScore = riskScore;
    this.riskScoreForm.patchValue({
      user: this.getUserId(riskScore.user),
      score: riskScore.score,
      riskLevel: riskScore.riskLevel,
    });
    this.showModal = true;
    this.clearMessages();
  }

  closeModal(): void {
    this.showModal = false;
    this.riskScoreForm.reset();
    this.selectedRiskScore = null;
  }

  openDetailsModal(riskScore: RiskScore): void {
    this.detailsRiskScore = riskScore;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailsRiskScore = null;
  }

  onSubmit(): void {
    if (this.riskScoreForm.invalid) {
      return;
    }

    const formData = this.riskScoreForm.value;

    if (this.isEditMode && this.selectedRiskScore?._id) {
      this.updateRiskScore(this.selectedRiskScore._id, formData);
    } else {
      this.createRiskScore(formData);
    }
  }

  createRiskScore(data: Partial<RiskScore>): void {
    this.riskScoreService.createRiskScore(data).subscribe({
      next: (created) => {
        this.successMessage = 'Risk score created successfully';
        this.closeModal();
        this.loadRiskScores();
      },
      error: (err) => {
        console.error('Error creating risk score:', err);
        this.error = 'Failed to create risk score';
      },
    });
  }

  updateRiskScore(id: string, data: Partial<RiskScore>): void {
    this.riskScoreService.updateRiskScore(id, data).subscribe({
      next: (updated) => {
        this.successMessage = 'Risk score updated successfully';
        this.closeModal();
        this.loadRiskScores();
      },
      error: (err) => {
        console.error('Error updating risk score:', err);
        this.error = 'Failed to update risk score';
      },
    });
  }

  deleteRiskScore(id: string): void {
    if (!confirm('Are you sure you want to delete this risk score?')) {
      return;
    }

    this.riskScoreService.deleteRiskScore(id).subscribe({
      next: () => {
        this.successMessage = 'Risk score deleted successfully';
        this.loadRiskScores();
      },
      error: (err) => {
        console.error('Error deleting risk score:', err);
        this.error = 'Failed to delete risk score';
      },
    });
  }

  getRiskBadgeClass(riskLevel: RiskLevel): string {
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
        return 'bg-red-700 text-white';
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
      case RiskLevel.CRITICAL:
        return 'Critical Risk';
      case RiskLevel.HIGH:
        return 'High Risk';
      case RiskLevel.MEDIUM:
        return 'Medium Risk';
      case RiskLevel.LOW:
        return 'Low Risk';
      default:
        return 'Unknown';
    }
  }

  getUserName(user: any): string {
    if (!user) return 'Unknown';
    if (typeof user === 'string') return user;
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown';
  }

  getUserId(user: any): string {
    if (!user) return '';
    if (typeof user === 'string') return user;
    return user._id || user.id || '';
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }

  formatRelative(date: Date | string | null | undefined): string {
    if (!date) {
      return 'N/A';
    }

    const value = new Date(date);
    if (Number.isNaN(value.getTime())) {
      return 'N/A';
    }

    return value.toLocaleString();
  }

  clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }

  trackByRiskScoreId(_: number, item: RiskScore): string {
    return item._id || this.getUserId(item.user);
  }

  trackByRiskLevel(_: number, level: string): string {
    return level;
  }

  trackByAtRiskUser(_: number, item: AtRiskStudentInsight): string {
    return item.userId;
  }
}
