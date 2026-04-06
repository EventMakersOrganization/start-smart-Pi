import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth.service';

interface AssignmentCard {
  id: number;
  status: 'Urgent' | 'Upcoming' | 'Graded';
  title: string;
  subtitle: string;
  dueText: string;
  subject: string;
  aiLevel: string;
  actionLabel: string;
  statusColor: string;
  accentColor: string;
}

@Component({
  selector: 'app-assignments',
  templateUrl: './assignments.component.html',
  styleUrls: ['./assignments.component.css'],
})
export class AssignmentsComponent implements OnInit {
  private apiUrl = 'http://localhost:3000/api/courses';
  private aiServiceUrl = 'http://localhost:8000';

  isInstructor = false;
  loadingCourses = false;
  savingCourse = false;
  message = '';
  error = '';

  instructorCourses: any[] = [];
  editingCourseId: string | null = null;
  showCourseForm = false;
  selectedFiles: File[] = [];
  uploadingFiles = false;

  courseForm = {
    title: '',
    description: '',
    level: '',
    subject: '',
    modules: [{ title: '', description: '' }],
  };

  user = {
    first_name: 'Alex',
    last_name: 'Johnson',
    role: 'Undergraduate',
    email: 'alex.j@eduai.platform',
    phone: '+1 (555) 0123-4567',
  };

  stats = {
    pending: 3,
    completed: 12,
    overdue: 1,
  };

  activeTab = 'upcoming';

  assignments: AssignmentCard[] = [
    {
      id: 1,
      status: 'Urgent',
      title: 'Deep Learning Fundamentals',
      subtitle: 'Module 4: Backpropagation & Optimization',
      dueText: 'Due: Oct 24, 2023 (In 4 hours)',
      subject: 'Computer Science',
      aiLevel: 'Hard',
      actionLabel: 'Start Assignment',
      statusColor:
        'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
      accentColor: 'border-red-200 dark:border-red-900/30',
    },
    {
      id: 2,
      status: 'Upcoming',
      title: 'Calculus & Linear Algebra',
      subtitle: 'Problem Set #12: Vector Spaces',
      dueText: 'Due: Oct 28, 2023',
      subject: 'Mathematics',
      aiLevel: 'Medium',
      actionLabel: 'Start Assignment',
      statusColor:
        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      accentColor: 'border-slate-200 dark:border-slate-800',
    },
    {
      id: 3,
      status: 'Graded',
      title: 'Cognitive Psychology',
      subtitle: 'Essay: Neural Correlates of Memory',
      dueText: 'Feedback Ready',
      subject: 'Psychology',
      aiLevel: 'Easy',
      actionLabel: 'View Feedback',
      statusColor:
        'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      accentColor: 'border-slate-200 dark:border-slate-800',
    },
  ];

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getUser();
    this.user = {
      first_name: currentUser?.first_name || currentUser?.name || 'User',
      last_name: currentUser?.last_name || '',
      role: currentUser?.role || 'student',
      email: currentUser?.email || '',
      phone: currentUser?.phone || '',
    };
    this.isInstructor =
      String(currentUser?.role || '').toLowerCase() === 'instructor';

