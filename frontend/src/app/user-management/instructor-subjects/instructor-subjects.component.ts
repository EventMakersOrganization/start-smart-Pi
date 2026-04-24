// ...existing code...
import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';
import {
  QuizFileSubmissionResponse,
  QuizSubmissionService,
} from '../quiz-submission.service';
import {
  PrositSubmissionResponse,
  PrositSubmissionService,
} from '../prosit-submission.service';
import {
  SubjectItem,
  SubjectChapter,
  SubjectChapterContent,
  SubjectQuizQuestion,
  SubjectSubChapter,
  SubjectsService,
} from '../subjects.service';

// ...existing code...

// Interfaces
interface SubjectFormModel {
  title: string;
  description: string;
}

interface ChapterFormModel {
  title: string;
  description: string;
}

interface SubChapterFormModel {
  title: string;
  description: string;
}

interface ChapterContentFormModel {
  folder: 'cours' | 'exercices' | 'videos' | 'ressources';
  type: 'file' | 'quiz' | 'video' | 'link' | 'prosit' | 'code';
  title: string;
  url: string;
  dueDate: string;
  submissionInstructions: string;
  codeSnippet: string;
  quizQuestions: QuizQuestionFormModel[];
  quizMode?: 'inline' | 'file'; // 'inline' for questions, 'file' for uploaded PDF/Word
}

interface QuizQuestionFormModel {
  question: string;
  options: string[];
  correctOptionIndex: number | null;
}

interface QuizFileGradeFormModel {
  correctAnswersCount: number | null;
  totalQuestionsCount: number | null;
  teacherFeedback: string;
}

interface QuizFilePreviewState {
  loading: boolean;
  error: string;
  html: string;
  url: string | null;
  type: string;
}

interface PrositGradeFormModel {
  grade: number | null;
  feedback: string;
}

// ...interfaces above...

