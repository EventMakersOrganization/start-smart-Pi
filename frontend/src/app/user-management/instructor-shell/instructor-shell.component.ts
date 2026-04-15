import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { AnalyticsService, InterventionTrackingItem } from '../../modules/analytics/services/analytics.service';
import { SubjectItem, SubjectsService } from '../subjects.service';
import { catchError, of } from 'rxjs';

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
  criticalCases = 0;
  topRiskMessage = 'No critical learning alerts right now.';

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
    this.loadInsightCard();
  }

  loadProfile(): void {
    this.http.get<any>('http://localhost:3000/api/user/profile').subscribe({
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
    this.router.navigate(['/profile']);
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

  private loadInsightCard(): void {
    this.analyticsService
      .getInterventions()
      .pipe(catchError(() => of([] as InterventionTrackingItem[])))
      .subscribe((rows) => {
        const interventions = Array.isArray(rows) ? rows : [];
        const critical = interventions.filter(
          (item) => item.status === 'pending' && item.riskLevel === 'high',
        );
        this.criticalCases = critical.length;

        if (critical.length === 0) {
          this.topRiskMessage = 'No critical learning alerts right now.';
          return;
        }

        const top = critical
          .slice(0, 2)
          .map((item) => item.name)
          .filter((name) => !!name)
          .join(', ');
        this.topRiskMessage = top
          ? `${critical.length} high-risk students pending: ${top}.`
          : `${critical.length} high-risk students need follow-up.`;
      });
  }
}
