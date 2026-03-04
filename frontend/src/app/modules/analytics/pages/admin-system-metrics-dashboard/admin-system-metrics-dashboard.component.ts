import { Component, OnInit } from '@angular/core';
import { RiskScoreService } from '../../services/riskscore.service';
import { AlertService } from '../../services/alert.service';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-admin-system-metrics-dashboard',
  templateUrl: './admin-system-metrics-dashboard.component.html',
  styleUrls: ['./admin-system-metrics-dashboard.component.css'],
})
export class AdminSystemMetricsDashboardComponent implements OnInit {
  totalUsers: number = 0;
  totalRiskScores: number = 0;
  totalAlerts: number = 0;
  loading: boolean = true;
  error: string = '';

  constructor(
    private riskScoreService: RiskScoreService,
    private alertService: AlertService,
    private usersService: UsersService
  ) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.loading = true;
    this.error = '';

    // Load all metrics
    this.usersService.getUserCount().subscribe({
      next: (count) => {
        this.totalUsers = count;
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading user count:', err);
        this.error = 'Failed to load user count';
        this.loading = false;
      },
    });

    this.riskScoreService.getRiskScoreCount().subscribe({
      next: (count) => {
        this.totalRiskScores = count;
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading risk score count:', err);
        this.error = 'Failed to load risk score count';
        this.loading = false;
      },
    });

    this.alertService.getAlertCount().subscribe({
      next: (count) => {
        this.totalAlerts = count;
        this.checkLoadingComplete();
      },
      error: (err) => {
        console.error('Error loading alert count:', err);
        this.error = 'Failed to load alert count';
        this.loading = false;
      },
    });
  }

  private checkLoadingComplete(): void {
    // Simple check: if all counts are loaded (not zero or have been set), stop loading
    if (this.totalUsers !== undefined && this.totalRiskScores !== undefined && this.totalAlerts !== undefined) {
      this.loading = false;
    }
  }

  refreshMetrics(): void {
    this.loadMetrics();
  }
}