@Component({
  selector: 'app-instructor-subjects',
  templateUrl: './instructor-subjects.component.html',
  styleUrls: ['./instructor-subjects.component.css'],
})
export class InstructorSubjectsComponent implements OnInit, OnDestroy {
  /**
   * Convertit automatiquement un lien YouTube "watch" en lien "embed".
   * Si ce n'est pas un lien YouTube, retourne l'URL d'origine.
   */
  toEmbedUrl(url: string): string {
    if (!url) return '';
    // YouTube watch URL
    const watchRegex =
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([\w-]+)/i;
    const shortRegex = /(?:https?:\/\/)?youtu\.be\/([\w-]+)/i;
    let match = url.match(watchRegex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    match = url.match(shortRegex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    return url;
  }
  // Used for *ngFor trackBy to prevent input focus loss
  trackByIndex(index: number, item: any): number {
    return index;
  }
  showAddChapterForm = false;
  onShowAddChapterForm() {
    this.showAddChapterForm = true;
  }

  onHideAddChapterForm() {
    this.showAddChapterForm = false;
  }
  openContentId: string | null = null;

  async onOpenContent(content: any) {
    this.selectedContentForView = { ...content };
    this.showViewModal = true;

    const url = content.url || '';
    const isDocx = url.toLowerCase().endsWith('.docx') || url.toLowerCase().endsWith('.doc');
    const isText = url.toLowerCase().endsWith('.txt') || url.toLowerCase().endsWith('.html') || url.toLowerCase().endsWith('.htm');

    if (url && (isDocx || isText)) {
      this.selectedContentForView.loadingPreview = true;
      try {
        const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
        const response = await fetch(fullUrl);
        
        if (isDocx) {
          const arrayBuffer = await response.arrayBuffer();
          try {
            const mammothModule: any = await import('mammoth/mammoth.browser');
            const result = await mammothModule.convertToHtml({ arrayBuffer });
            this.selectedContentForView.previewHtml = result.value;
          } catch (mErr) {
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(arrayBuffer);
            this.selectedContentForView.previewHtml = text.includes('<html') ? text : text.replace(/\n/g, '<br>');
          }
        } else {
          const text = await response.text();
          this.selectedContentForView.previewHtml = text.replace(/\n/g, '<br>');
        }
      } catch (err) {
        console.error('File preview failed', err);
        this.selectedContentForView.previewError = 'Impossible de générer l\'aperçu du document.';
      } finally {
        this.selectedContentForView.loadingPreview = false;
      }
    }
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedContentForView = null;
  }

  startEditContent(chapterOrder: number, subChapterOrder: number, content: any) {
    this.activeSubChapterChapterOrder = chapterOrder;
    this.activeSubChapterSubOrder = subChapterOrder;
    this.activeContentChapterOrder = chapterOrder;
    this.editingContentId = content.contentId;
    
    // Map existing content to the unified form
    this.chapterContentForm = {
      folder: (content.folder as any) || this.resolveContentFolder(content),
      type: content.type,
      title: String(content.title || ''),
      url: content.url || '',
      codeSnippet: content.codeSnippet || '',
      dueDate: content.dueDate || '',
      submissionInstructions: content.submissionInstructions || '',
      quizQuestions: [],
      quizMode: 'inline'
    };

    if (content.type === 'video') {
      this.videoUploadMode = content.url?.startsWith('http') ? 'link' : 'file';
    }

    this.showContentModal = true;
  }

  copyToClipboard(text: string) {
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        // Optionnel: feedback visuel
      });
    }
  }

  readonly folderLabels: Record<
    'cours' | 'exercices' | 'videos' | 'ressources',
    string
  > = {
    cours: 'Cours',
    exercices: 'Exercices',
    videos: 'Videos',
    ressources: 'Ressources Additionnelles',
  };
  user: any;
  loadingSubjects = false;
  loadingSubject = false;
  savingSubject = false;
  savingChapter = false;
  savingSubChapter = false;
  savingChapterContent = false;
  error = '';
  subjects: SubjectItem[] = [];
  selectedSubject: SubjectItem | null = null;
  private routeSub?: Subscription;

  // Chapter-level collapse/expand
  expandedChapterOrder: number | null = null;

  // SubChapter-level collapse/expand (key format: "chapterOrder_subChapterOrder")
  expandedSubChapterKey: string | null = null;
  activeFolderBySubChapter: Record<
    string,
    'cours' | 'exercices' | 'videos' | 'ressources'
  > = {};


  // Active content form states
  activeContentChapterOrder: number | null = null;
  activeSubChapterFormChapterOrder: number | null = null;
  activeSubChapterChapterOrder: number | null = null;
  activeSubChapterSubOrder: number | null = null;
  editingContentId: string | null = null;
  showContentModal = false;
  showViewModal = false;
  selectedContentForView: any = null;

  // File upload state
  selectedChapterFile: File | null = null;
  selectedQuizFile: File | null = null;
  videoUploadMode: 'file' | 'link' = 'file';
  uploadingChapterFile = false;
  isEditingQuizFileContent = false;
  quizFileContent = '';
  originalQuizFileExtension = '';
  loadingQuizFileContent = false;
  loadingQuizFileSubmissions = false;
  loadingPrositSubmissions = false;
  gradingQuizSubmissionId: string | null = null;
  gradingPrositSubmissionId: string | null = null;
  instructorQuizFileSubmissions: QuizFileSubmissionResponse[] = [];
  instructorPrositSubmissions: PrositSubmissionResponse[] = [];
  quizFileGradeForms: Record<string, QuizFileGradeFormModel> = {};
  prositGradeForms: Record<string, PrositGradeFormModel> = {};
  expandedQuizSubmissionId: string | null = null;
  quizFilePreviews: Record<string, QuizFilePreviewState> = {};

  // Attendance state
  showAttendanceModal = false;
  classStudents: any[] = [];
  loadingStudents = false;
  submittingAttendance = false;
  attendanceDate: string = new Date().toISOString().split('T')[0];
  attendanceRecords: Record<string, 'present' | 'absent' | 'late'> = {};
  attendanceSuccess = false;
  attendanceError = '';

  private subjectsApiUrl = 'http://localhost:3000/api/subjects';

  subjectForm: SubjectFormModel = {
    title: '',
    description: '',
  };

  chapterForm: ChapterFormModel = {
    title: '',
    description: '',
  };

  subChapterForm: SubChapterFormModel = {
    title: '',
    description: '',
  };

  chapterContentForm: ChapterContentFormModel = {
    folder: 'cours',
    type: 'file',
    title: '',
    url: '',
    dueDate: '',
    submissionInstructions: '',
    codeSnippet: '',
    quizQuestions: [this.createEmptyQuizQuestion()],
    quizMode: 'inline', // Default to inline quiz
  };

  get folderKeys(): Array<'cours' | 'exercices' | 'videos' | 'ressources'> {
    return ['cours', 'exercices', 'videos', 'ressources'];
  }

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private subjectsService: SubjectsService,
    private quizSubmissionService: QuizSubmissionService,
    private prositSubmissionService: PrositSubmissionService,
  ) {}

  private classesApi = 'http://localhost:3000/api/admin/instructor/classes';
  selectedClassId: string | null = null;
  className: string | null = null;

  ngOnInit(): void {
    this.user = this.authService.getUser();
    
    this.route.queryParams.subscribe(params => {
      this.selectedClassId = params['classId'] || null;
    });

    this.routeSub = this.route.paramMap.subscribe((params) => {
      const subjectId = params.get('id');
      if (subjectId) {
        this.loadSubjects(subjectId);
        this.loadSubjectDetail(subjectId);
      } else {
        this.selectedSubject = null;
        this.expandedChapterOrder = null;
        this.chapterForm = { title: '', description: '' };
        this.loadSubjects();
      }
    });
  }

  // Attendance methods
  openAttendanceModal(): void {
    if (!this.selectedClassId && this.selectedSubject) {
      this.loadingStudents = true;
      this.showAttendanceModal = true;
      this.http.get<any[]>(this.classesApi).subscribe({
        next: (classes) => {
          const subjectId = (this.selectedSubject as any)._id || (this.selectedSubject as any).id;
          const foundClass = classes.find((c: any) => 
            c.subjects && c.subjects.some((s: any) => s.id === subjectId || s._id === subjectId)
          );
          
          if (foundClass) {
            this.selectedClassId = foundClass.id;
            this.className = foundClass.name;
            this.loadClassStudents();
          } else {
            this.attendanceError = 'Impossible de déterminer la classe pour ce sujet.';
            this.loadingStudents = false;
          }
        },
        error: () => {
          this.attendanceError = 'Erreur lors du chargement des classes.';
          this.loadingStudents = false;
        }
      });
      return;
    }

    if (!this.selectedClassId) return;
    this.showAttendanceModal = true;
    this.attendanceSuccess = false;
    this.attendanceError = '';
    this.loadClassStudents();
  }

  closeAttendanceModal(): void {
    this.showAttendanceModal = false;
  }

  loadClassStudents(): void {
    this.loadingStudents = true;
    this.http.get<any[]>(this.classesApi).subscribe({
      next: (classes) => {
        const cls = classes.find((c: any) => c.id === this.selectedClassId);
        if (cls && cls.students) {
          this.classStudents = cls.students;
          // Initialize records with 'present' by default if not already set
          this.classStudents.forEach(s => {
            if (!this.attendanceRecords[s.id]) {
              this.attendanceRecords[s.id] = 'present';
            }
          });
        }
        this.loadingStudents = false;
      },
      error: () => {
        this.attendanceError = 'Failed to load students.';
        this.loadingStudents = false;
      }
    });
  }

  setAttendanceStatus(studentId: string, status: 'present' | 'absent' | 'late'): void {
    this.attendanceRecords[studentId] = status;
  }

  submitAttendance(): void {
    if (!this.selectedClassId) return;
    this.submittingAttendance = true;
    this.attendanceError = '';

    const payload = {
      schoolClassId: this.selectedClassId,
      date: this.attendanceDate,
      records: Object.entries(this.attendanceRecords).map(([studentId, status]) => ({
        studentId,
        status
      }))
    };

    this.http.post('http://localhost:3000/api/admin/attendance', payload).subscribe({
      next: () => {
        this.attendanceSuccess = true;
        this.submittingAttendance = false;
        // Refresh students list to show updated attendance percentages immediately
        this.loadClassStudents();
        setTimeout(() => this.closeAttendanceModal(), 2000);
      },
      error: () => {
        this.attendanceError = 'Failed to submit attendance.';
        this.submittingAttendance = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private loadSubjects(selectedSubjectId?: string): void {
    const instructorId = this.user?.id || this.user?._id;
    if (!instructorId) {
      this.error = 'Instructor ID not found.';
      return;
    }

    this.loadingSubjects = true;
    this.error = '';

    this.subjectsService.getSubjects(String(instructorId)).subscribe({
      next: (rows) => {
        let loadedSubjects = Array.isArray(rows) ? rows : [];
        
        // If a classId is specified, fetch the class details to filter subjects
        if (this.selectedClassId) {
          this.http.get<any[]>(this.classesApi).subscribe({
            next: (classes) => {
              const selectedClass = classes.find((c: any) => c.id === this.selectedClassId);
              if (selectedClass) {
                this.className = selectedClass.name;
                const classSubjectIds = new Set((selectedClass.subjects || []).map((s: any) => s.id));
                loadedSubjects = loadedSubjects.filter(sub => classSubjectIds.has(sub._id) || classSubjectIds.has(sub.id));
              }
              this.applyLoadedSubjects(loadedSubjects, selectedSubjectId);
            },
            error: () => {
              console.error('Failed to load instructor classes for filtering');
              this.applyLoadedSubjects(loadedSubjects, selectedSubjectId);
            }
          });
        } else {
          this.applyLoadedSubjects(loadedSubjects, selectedSubjectId);
        }
      },
      error: () => {
        this.error = 'Failed to load subjects.';
        this.loadingSubjects = false;
      },
    });
  }

  private applyLoadedSubjects(loadedSubjects: any[], selectedSubjectId?: string) {
    this.subjects = loadedSubjects;
    if (selectedSubjectId) {
      const found = this.subjects.find(
        (subject) =>
          subject._id === selectedSubjectId ||
          subject.id === selectedSubjectId,
      );
      if (found) {
        this.selectedSubject = found;
      }
    }
    this.loadingSubjects = false;
  }

  private loadSubjectDetail(subjectId: string): void {
    this.loadingSubject = true;
    this.error = '';

    this.subjectsService.getSubject(subjectId).subscribe({
      next: (subject) => {
        this.selectedSubject = this.normalizeContentFolders(subject);
        this.loadInstructorQuizFileSubmissions();
        this.loadInstructorPrositSubmissions();
        this.expandedChapterOrder = null;
        this.expandedSubChapterKey = null;
        this.chapterForm = {
          title: '',
          description: '',
        };
        this.loadingSubject = false;
      },
      error: () => {
        this.error = 'Failed to load subject details.';
        this.loadingSubject = false;
      },
    });
  }

  private loadInstructorQuizFileSubmissions(): void {
    this.loadingQuizFileSubmissions = true;
    this.quizSubmissionService.getInstructorQuizFileSubmissions().subscribe({
      next: (rows) => {
        this.instructorQuizFileSubmissions = Array.isArray(rows) ? rows : [];
        for (const row of this.instructorQuizFileSubmissions) {
          this.quizFileGradeForms[row._id] = {
            correctAnswersCount:
              typeof row.correctAnswersCount === 'number'
                ? row.correctAnswersCount
                : null,
            totalQuestionsCount:
              typeof row.totalQuestionsCount === 'number'
                ? row.totalQuestionsCount
                : null,
            teacherFeedback: String(row.teacherFeedback || ''),
          };
        }
        this.loadingQuizFileSubmissions = false;
      },
      error: () => {
        this.loadingQuizFileSubmissions = false;
      },
    });
  }

  private loadInstructorPrositSubmissions(): void {
    const instructorId = String(this.user?.id || this.user?._id || '').trim();
    if (!instructorId) {
      this.loadingPrositSubmissions = false;
      return;
    }

    this.loadingPrositSubmissions = true;
    this.prositSubmissionService
      .getInstructorPrositSubmissions(instructorId)
      .subscribe({
        next: (res) => {
          const rows = Array.isArray(res?.submissions) ? res.submissions : [];
          this.instructorPrositSubmissions = rows;
          for (const row of rows) {
            this.prositGradeForms[row._id] = {
              grade:
                typeof row.grade === 'number' && Number.isFinite(row.grade)
                  ? Number(row.grade)
                  : null,
              feedback: String(row.feedback || ''),
            };
          }
          this.loadingPrositSubmissions = false;
        },
        error: () => {
          this.loadingPrositSubmissions = false;
        },
      });
  }

  getSelectedSubjectQuizFileSubmissions(): QuizFileSubmissionResponse[] {
    const currentSubjectTitle = String(
      this.selectedSubject?.title || '',
    ).trim();
    if (!currentSubjectTitle) {
      return [];
    }

    return this.instructorQuizFileSubmissions.filter(
      (row) => String(row.subjectTitle || '').trim() === currentSubjectTitle,
    );
  }

  getSelectedSubjectPrositSubmissions(): PrositSubmissionResponse[] {
    const currentSubjectTitle = String(
      this.selectedSubject?.title || '',
    ).trim();
    if (!currentSubjectTitle) {
      return [];
    }
    return this.instructorPrositSubmissions.filter(
      (row) => String(row.subjectTitle || '').trim() === currentSubjectTitle,
    );
  }

  getGradeFormForSubmission(submissionId: string): QuizFileGradeFormModel {
    if (!this.quizFileGradeForms[submissionId]) {
      this.quizFileGradeForms[submissionId] = {
        correctAnswersCount: null,
        totalQuestionsCount: null,
        teacherFeedback: '',
      };
    }
    return this.quizFileGradeForms[submissionId];
  }

  getStudentDisplayName(submission: QuizFileSubmissionResponse): string {
    const student = submission.studentId;
    if (typeof student === 'string') {
      return 'Etudiant';
    }

    const firstName = String(student?.first_name || '').trim();
    const lastName = String(student?.last_name || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || String(student?.email || 'Etudiant').trim();
  }

  getPrositSubmissionFileUrl(
    submission: PrositSubmissionResponse,
  ): string | null {
    const path = String(submission?.filePath || '').trim();
    if (!path) {
      return null;
    }
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    if (path.startsWith('/')) {
      return `http://localhost:3000${path}`;
    }
    return null;
  }

  getPrositGradeForm(submissionId: string): PrositGradeFormModel {
    if (!this.prositGradeForms[submissionId]) {
      this.prositGradeForms[submissionId] = { grade: null, feedback: '' };
    }
    return this.prositGradeForms[submissionId];
  }

  gradePrositSubmission(submission: PrositSubmissionResponse): void {
    const form = this.getPrositGradeForm(submission._id);
    const grade = Number(form.grade);
    if (!Number.isFinite(grade) || grade < 0 || grade > 20) {
      this.error = 'La note du prosit doit etre entre 0 et 20.';
      return;
    }

    this.gradingPrositSubmissionId = submission._id;
    this.error = '';

    this.prositSubmissionService
      .gradePrositSubmission(submission._id, {
        grade,
        feedback: String(form.feedback || '').trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          const updated = res?.submission;
          if (updated) {
            this.instructorPrositSubmissions =
              this.instructorPrositSubmissions.map((row) =>
                row._id === updated._id ? updated : row,
              );
            this.prositGradeForms[updated._id] = {
              grade:
                typeof updated.grade === 'number'
                  ? updated.grade
                  : Number(form.grade),
              feedback: String(updated.feedback || form.feedback || ''),
            };
          }
          this.gradingPrositSubmissionId = null;
        },
        error: (err) => {
          this.error =
            err?.error?.message ||
            err?.error?.detail ||
            'Impossible de noter cette remise prosit.';
          this.gradingPrositSubmissionId = null;
        },
      });
  }

  toggleSubmissionPreview(submission: QuizFileSubmissionResponse): void {
    const submissionId = submission._id;
    const isOpen = this.expandedQuizSubmissionId === submissionId;
    this.expandedQuizSubmissionId = isOpen ? null : submissionId;

    if (isOpen) {
      return;
    }

    if (!this.quizFilePreviews[submissionId]) {
      this.quizFilePreviews[submissionId] = {
        loading: false,
        error: '',
        html: '',
        url: submission.responseFileUrl,
        type: String(
          submission.responseMimeType || submission.responseFileName || '',
        ).toLowerCase(),
      };
    }

    void this.loadSubmissionPreview(submission);
  }

  isSubmissionPreviewOpen(submissionId: string): boolean {
    return this.expandedQuizSubmissionId === submissionId;
  }

  private async loadSubmissionPreview(
    submission: QuizFileSubmissionResponse,
  ): Promise<void> {
    const submissionId = submission._id;
    const preview = (this.quizFilePreviews[submissionId] ||= {
      loading: false,
      error: '',
      html: '',
      url: submission.responseFileUrl,
      type: String(
        submission.responseMimeType || submission.responseFileName || '',
      ).toLowerCase(),
    });

    preview.loading = true;
    preview.error = '';
    preview.html = '';
    preview.url = submission.responseFileUrl;

    try {
      const response = await fetch(submission.responseFileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = String(
        response.headers.get('content-type') || '',
      ).toLowerCase();
      const fileName = String(submission.responseFileName || '').toLowerCase();
      const isPdf = contentType.includes('pdf') || fileName.endsWith('.pdf');
      const isDocx =
        contentType.includes('officedocument') || fileName.endsWith('.docx');

      if (isPdf) {
        preview.type = 'pdf';
        preview.url = submission.responseFileUrl;
      } else if (isDocx) {
        preview.type = 'docx';
        const arrayBuffer = await response.arrayBuffer();
        const mammothModule: any = await import('mammoth/mammoth.browser');
        const result = await mammothModule.convertToHtml({ arrayBuffer });
        preview.html = String(result?.value || '').trim();
        if (!preview.html) {
          preview.error = 'Apercu indisponible pour ce document DOCX.';
        }
      } else {
        preview.type = 'link';
        preview.url = submission.responseFileUrl;
      }
    } catch (error: any) {
      preview.error = error?.message || 'Impossible de charger la remise.';
    } finally {
      preview.loading = false;
    }
  }

  getComputedQuizFileGrade(submissionId: string): number | null {
    const form = this.getGradeFormForSubmission(submissionId);
    const correct = Number(form.correctAnswersCount);
    const total = Number(form.totalQuestionsCount);
    if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) {
      return null;
    }
    if (correct < 0 || correct > total) {
      return null;
    }
    return Math.round((correct / total) * 10000) / 100;
  }

  isSubmissionFormLocked(submission: QuizFileSubmissionResponse): boolean {
    return submission.status === 'graded';
  }

  gradeQuizFileSubmission(submission: QuizFileSubmissionResponse): void {
    const form = this.getGradeFormForSubmission(submission._id);
    const computedGrade = this.getComputedQuizFileGrade(submission._id);

    if (computedGrade === null) {
      this.error =
        'Saisissez un nombre valide de reponses correctes et de questions totales.';
      return;
    }

    this.gradingQuizSubmissionId = submission._id;
    this.error = '';

    this.quizSubmissionService
      .gradeQuizFileSubmission(submission._id, {
        grade: computedGrade,
        teacherFeedback: String(form.teacherFeedback || '').trim() || undefined,
        correctAnswersCount: Number(form.correctAnswersCount),
        totalQuestionsCount: Number(form.totalQuestionsCount),
      })
      .subscribe({
        next: (updated) => {
          this.instructorQuizFileSubmissions =
            this.instructorQuizFileSubmissions.map((row) =>
              row._id === updated._id ? updated : row,
            );
          this.quizFileGradeForms[updated._id] = {
            correctAnswersCount:
              typeof updated.correctAnswersCount === 'number'
                ? updated.correctAnswersCount
                : Number(form.correctAnswersCount),
            totalQuestionsCount:
              typeof updated.totalQuestionsCount === 'number'
                ? updated.totalQuestionsCount
                : Number(form.totalQuestionsCount),
            teacherFeedback: String(
              updated.teacherFeedback || form.teacherFeedback || '',
            ),
          };
          this.gradingQuizSubmissionId = null;
        },
        error: (err) => {
          this.error =
            err?.error?.message ||
            err?.error?.detail ||
            'Impossible de noter cette remise.';
          this.gradingQuizSubmissionId = null;
        },
      });
  }

  goToSubject(subjectId: string | undefined): void {
    const id = subjectId != null ? String(subjectId).trim() : '';
    if (!id) {
      return;
    }
    this.router.navigate(['/instructor/subjects', id], {
      queryParams: { classId: this.selectedClassId }
    });
  }

  goBackToList(): void {
    this.router.navigate(['/instructor/subjects'], {
      queryParams: { classId: this.selectedClassId }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  manageAccount(): void {
    this.router.navigate(['/profile']);
  }

  createSubject(): void {
    const instructorId = this.user?.id || this.user?._id;
    if (!instructorId) {
      this.error = 'Instructor ID not found.';
      return;
    }
    const title = this.subjectForm.title.trim();
    const description = this.subjectForm.description.trim();

    if (!title) {
      this.error = 'Subject title is required.';
      return;
    }

    this.savingSubject = true;
    this.error = '';

    this.subjectsService
      .createSubject({
        title,
        description,
        instructorId: String(instructorId),
      })
      .subscribe({
        next: (subject) => {
          this.subjectForm = { title: '', description: '' };
          this.subjects = [subject, ...this.subjects].sort((a, b) =>
            a.title.localeCompare(b.title),
          );
          this.savingSubject = false;
          this.goToSubject(subject._id);
        },
        error: () => {
          this.error = 'Failed to create subject.';
          this.savingSubject = false;
        },
      });
  }

  addChapter(): void {
    if (!this.selectedSubject?._id) {
      return;
    }

    const title = this.chapterForm.title.trim();
    const description = this.chapterForm.description.trim();
    const order = this.selectedSubject?.chapters?.length ?? 0;

    if (!title) {
      this.error = 'Chapter title is required.';
      return;
    }

    this.savingChapter = true;
    this.error = '';

    this.subjectsService
      .addChapter(this.selectedSubject._id, {
        title,
        description,
        order,
      })
      .subscribe({
        next: (subject) => {
          this.selectedSubject = subject;
          this.subjects = this.subjects.map((item) =>
            item._id === subject._id ? subject : item,
          );
          this.chapterForm = {
            title: '',
            description: '',
          };
          this.savingChapter = false;
        },
        error: () => {
          this.error = 'Failed to add chapter.';
          this.savingChapter = false;
        },
      });
  }

  // ============ SUBCHAPTER MANAGEMENT ============

  openSubChapterForm(chapterOrder: number): void {
    const order = Number(chapterOrder);
    // Expand this chapter so the subchapter form (nested under expanded content) is visible.
    this.expandedChapterOrder = order;
    this.activeSubChapterFormChapterOrder = order;
    this.subChapterForm = { title: '', description: '' };
  }

  cancelSubChapterForm(): void {
    this.activeSubChapterFormChapterOrder = null;
    this.subChapterForm = { title: '', description: '' };
  }

  addSubChapter(chapterOrder: number): void {
    if (!this.selectedSubject?._id) {
      return;
    }

    const order = Number(chapterOrder);
    const chapter = this.selectedSubject.chapters?.find(
      (ch) => Number(ch.order) === order,
    );
    if (!chapter) {
      this.error = 'Chapter not found.';
      return;
    }

    const title = this.subChapterForm.title.trim();
    const description = this.subChapterForm.description.trim();

    if (!title) {
      this.error = 'SubChapter title is required.';
      return;
    }

    const subChapterOrder = (chapter.subChapters?.length ?? 0) + 1;

    this.savingSubChapter = true;
    this.error = '';

    this.subjectsService
      .addSubChapter(this.selectedSubject._id, order, {
        title,
        description,
        order: subChapterOrder,
      })
      .subscribe({
        next: (subject) => {
          this.selectedSubject = subject;
          this.subjects = this.subjects.map((item) =>
            item._id === subject._id ? subject : item,
          );
          this.cancelSubChapterForm();
          this.savingSubChapter = false;
        },
        error: () => {
          this.error = 'Failed to add subchapter.';
          this.savingSubChapter = false;
        },
      });
  }

  deleteChapter(chapterOrder: number): void {
    if (!this.selectedSubject?._id) {
      this.error = 'Unable to delete chapter (missing subject).';
      return;
    }

    const ok = confirm('Delete this chapter and all its subchapters/contents?');
    if (!ok) {
      return;
    }

    this.error = '';
    this.subjectsService
      .deleteChapter(this.selectedSubject._id, chapterOrder)
      .subscribe({
        next: (subject) => {
          this.selectedSubject = this.normalizeContentFolders(subject);
          this.subjects = this.subjects.map((item) =>
            item._id === subject._id ? this.selectedSubject! : item,
          );

          if (this.expandedChapterOrder === chapterOrder) {
            this.expandedChapterOrder = null;
          }
        },
        error: (err) => {
          this.error =
            err?.error?.message ||
            err?.error?.detail ||
            'Failed to delete chapter.';
        },
      });
  }

  toggleSubChapter(chapterOrder: number, subChapterOrder: number): void {
    const key = `${chapterOrder}_${subChapterOrder}`;
    if (this.expandedSubChapterKey === key) {
      this.expandedSubChapterKey = null;
      if (
        this.activeSubChapterChapterOrder === chapterOrder &&
        this.activeSubChapterSubOrder === subChapterOrder
      ) {
        this.cancelContentForm();
      }
      return;
    }

    this.expandedSubChapterKey = key;
    if (!this.activeFolderBySubChapter[key]) {
      this.activeFolderBySubChapter[key] = 'cours';
    }
  }

  getActiveFolderForSubChapter(
    chapterOrder: number,
    subChapterOrder: number,
  ): 'cours' | 'exercices' | 'videos' | 'ressources' {
    const key = `${chapterOrder}_${subChapterOrder}`;
    return this.activeFolderBySubChapter[key] || 'cours';
  }

  setActiveFolderForSubChapter(
    chapterOrder: number,
    subChapterOrder: number,
    folder: 'cours' | 'exercices' | 'videos' | 'ressources',
  ): void {
    const key = `${chapterOrder}_${subChapterOrder}`;
    this.activeFolderBySubChapter[key] = folder;
  }

  toggleChapter(chapterOrder: number): void {
    if (this.expandedChapterOrder === chapterOrder) {
      this.expandedChapterOrder = null;
      if (this.activeContentChapterOrder === chapterOrder) {
        this.cancelContentForm();
      }
      return;
    }

    this.expandedChapterOrder = chapterOrder;
  }

  // ============ CONTENT MANAGEMENT ============

  openContentForm(
    chapterOrder: number,
    subChapterOrder: number,
    folder: 'cours' | 'exercices' | 'videos' | 'ressources' = 'cours',
  ): void {
    this.cancelSubChapterForm();
    this.expandedSubChapterKey = `${chapterOrder}_${subChapterOrder}`;
    this.setActiveFolderForSubChapter(chapterOrder, subChapterOrder, folder);
    this.activeSubChapterChapterOrder = chapterOrder;
    this.activeSubChapterSubOrder = subChapterOrder;
    this.activeContentChapterOrder = chapterOrder;
    this.editingContentId = null;
    this.resetContentForm();
    this.chapterContentForm.folder = folder;
    this.applyFolderDefaultType();
    this.showContentModal = true;
  }

  getContentsByFolder(
    subChapter: SubjectSubChapter,
    folder: 'cours' | 'exercices' | 'videos' | 'ressources',
  ): SubjectChapterContent[] {
    return (subChapter.contents || []).filter(
      (content) => this.resolveContentFolder(content) === folder,
    );
  }

  resolveContentFolder(
    content: SubjectChapterContent,
  ): 'cours' | 'exercices' | 'videos' | 'ressources' {
    if (content.folder) {
      return content.folder;
    }

    if (content.type === 'quiz' || content.type === 'prosit') {
      return 'exercices';
    }
    if (content.type === 'video') {
      return 'videos';
    }
    if (content.type === 'code') {
      return 'ressources';
    }
    return 'cours';
  }

  private normalizeContentFolders(subject: SubjectItem): SubjectItem {
    for (const chapter of subject.chapters || []) {
      for (const subChapter of chapter.subChapters || []) {
        subChapter.contents = (subChapter.contents || []).map((content) => ({
          ...content,
          folder: this.resolveContentFolder(content),
        }));
      }
    }
    return subject;
  }

  private ensureContentPresentAfterAdd(
    subject: SubjectItem,
    chapterOrder: number,
    subChapterOrder: number,
    payload: {
      folder: 'cours' | 'exercices' | 'videos' | 'ressources';
      type: 'file' | 'quiz' | 'video' | 'link' | 'prosit' | 'code';
      title: string;
      url?: string;
      quizQuestions?: SubjectQuizQuestion[];
      fileName?: string;
      mimeType?: string;
      dueDate?: string;
      submissionInstructions?: string;
      codeSnippet?: string;
    },
  ): SubjectItem {
    const chapter = (subject.chapters || []).find(
      (item) => Number(item.order) === Number(chapterOrder),
    );
    const subChapter = (chapter?.subChapters || []).find(
      (item) => Number(item.order) === Number(subChapterOrder),
    );
    if (!subChapter) {
      return subject;
    }

    subChapter.contents = subChapter.contents || [];
    const exists = subChapter.contents.some((content) => {
      const sameFolder = this.resolveContentFolder(content) === payload.folder;
      const sameType = content.type === payload.type;
      const sameTitle = content.title === payload.title;
      const sameFile = (content.fileName || '') === (payload.fileName || '');
      return sameFolder && sameType && sameTitle && sameFile;
    });

    if (!exists) {
      subChapter.contents.push({
        folder: payload.folder,
        type: payload.type,
        title: payload.title,
        url: payload.url,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        dueDate: payload.dueDate,
        submissionInstructions: payload.submissionInstructions,
        codeSnippet: payload.codeSnippet,
        quizQuestions: payload.quizQuestions,
        createdAt: new Date().toISOString(),
      });
    }

    return subject;
  }

  getAllowedTypesForFolder(): Array<
    'file' | 'quiz' | 'video' | 'link' | 'prosit' | 'code'
  > {
    const folder = this.chapterContentForm.folder;
    if (folder === 'cours') {
      return ['file'];
    }
    if (folder === 'exercices') {
      return ['quiz', 'prosit'];
    }
    if (folder === 'videos') {
      return ['video', 'link'];
    }
    return ['link', 'code'];
  }

  onFolderChange(): void {
    this.applyFolderDefaultType();
    this.onContentTypeChange();
  }

  private applyFolderDefaultType(): void {
    const allowedTypes = this.getAllowedTypesForFolder();
    if (!allowedTypes.includes(this.chapterContentForm.type)) {
      this.chapterContentForm.type = allowedTypes[0];
    }
  }

  cancelContentForm(): void {
    this.activeSubChapterChapterOrder = null;
    this.activeSubChapterSubOrder = null;
    this.activeContentChapterOrder = null;
    this.editingContentId = null;
    this.resetContentForm();
    this.showContentModal = false;
  }

  startEditQuiz(
    chapterOrder: number,
    subChapterOrder: number,
    content: SubjectChapterContent,
  ): void {
    if (content.type !== 'quiz' || !content.contentId) {
      return;
    }

    const mappedQuestions = (content.quizQuestions || []).map((question) => ({
      question: String(question.question || ''),
      options:
        Array.isArray(question.options) && question.options.length >= 2
          ? question.options.map((option) => String(option || ''))
          : ['', ''],
      correctOptionIndex:
        typeof question.correctOptionIndex === 'number'
          ? question.correctOptionIndex
          : null,
    }));

    this.activeSubChapterChapterOrder = chapterOrder;
    this.activeSubChapterSubOrder = subChapterOrder;
    this.expandedSubChapterKey = `${chapterOrder}_${subChapterOrder}`;
    this.activeContentChapterOrder = chapterOrder;
    this.editingContentId = content.contentId;
    this.chapterContentForm = {
      folder: (content.folder as any) || 'exercices',
      type: 'quiz',
      title: String(content.title || ''),
      url: content.url || '',
      dueDate: '',
      submissionInstructions: '',
      codeSnippet: '',
      quizQuestions: mappedQuestions.length
        ? mappedQuestions
        : [this.createEmptyQuizQuestion()],
      quizMode: content.quizQuestions?.length ? 'inline' : 'file', // Infer mode from content
    };
    this.setActiveFolderForSubChapter(
      chapterOrder,
      subChapterOrder,
      this.chapterContentForm.folder,
    );

    if (this.chapterContentForm.quizMode === 'file' && content.url) {
      this.originalQuizFileExtension = content.url.split('.').pop()?.toLowerCase() || '';
      this.isEditingQuizFileContent = true;
      this.extractQuizFileContent(content.url);
    } else {
      this.originalQuizFileExtension = '';
      this.isEditingQuizFileContent = false;
    }

    this.showContentModal = true;
  }

  async extractQuizFileContent(url: string) {
    const isDocx = url.toLowerCase().endsWith('.docx') || url.toLowerCase().endsWith('.doc');
    if (!isDocx) return;

    this.loadingQuizFileContent = true;
    try {
      const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
      const response = await fetch(fullUrl);
      const arrayBuffer = await response.arrayBuffer();
      const mammothModule: any = await import('mammoth/mammoth.browser');
      const result = await mammothModule.extractRawText({ arrayBuffer });
      this.quizFileContent = result.value;
    } catch (err) {
      console.error('Failed to extract quiz content', err);
    } finally {
      this.loadingQuizFileContent = false;
    }
  }

  onContentTypeChange(): void {
    this.applyFolderDefaultType();
    if (
      this.chapterContentForm.type === 'quiz' &&
      (!this.chapterContentForm.quizQuestions ||
        !this.chapterContentForm.quizQuestions.length)
    ) {
      this.chapterContentForm.quizQuestions = [this.createEmptyQuizQuestion()];
    }
  }

  deleteSubChapterContent(
    chapterOrder: number,
    subChapterOrder: number,
    contentId?: string,
  ): void {
    if (!this.selectedSubject?._id || !contentId) {
      this.error = 'Unable to delete this content (missing identifier).';
      return;
    }

    const ok = confirm('Delete this content item?');
    if (!ok) {
      return;
    }

    this.error = '';
    this.subjectsService
      .deleteSubChapterContent(
        this.selectedSubject._id,
        chapterOrder,
        subChapterOrder,
        contentId,
      )
      .subscribe({
        next: (updated) => {
          this.selectedSubject = this.normalizeContentFolders(updated);
          this.subjects = this.subjects.map((item) =>
            item._id === updated._id ? updated : item,
          );
          if (this.editingContentId === contentId) {
            this.cancelContentForm();
          }
        },
        error: (err) => {
          this.error =
            err?.error?.message ||
            err?.error?.detail ||
            'Failed to delete content.';
        },
      });
  }

  onChapterFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = (input.files && input.files[0]) || null;

    // Vérification spécifique pour l'upload vidéo : uniquement mp4
    if (this.chapterContentForm.type === 'video') {
      if (file && file.type !== 'video/mp4') {
        this.error = 'Seuls les fichiers MP4 sont acceptés pour les vidéos.';
        this.selectedChapterFile = null;
        return;
      }
      this.selectedChapterFile = file;
    } else if (this.chapterContentForm.type === 'quiz') {
      this.selectedQuizFile = file;
    } else {
      this.selectedChapterFile = file;
    }

    if (file && !this.chapterContentForm.title.trim()) {
      this.chapterContentForm.title = file.name;
    }
  }

  async addContentToSubChapter(
    chapterOrder: number,
    subChapterOrder: number,
  ): Promise<void> {
    if (!this.selectedSubject?._id) {
      return;
    }

    const type = this.chapterContentForm.type;
    const folder = this.chapterContentForm.folder;
    const title = this.chapterContentForm.title.trim();
    const url = this.chapterContentForm.url.trim();
    const dueDate = this.chapterContentForm.dueDate.trim();
    const submissionInstructions =
      this.chapterContentForm.submissionInstructions.trim();
    const codeSnippet = this.chapterContentForm.codeSnippet.trim();
    const quizQuestions = (this.chapterContentForm.quizQuestions || []).map(
      (item) => ({
        question: String(item.question || '').trim(),
        options: (item.options || []).map((option) =>
          String(option || '').trim(),
        ),
        correctOptionIndex:
          item.correctOptionIndex === null ||
          item.correctOptionIndex === undefined
            ? null
            : Number(item.correctOptionIndex),
      }),
    );

    if (
      type === 'quiz' &&
      this.chapterContentForm.quizMode === 'file' &&
      this.isEditingQuizFileContent &&
      this.quizFileContent
    ) {
      const ext = this.originalQuizFileExtension || 'docx';
      let blob: Blob;
      let mimeType: string;

      if (ext === 'pdf') {
        // Fallback for PDF: we can't easily generate a binary PDF from text, 
        // but we'll use a text-based blob with PDF mime type to try to satisfy backend.
        // NOTE: This might still fail in some strict PDF viewers, but satisfies the user request for format.
        blob = new Blob([this.quizFileContent], { type: 'application/pdf' });
        mimeType = 'application/pdf';
      } else {
        // For Word (.doc, .docx): Use HTML-wrapped text which Word can open perfectly
        const htmlContent = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset='utf-8'></head>
          <body style="font-family: Arial, sans-serif;">${this.quizFileContent.replace(/\n/g, '<br>')}</body>
          </html>
        `;
        blob = new Blob([htmlContent], { type: 'application/msword' });
        mimeType = ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword';
      }

      const fileName = (title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'quiz') + '.' + ext;
      this.selectedQuizFile = new File([blob], fileName, { type: mimeType });
    }

    if (!title) {
      this.error = 'Content title is required.';
      return;
    }

    const allowedTypes = this.getAllowedTypesForFolder();
    if (!allowedTypes.includes(type)) {
      this.error =
        'Type de contenu invalide pour ce dossier (cours/exercices/videos/ressources).';
      return;
    }

    if (type === 'link' && !url) {
      this.error = 'URL is required for link content.';
      return;
    }

    if (type === 'prosit') {
      if (!dueDate) {
        this.error = "Date d'echeance requise pour le prosit.";
        return;
      }
      if (!submissionInstructions && !this.selectedChapterFile) {
        this.error =
          "Ajoute un fichier d'instructions OU saisis les consignes du prosit.";
        return;
      }
    }

    if (type === 'code' && !codeSnippet) {
      this.error = 'Merci de saisir le code/ressource additionnelle.';
      return;
    }

    if (type === 'quiz') {
      const quizMode = this.chapterContentForm.quizMode || 'inline';

      if (quizMode === 'inline') {
        // Inline mode: must have questions
        if (!quizQuestions.length) {
          this.error = 'Add at least one quiz question.';
          return;
        }

        // Validate inline questions
        for (let i = 0; i < quizQuestions.length; i += 1) {
          const question = quizQuestions[i];
          if (!question.question) {
            this.error = `Question ${i + 1}: question text is required.`;
            return;
          }

          if (
            question.options.length < 2 ||
            question.options.some((option) => !option)
          ) {
            this.error = `Question ${i + 1}: provide at least 2 options.`;
            return;
          }

          if (
            question.correctOptionIndex === null ||
            Number.isNaN(question.correctOptionIndex) ||
            question.correctOptionIndex < 0 ||
            question.correctOptionIndex >= question.options.length
          ) {
            this.error = `Question ${i + 1}: select a valid correct option.`;
            return;
          }
        }
      } else if (quizMode === 'file') {
        // File mode: must have file selected
        if (!this.selectedQuizFile) {
          this.error = 'Please upload a quiz file.';
          return;
        }
      }
    }

    this.savingChapterContent = true;
    this.error = '';

    try {
      let payload: {
        folder: 'cours' | 'exercices' | 'videos' | 'ressources';
        type: 'file' | 'quiz' | 'video' | 'link' | 'prosit' | 'code';
        title: string;
        url?: string;
        quizText?: string;
        quizQuestions?: SubjectQuizQuestion[];
        fileName?: string;
        mimeType?: string;
        dueDate?: string;
        submissionInstructions?: string;
        codeSnippet?: string;
      } = {
        folder,
        type,
        title,
      };

      if (type === 'file' || type === 'video') {
        if (!this.selectedChapterFile) {
          throw new Error('Please choose a file first.');
        }

        this.uploadingChapterFile = true;
        const uploadResult = await this.uploadChapterFile(
          this.selectedSubject._id,
          chapterOrder,
          subChapterOrder,
          this.selectedChapterFile,
        );
        this.uploadingChapterFile = false;

        // Use only the path part for the URL (relative to server root)
        let fileUrl =
          uploadResult?.url ||
          uploadResult?.fileUrl ||
          uploadResult?.file_url ||
          uploadResult?.download_url ||
          undefined;
        if (fileUrl && fileUrl.startsWith('http')) {
          try {
            const urlObj = new URL(fileUrl);
            fileUrl = urlObj.pathname + urlObj.search;
          } catch (e) {
            // fallback: leave as is
          }
        }

        payload = {
          ...payload,
          fileName: this.selectedChapterFile.name,
          mimeType: this.selectedChapterFile.type || undefined,
        };
        // N'ajoute url que pour 'file', jamais pour 'video'
        if (type === 'file') {
          payload.url = fileUrl;
        }
      }

    if (type === 'video') {
  if (!this.selectedChapterFile && url) {
    payload = { ...payload, url };
  } else if (this.selectedChapterFile) {
    // Upload déjà fait au-dessus → récupère l'url
    this.uploadingChapterFile = true;
    const uploadResult = await this.uploadChapterFile(
      this.selectedSubject._id,
      chapterOrder,
      subChapterOrder,
      this.selectedChapterFile,
    );
    this.uploadingChapterFile = false;

    let fileUrl =
      uploadResult?.url ||
      uploadResult?.fileUrl ||
      uploadResult?.file_url ||
      uploadResult?.download_url ||
      undefined;

    if (fileUrl && fileUrl.startsWith('http')) {
      try {
        const urlObj = new URL(fileUrl);
        fileUrl = urlObj.pathname + urlObj.search;
      } catch (e) {}
    }

    payload = {
      ...payload,
      url: fileUrl,
      fileName: this.selectedChapterFile.name,
      mimeType: this.selectedChapterFile.type || undefined,
    };
  }
} else if (type === 'link') {
        payload = {
          ...payload,
          url,
        };
      }

      if (type === 'prosit') {
        payload = {
          ...payload,
          dueDate,
          submissionInstructions: submissionInstructions || undefined,
        };

        if (this.selectedChapterFile) {
          this.uploadingChapterFile = true;
          const uploadResult = await this.uploadChapterFile(
            this.selectedSubject._id,
            chapterOrder,
            subChapterOrder,
            this.selectedChapterFile,
          );
          this.uploadingChapterFile = false;

          let fileUrl =
            uploadResult?.url ||
            uploadResult?.fileUrl ||
            uploadResult?.file_url ||
            uploadResult?.download_url ||
            undefined;
          if (fileUrl && fileUrl.startsWith('http')) {
            try {
              const urlObj = new URL(fileUrl);
              fileUrl = urlObj.pathname + urlObj.search;
            } catch (e) {
              // fallback: leave as is
            }
          }

          payload = {
            ...payload,
            fileName: this.selectedChapterFile.name,
            mimeType: this.selectedChapterFile.type || undefined,
            url: fileUrl,
          };
        }
      }

      if (type === 'code') {
        payload = {
          ...payload,
          codeSnippet,
        };
      }

      if (type === 'quiz') {
        const quizMode = this.chapterContentForm.quizMode || 'inline';

        // Only send questions if in inline mode
        if (quizMode === 'inline') {
          payload = {
            ...payload,
            quizQuestions: quizQuestions.map((question) => ({
              question: question.question,
              options: question.options,
              correctOptionIndex: Number(question.correctOptionIndex),
            })),
          };
        }

        // If quiz file is selected, upload it
        if (this.selectedQuizFile) {
          this.uploadingChapterFile = true;
          const uploadResult = await this.uploadChapterFile(
            this.selectedSubject._id,
            chapterOrder,
            subChapterOrder,
            this.selectedQuizFile,
          );
          this.uploadingChapterFile = false;

          let fileUrl =
            uploadResult?.url ||
            uploadResult?.fileUrl ||
            uploadResult?.file_url ||
            uploadResult?.download_url ||
            undefined;
          if (fileUrl && fileUrl.startsWith('http')) {
            try {
              const urlObj = new URL(fileUrl);
              fileUrl = urlObj.pathname + urlObj.search;
            } catch (e) {
              // fallback: leave as is
            }
          }

          payload = {
            ...payload,
            fileName: this.selectedQuizFile.name,
            mimeType: this.selectedQuizFile.type || undefined,
            url: fileUrl,
          };
        }
      }

      const updated = this.editingContentId
        ? await firstValueFrom(
            this.subjectsService.updateSubChapterContent(
              this.selectedSubject._id,
              chapterOrder,
              subChapterOrder,
              this.editingContentId,
              payload,
            ),
          )
        : await firstValueFrom(
            this.subjectsService.addSubChapterContent(
              this.selectedSubject._id,
              chapterOrder,
              subChapterOrder,
              payload,
            ),
          );

      const hydrated = this.editingContentId
        ? updated
        : this.ensureContentPresentAfterAdd(
            updated,
            chapterOrder,
            subChapterOrder,
            payload,
          );

      this.selectedSubject = this.normalizeContentFolders(hydrated);
      this.subjects = this.subjects.map((item) =>
        item._id === updated._id ? hydrated : item,
      );
      this.showContentModal = false;
      this.cancelContentForm();
      this.savingChapterContent = false;
    } catch (err: any) {
      this.uploadingChapterFile = false;
      this.savingChapterContent = false;
      this.error =
        err?.error?.message ||
        err?.error?.detail ||
        err?.message ||
        'Failed to add content.';
    }
  }

  private resetContentForm(): void {
    this.chapterContentForm = {
      folder: 'cours',
      type: 'file',
      title: '',
      url: '',
      dueDate: '',
      submissionInstructions: '',
      codeSnippet: '',
      quizQuestions: [this.createEmptyQuizQuestion()],
      quizMode: 'inline',
    };
    this.selectedChapterFile = null;
    this.selectedQuizFile = null;
    this.isEditingQuizFileContent = false;
    this.quizFileContent = '';
    this.loadingQuizFileContent = false;
  }

  addQuizQuestion(): void {
    this.chapterContentForm.quizQuestions.push(this.createEmptyQuizQuestion());
  }

  removeQuizQuestion(index: number): void {
    if (this.chapterContentForm.quizQuestions.length <= 1) {
      this.chapterContentForm.quizQuestions = [this.createEmptyQuizQuestion()];
      return;
    }

    this.chapterContentForm.quizQuestions.splice(index, 1);
  }

  addQuizOption(questionIndex: number): void {
    const question = this.chapterContentForm.quizQuestions[questionIndex];
    if (!question) {
      return;
    }

    question.options.push('');
  }

  removeQuizOption(questionIndex: number, optionIndex: number): void {
    const question = this.chapterContentForm.quizQuestions[questionIndex];
    if (!question || question.options.length <= 2) {
      return;
    }

    question.options.splice(optionIndex, 1);
    if (
      question.correctOptionIndex !== null &&
      question.correctOptionIndex >= question.options.length
    ) {
      question.correctOptionIndex = null;
    }
  }

  setCorrectOption(questionIndex: number, optionIndex: number): void {
    const question = this.chapterContentForm.quizQuestions[questionIndex];
    if (!question) {
      return;
    }

    question.correctOptionIndex = optionIndex;
  }

  private createEmptyQuizQuestion(): QuizQuestionFormModel {
    return {
      question: '',
      options: ['', ''],
      correctOptionIndex: null,
    };
  }

  private async uploadChapterFile(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    file: File,
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subjectId', subjectId);
    formData.append('chapterOrder', String(chapterOrder));
    formData.append('subChapterOrder', String(subChapterOrder));

    // Ajoute ?type=video si c'est une vidéo, sinon rien
    let url = `${this.subjectsApiUrl}/upload-file`;
    if (this.chapterContentForm.type === 'video') {
      url += '?type=video';
    }
    return firstValueFrom(this.http.post(url, formData));
  }


    startEditProsit(
    chapterOrder: number,
    subChapterOrder: number,
    content: any,
  ): void {
    this.editingContentId = content.contentId;
    this.activeSubChapterChapterOrder = chapterOrder;
    this.activeSubChapterSubOrder = subChapterOrder;
    this.activeContentChapterOrder = chapterOrder;

    // Format date for datetime-local input
    let formattedDate = '';
    if (content.dueDate) {
      const d = new Date(content.dueDate);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }

    // Map existing content to the unified form
    this.chapterContentForm = {
      folder: 'exercices',
      type: 'prosit',
      title: content.title,
      url: content.url || '',
      dueDate: formattedDate,
      submissionInstructions: content.submissionInstructions || '',
      codeSnippet: content.codeSnippet || '',
      quizQuestions: content.quizQuestions || [],
      quizMode: content.quizMode || 'inline',
    };

    this.showContentModal = true;
  }

}
