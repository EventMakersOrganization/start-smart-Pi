import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent {
  user: any;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    this.user = this.authService.getUser();
  }


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

  showProfileSidebar = false;

  logout() {
    this.authService.logout();
  }

  openProfileSidebar() {
    this.showProfileSidebar = true;
  }

  closeProfileSidebar() {
    this.showProfileSidebar = false;
  }

  manageAccount() {
    this.closeProfileSidebar();
    // Admin doesn't have a specific profile route in the child tree yet,
    // but we can use the top-level one or add it.
    // For now, let's just go to the dashboard as fallback or a dedicated route if it exists.
    this.router.navigate(['/admin/profile']); 
  }
}

