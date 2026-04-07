import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../user-management/auth.service';
import {
  AnalyticsService,
  InterventionTrackingItem,
} from '../../services/analytics.service';

@Component({
  selector: 'app-intervention-dashboard',
  templateUrl: './intervention-dashboard.component.html',
  styleUrls: ['./intervention-dashboard.component.css'],
})
export class InterventionDashboardComponent implements OnInit {
  loading = true;
  error: string | null = null;
  user: any = null;
  interventions: InterventionTrackingItem[] = [];
  selectedIntervention: InterventionTrackingItem | null = null;

  constructor(
    private analyticsService: AnalyticsService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadInterventions();
  }

  get totalInterventions(): number {
    return this.interventions.length;
  }

  get completedInterventions(): number {
    return this.interventions.filter((item) => item.status === 'applied').length;
  }

  get pendingInterventions(): number {
    return this.interventions.filter((item) => item.status === 'pending').length;
  }

  get completionRate(): number {
    if (this.totalInterventions === 0) {
      return 0;
    }

    return Math.round((this.completedInterventions / this.totalInterventions) * 100);
  }

  get criticalCases(): number {
    return this.interventions.filter((item) => item.status === 'pending' && item.riskLevel === 'high').length;
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

  loadInterventions(): void {
    this.loading = true;
    this.error = null;

    this.analyticsService.getInterventions().subscribe({
      next: (rows) => {
        this.interventions = rows || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load interventions', err);
        this.error = 'Failed to load intervention tracking data.';
        this.loading = false;
      },
    });
  }

  markAsCompleted(item: InterventionTrackingItem): void {
    if (!item?.userId || item.status === 'applied') {
      return;
    }

    this.analyticsService.markInterventionCompleted(item.userId).subscribe({
      next: () => {
        item.status = 'applied';
      },
      error: (err) => {
        console.error('Failed to mark intervention as completed', err);
      },
    });
  }

  viewDetails(item: InterventionTrackingItem): void {
    this.selectedIntervention = item;
  }

  closeDetails(): void {
    this.selectedIntervention = null;
  }

  getInitials(name: string): string {
    if (!name) {
      return 'ST';
    }

    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  toPercent(probability: number): number {
    return Math.round((Number(probability || 0) * 100));
  }

  getRiskClass(level: string): string {
    const normalized = String(level || '').toLowerCase();

    if (normalized === 'high') {
      return 'bg-error-container text-on-error-container';
    }

    if (normalized === 'medium') {
      return 'bg-yellow-100 text-yellow-800';
    }

    return 'bg-green-100 text-green-800';
  }

  getStatusClass(status: string): string {
    return status === 'applied'
      ? 'bg-secondary-container text-on-secondary-container'
      : 'bg-slate-100 text-slate-500';
  }

  trackByUserId(_: number, item: InterventionTrackingItem): string {
    return item.userId;
  }

  getPrimarySuggestion(item: InterventionTrackingItem): string {
    return item.suggestions?.[0] || 'No suggested intervention';
  }
}
