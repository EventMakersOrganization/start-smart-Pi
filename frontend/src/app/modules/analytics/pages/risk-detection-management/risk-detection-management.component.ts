import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RiskScoreService } from '../../services/riskscore.service';
import { RiskScore, RiskLevel } from '../../models/analytics.models';

@Component({
  selector: 'app-risk-detection-management',
  templateUrl: './risk-detection-management.component.html',
  styleUrls: ['./risk-detection-management.component.css'],
})
export class RiskDetectionManagementComponent implements OnInit {
  riskScores: RiskScore[] = [];
  riskScoreForm: FormGroup;
  loading = true;
  error: string | null = null;
  successMessage: string | null = null;
  
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
    private riskScoreService: RiskScoreService
  ) {
    this.riskScoreForm = this.fb.group({
      user: ['', Validators.required],
      score: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      riskLevel: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadRiskScores();
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
        this.error = 'Failed to load risk scores';
        this.loading = false;
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

  clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }
}
