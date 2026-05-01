import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  studentOptions: Array<{
    id: string;
    fullName: string;
    email: string;
  }> = [];
  selectorLoading = false;
  isInstructorView = false;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private adaptiveService: AdaptiveLearningService,
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getUser();
    const role = String(currentUser?.role || '').toLowerCase();
    this.isInstructorView = role === 'instructor' || role === 'admin';

    this.route.paramMap.subscribe((params) => {
      const routeStudentId = String(params.get('studentId') || '').trim();

      if (this.isInstructorView) {
        this.loadStudentDirectory(routeStudentId);
        return;
      }

      this.studentId = routeStudentId || currentUser?._id || currentUser?.id || '';
      if (!this.studentId) {
        this.error = 'Student id is required to load the report.';
        return;
      }
      this.loadReport();
    });
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

  onStudentChange(studentId: string): void {
    const nextId = String(studentId || '').trim();
    if (!nextId || nextId === this.studentId) {
      return;
    }
    this.router.navigate(['/instructor/progress-reports', nextId]);
  }

  private loadStudentDirectory(routeStudentId: string): void {
    this.selectorLoading = true;
    this.error = '';

    forkJoin({
      profiles: this.adaptiveService.getAllProfiles().pipe(catchError(() => of([] as any[]))),
      students: this.http
        .get<any[]>('http://localhost:3000/api/admin/students')
        .pipe(catchError(() => of([] as any[]))),
    }).subscribe({
      next: ({ profiles, students }) => {
        const optionsById = new Map<
          string,
          { id: string; fullName: string; email: string }
        >();

        (Array.isArray(students) ? students : []).forEach((student: any) => {
          const id = String(student?.id || student?._id || '').trim();
          if (!id) return;
          const fullName = `${String(student?.first_name || '').trim()} ${String(student?.last_name || '').trim()}`.trim();
          const email = String(student?.email || '').trim();
          optionsById.set(id, {
            id,
            fullName: fullName || 'Student',
            email: email || 'No email',
          });
        });

        (Array.isArray(profiles) ? profiles : []).forEach((profile: any) => {
          const id = String(profile?.userId || '').trim();
          if (!id || optionsById.has(id)) return;
          optionsById.set(id, {
            id,
            fullName: `Student ${id.slice(0, 8)}`,
            email: 'No email',
          });
        });

        this.studentOptions = Array.from(optionsById.values()).sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        );
        this.selectorLoading = false;

        if (this.studentOptions.length === 0) {
          this.studentId = '';
          this.report = null;
          this.comparison = null;
          this.error = 'No student profiles available yet.';
          return;
        }

        const existsInOptions = this.studentOptions.some((s) => s.id === routeStudentId);
        const targetStudentId = existsInOptions
          ? routeStudentId
          : this.studentOptions[0].id;

        if (!routeStudentId || routeStudentId !== targetStudentId) {
          this.router.navigate(['/instructor/progress-reports', targetStudentId], {
            replaceUrl: true,
          });
          return;
        }

        this.studentId = targetStudentId;
        this.loadReport();
      },
      error: () => {
        this.selectorLoading = false;
        this.error = 'Unable to load students for progress reports.';
      },
    });
  }

  goBack(): void {
    const role = String(this.authService.getUser()?.role || '').toLowerCase();
    if (role === 'instructor' || role === 'admin') {
      this.router.navigate(['/instructor/dashboard']);
      return;
    }
    this.router.navigate(['/student-dashboard']);
  }

  formatPercent(value: number | undefined | null): string {
    return `${Math.round(Number(value || 0))}%`;
  }
}
