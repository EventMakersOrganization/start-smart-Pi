import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import {
  AdaptiveLearningService,
  StudentComparisonAnalyticsResponse,
  UnifiedStudentProfileResponse,
} from '../adaptive-learning.service';

@Component({
  selector: 'app-progress-reports',
  templateUrl: './progress-reports.component.html',
  styleUrls: ['./progress-reports.component.css'],
})
export class ProgressReportsComponent implements OnInit {
  studentId = '';
  loading = false;
  error = '';
  report: UnifiedStudentProfileResponse | null = null;
  comparison: StudentComparisonAnalyticsResponse | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private adaptiveService: AdaptiveLearningService,
  ) {}

  ngOnInit(): void {
    const routeStudentId = this.route.snapshot.paramMap.get('studentId');
    const currentUser = this.authService.getUser();
    this.studentId =
      routeStudentId || currentUser?._id || currentUser?.id || '';

    if (!this.studentId) {
      this.error = 'Student id is required to load the report.';
      return;
    }

    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    this.error = '';

    forkJoin({
      report: this.adaptiveService
        .getUnifiedStudentProfile(this.studentId)
        .pipe(catchError(() => of(null))),
      comparison: this.adaptiveService
        .getStudentComparisonAnalytics(this.studentId)
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ report, comparison }) => {
        this.report = report;
        this.comparison = comparison;
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load progress report.';
        this.loading = false;
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/student-dashboard']);
  }

  formatPercent(value: number | undefined | null): string {
    return `${Math.round(Number(value || 0))}%`;
  }
}
