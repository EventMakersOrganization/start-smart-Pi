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
  SubjectItem,
  SubjectChapter,
  SubjectChapterContent,
  SubjectQuizQuestion,
  SubjectSubChapter,
  SubjectsService,
} from '../subjects.service';

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

@Component({
  selector: 'app-instructor-subjects',
  templateUrl: './instructor-subjects.component.html',
  styleUrls: ['./instructor-subjects.component.css'],
})
export class InstructorSubjectsComponent implements OnInit, OnDestroy {
  readonly folderLabels: Record<
    'cours' | 'exercices' | 'videos' | 'ressources',
    string
  > = {
    cours: 'Dossier Cours',
    exercices: 'Dossier Exercices',
    videos: 'Dossier Videos',
    ressources: 'Dossier Ressources Additionnelles',
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

  // File upload state
  selectedChapterFile: File | null = null;
  selectedQuizFile: File | null = null;
  uploadingChapterFile = false;
  loadingQuizFileSubmissions = false;
  gradingQuizSubmissionId: string | null = null;
  instructorQuizFileSubmissions: QuizFileSubmissionResponse[] = [];
  quizFileGradeForms: Record<string, QuizFileGradeFormModel> = {};
  expandedQuizSubmissionId: string | null = null;
  quizFilePreviews: Record<string, QuizFilePreviewState> = {};

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
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
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
        this.subjects = Array.isArray(rows) ? rows : [];
        if (selectedSubjectId) {
          const found = this.subjects.find(
            (subject) => subject._id === selectedSubjectId,
          );
          if (found) {
            this.selectedSubject = found;
          }
        }
        this.loadingSubjects = false;
      },
      error: () => {
        this.error = 'Failed to load subjects.';
        this.loadingSubjects = false;
      },
    });
  }

  private loadSubjectDetail(subjectId: string): void {
    this.loadingSubject = true;
    this.error = '';

    this.subjectsService.getSubject(subjectId).subscribe({
      next: (subject) => {
        this.selectedSubject = this.normalizeContentFolders(subject);
        this.loadInstructorQuizFileSubmissions();
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

  goToSubject(subjectId: string): void {
    this.router.navigate(['/instructor/subjects', subjectId]);
  }

  goBackToList(): void {
    this.router.navigate(['/instructor/subjects']);
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
    this.activeSubChapterFormChapterOrder = chapterOrder;
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

    const chapter = this.selectedSubject.chapters?.find(
      (ch) => ch.order === chapterOrder,
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
      .addSubChapter(this.selectedSubject._id, chapterOrder, {
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
  }

  getContentsByFolder(
    subChapter: SubjectSubChapter,
    folder: 'cours' | 'exercices' | 'videos' | 'ressources',
  ): SubjectChapterContent[] {
    return (subChapter.contents || []).filter(
      (content) => this.resolveContentFolder(content) === folder,
    );
  }

  private resolveContentFolder(
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
      return ['file', 'link'];
    }
    if (folder === 'exercices') {
      return ['quiz', 'prosit'];
    }
    if (folder === 'videos') {
      return ['video', 'file'];
    }
    return ['file', 'link', 'code'];
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
      url: '',
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

    // Determine which file variable to populate based on content type
    if (this.chapterContentForm.type === 'quiz') {
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

    if ((type === 'video' || type === 'link') && !url) {
      this.error = 'URL is required for link/video content.';
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

      if (type === 'file') {
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

        payload = {
          ...payload,
          fileName: this.selectedChapterFile.name,
          mimeType: this.selectedChapterFile.type || undefined,
          url:
            uploadResult?.url ||
            uploadResult?.fileUrl ||
            uploadResult?.file_url ||
            uploadResult?.download_url ||
            undefined,
        };
      }

      if (type === 'video' || type === 'link') {
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

          payload = {
            ...payload,
            fileName: this.selectedChapterFile.name,
            mimeType: this.selectedChapterFile.type || undefined,
            url:
              uploadResult?.url ||
              uploadResult?.fileUrl ||
              uploadResult?.file_url ||
              uploadResult?.download_url ||
              undefined,
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

          payload = {
            ...payload,
            fileName: this.selectedQuizFile.name,
            mimeType: this.selectedQuizFile.type || undefined,
            url:
              uploadResult?.url ||
              uploadResult?.fileUrl ||
              uploadResult?.file_url ||
              uploadResult?.download_url ||
              undefined,
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

    return firstValueFrom(
      this.http.post(`${this.subjectsApiUrl}/upload-file`, formData),
    );
  }
}
