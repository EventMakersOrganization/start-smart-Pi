import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  /** Highlight top "Analytics" tab for all admin analytics child routes. */
  get analyticsSectionActive(): boolean {
    const u = this.router.url.split('?')[0];
    return (
      u.includes('/admin/system-metrics') ||
      u.includes('/admin/comprehensive-analytics') ||
      u.includes('/admin/report-builder') ||
      u.includes('/admin/explainability')
    );
  }

  logout() {
    this.authService.logout();
  }
}