    if (this.isInstructor) {
      this.loadInstructorCourses();
    }
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
  }

  openSubmission(): void {
    this.router.navigate(['/student-dashboard/assignments/submission']);
  }

  loadInstructorCourses(): void {
    const user = this.authService.getUser();
    const instructorId = user?.id || user?._id;
    if (!instructorId) {
      this.error = 'Instructor ID not found.';
      return;
    }

    this.loadingCourses = true;
    this.error = '';
    this.message = '';
    this.http
      .get<any>(
        `${this.apiUrl}?page=1&limit=200&instructorId=${encodeURIComponent(String(instructorId))}`,
      )
      .subscribe({
        next: (res) => {
          this.instructorCourses = Array.isArray(res?.data) ? res.data : [];
          this.loadingCourses = false;
        },
        error: () => {
          this.error = 'Failed to load courses.';
          this.loadingCourses = false;
        },
      });
  }

  openCreateCourse(): void {
    this.editingCourseId = null;
    this.showCourseForm = true;
    this.message = '';
    this.error = '';
    this.selectedFiles = [];
    this.courseForm = {
      title: '',
      description: '',
      level: '',
      subject: '',
      modules: [{ title: '', description: '' }],
    };
  }

  editCourse(course: any): void {
    this.editingCourseId = course?._id || null;
    this.showCourseForm = true;
    this.message = '';
    this.error = '';
    this.selectedFiles = [];

    const modules = Array.isArray(course?.modules)
      ? course.modules.map((m: any) => ({
          title: m?.title || '',
          description: m?.description || '',
        }))
      : [];

    this.courseForm = {
      title: course?.title || '',
      description: course?.description || '',
      level: course?.level || '',
      subject: course?.subject || '',
      modules: modules.length ? modules : [{ title: '', description: '' }],
    };
  }

  cancelCourseForm(): void {
    this.showCourseForm = false;
    this.editingCourseId = null;
    this.selectedFiles = [];
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.selectedFiles = files;
  }

  addModule(): void {
    this.courseForm.modules.push({ title: '', description: '' });
  }

  removeModule(index: number): void {
    if (this.courseForm.modules.length <= 1) return;
    this.courseForm.modules.splice(index, 1);
  }

  saveCourse(): void {
    const user = this.authService.getUser();
    const instructorId = user?.id || user?._id;
    if (!instructorId) {
      this.error = 'Instructor ID not found.';
      return;
    }

    const title = this.courseForm.title.trim();
    const description = this.courseForm.description.trim();
    const level = this.courseForm.level.trim();
    const subject = this.courseForm.subject.trim();

    if (!title || !description || !level || !subject) {
      this.error = 'Title, description, level and subject are required.';
      return;
    }

    const modules = this.courseForm.modules
      .map((m, idx) => ({
        title: String(m.title || '').trim(),
        description: String(m.description || '').trim(),
        order: idx,
      }))
      .filter((m) => !!m.title);

    const payload = {
      title,
      description,
      level,
      subject,
      instructorId,
      modules,
    };

    this.savingCourse = true;
    this.error = '';
    this.message = '';

    const request$ = this.editingCourseId
      ? this.http.put(`${this.apiUrl}/${this.editingCourseId}`, payload)
      : this.http.post(this.apiUrl, payload);

    request$.subscribe({
      next: (response: any) => {
        const courseId = response?._id || response?.id || this.editingCourseId;
        const hasFiles = (this.selectedFiles || []).length > 0;

        if (!courseId || !hasFiles) {
          this.savingCourse = false;
          this.showCourseForm = false;
          this.message = this.editingCourseId
            ? 'Course updated successfully.'
            : 'Course created successfully.';
          this.editingCourseId = null;
          this.selectedFiles = [];
          this.loadInstructorCourses();
          return;
        }

        this.uploadingFiles = true;
        this.uploadCourseFiles(String(courseId))
          .then(() => {
            this.savingCourse = false;
            this.uploadingFiles = false;
            this.showCourseForm = false;
            this.message = this.editingCourseId
              ? 'Course updated and files uploaded successfully.'
              : 'Course created and files uploaded successfully.';
            this.editingCourseId = null;
            this.selectedFiles = [];
            this.loadInstructorCourses();
          })
          .catch((err: any) => {
            this.savingCourse = false;
            this.uploadingFiles = false;
            this.showCourseForm = false;
            this.message = this.editingCourseId
              ? 'Course updated successfully, but file upload failed.'
              : 'Course created successfully, but file upload failed.';
            this.error =
              err?.error?.detail ||
              err?.error?.message ||
              'Some files could not be uploaded.';
            this.editingCourseId = null;
            this.selectedFiles = [];
            this.loadInstructorCourses();
          });
      },
      error: (err) => {
        this.savingCourse = false;
        this.error =
          err?.error?.message || err?.error?.detail || 'Failed to save course.';
      },
    });
  }

  private async uploadCourseFiles(courseId: string): Promise<void> {
    const files = (this.selectedFiles || []).filter((file) => !!file?.name);
    if (!files.length) {
      return;
    }

    const uploadRequests = files.map((file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', 'course');
      formData.append(
        'metadata',
        JSON.stringify({
          doc_type: 'course',
          course_id: courseId,
          course_title: this.courseForm.title,
          level: this.courseForm.level,
        }),
      );

      return firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/upload-document`, formData),
      );
    });

    await Promise.all(uploadRequests);
  }

  deleteCourse(courseId: string): void {
    if (!courseId) return;
    const ok = confirm('Delete this course?');
    if (!ok) return;

    this.error = '';
    this.message = '';
    this.http.delete(`${this.apiUrl}/${courseId}`).subscribe({
      next: () => {
        this.message = 'Course deleted successfully.';
        this.loadInstructorCourses();
      },
      error: (err) => {
        this.error =
          err?.error?.message ||
          err?.error?.detail ||
          'Failed to delete course.';
      },
    });
  }

  get totalModulesCount(): number {
    return (this.instructorCourses || []).reduce(
      (sum: number, course: any) => sum + (course?.modules?.length || 0),
      0,
    );
  }

  logout(): void {
    this.authService.logout();
  }
}
