import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { AnalyticsService, InterventionTrackingItem } from '../../modules/analytics/services/analytics.service';
import { SubjectItem, SubjectsService } from '../subjects.service';
import { catchError, of } from 'rxjs';
import { apiUrl } from '../../core/api-url';

@Component({
  selector: 'app-instructor-shell',
  templateUrl: './instructor-shell.component.html',
  styleUrls: ['./instructor-shell.component.css'],
})
export class InstructorShellComponent implements OnInit {
  user: any;
  profileData: any = null;
  showProfileSidebar = false;
  assignedSubjects: SubjectItem[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private analyticsService: AnalyticsService,
    private subjectsService: SubjectsService,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadProfile();
    this.loadAssignedSubjects();
  }

  loadProfile(): void {
    this.http.get<any>(apiUrl('/api/user/profile')).subscribe({
      next: (data) => {
        this.profileData = data;
        if (this.user && data?.user?.phone) {
          this.user.phone = data.user.phone;
        }
      },
      error: () => {
        /* optional */
      },
    });
  }

  logout(): void {
    this.authService.logout();
  }

  openProfileSidebar(): void {
    this.showProfileSidebar = true;
  }

  closeProfileSidebar(): void {
    this.showProfileSidebar = false;
  }

  manageAccount(): void {
    this.closeProfileSidebar();
    this.router.navigate(['/instructor/profile']);
  }

  /** Highlights top nav when any instructor analytics route is active. */
  get analyticsSectionActive(): boolean {
    const u = this.router.url.split('?')[0];
    return (
      u.includes('/instructor/dashboard') ||
      u.includes('/instructor/deep-analytics') ||
      u.includes('/instructor/risk-detection') ||
      u.includes('/instructor/comprehensive-analytics') ||
      u.includes('/instructor/interventions')
    );
  }

  get subjectsSectionActive(): boolean {
    return this.router.url.includes('/instructor/subjects');
  }

  private loadAssignedSubjects(): void {
    const instructorId = String(this.user?._id || this.user?.id || '').trim();
    this.subjectsService
      .getSubjects(instructorId || undefined)
      .pipe(catchError(() => of([] as SubjectItem[])))
      .subscribe((subjects) => {
        this.assignedSubjects = Array.isArray(subjects) ? subjects.slice(0, 4) : [];
      });
  }
}
