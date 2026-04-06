import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { QuizSubmissionService } from '../quiz-submission.service';
import {
  SubjectChapterContent,
  SubjectItem as DbSubjectItem,
  SubjectSubChapter,
  SubjectsService,
} from '../subjects.service';

interface CourseModule {
  title: string;
  description: string;
  order: number;
}

interface CourseItem {
  id: string;
  title: string;
  description: string;
  instructor: string;
  subject: string;
  modules: CourseModule[];
  moduleCount: number;
  thumbnail: string;
  sourceSubChapters?: SubjectSubChapter[];
}

interface SubjectItem {
  name: string;
  count: number;
  courses: CourseItem[];
  color: string;
  loaded?: boolean;
  source?: 'subject' | 'course_title';
  includeAllTitles?: boolean;
}

interface CourseContentResource {
  title: string;
  subtitle: string;
  type: 'pdf' | 'word' | 'quiz' | 'exercise';
}

type FolderKey = 'cours' | 'exercices' | 'videos' | 'ressources';

interface SubchapterFolderItem {
  contentId?: string;
  title: string;
  subtitle?: string;
  type: string;
  url?: string;
  codeSnippet?: string;
  dueDate?: string;
  submissionInstructions?: string;
  quizId?: string;
  quizQuestions?: QuizQuestionCard[];
}

interface QuizQuestionCard {
  question: string;
  options: string[];
  correctOptionIndex?: number;
}

interface QuizViewModel {
  title: string;
  chapterTitle: string;
  subChapterTitle: string;
  quizId: string;
  questions: QuizQuestionCard[];
}

interface QuizFileViewModel {
  quizId: string;
  title: string;
  chapterTitle: string;
  subChapterTitle: string;
  instructionFileUrl?: string;
  instructionFileName?: string;
  instructionsText?: string;
  responseFileUrl?: string;
  responseFileName?: string;
  responseStatus?: 'pending' | 'graded';
  responseGrade?: number;
  responseCorrectAnswersCount?: number;
  responseTotalQuestionsCount?: number;
  responseFeedback?: string;
  dueDate?: string;
}

interface QuizResultViewModel {
  score: number;
  total: number;
}

interface QuizFileSubmissionViewModel {
  status: 'pending' | 'graded';
  grade?: number;
  correctAnswersCount?: number;
  totalQuestionsCount?: number;
  teacherFeedback?: string;
  submittedAt: string;
  responseFileUrl?: string;
  responseFileName?: string;
}

interface PrositViewModel {
  title: string;
  chapterTitle: string;
  subChapterTitle: string;
  fileUrl: string | null;
  fileName: string;
  subtitle?: string;
  dueDate?: string;
  submissionInstructions?: string;
}

interface SubchapterContent {
  title: string;
  description: string;
  folders: Record<FolderKey, SubchapterFolderItem[]>;
}

interface CourseCard {
  id: string;
  title: string;
  subtitle: string;
  type: 'chapter' | 'quiz' | 'exercise' | 'pdf';
  progress: number;
  thumbnail: string;
}

interface AiSearchCoursesResponse {
  status: string;
  query: string;
  results: Array<{
    course_id: string;
    title: string;
    similarity: number;
    content: string;
  }>;
}

interface AiMetadataValuesResponse {
  status: string;
  field: string;
  values: any[];
}

interface AiAdvancedSearchResponse {
  status: string;
  query: string;
  results: Array<{
    course_id?: string;
    chunk_text?: string;
    metadata?: any;
  }>;
}

@Component({
  selector: 'app-my-courses',
  templateUrl: './my-courses.component.html',
  styleUrls: ['./my-courses.component.css'],
})
export class MyCoursesComponent implements OnInit {
  @ViewChild('prositEditor') prositEditor?: ElementRef<HTMLDivElement>;

  private aiServiceUrl = 'http://localhost:8000';
  private reindexAttempted = false;
  private availableCourseTitles: string[] = [];
  user: any = null;
  courses: CourseItem[] = [];
  subjects: SubjectItem[] = [];
  selectedSubject: SubjectItem | null = null;
  selectedCourse: CourseItem | null = null;
  courseResources: CourseContentResource[] = [];
  subchapterContents: SubchapterContent[] = [];
  courseExercises: any[] = [];
  courseQuizzes: any[] = [];
  courseLoading = false;
  subjectsLoading = false;
  subjectCoursesLoading = false;
  viewMode:
    | 'subjects'
    | 'courses'
    | 'content'
    | 'prosit'
    | 'quiz'
    | 'quiz-file' = 'subjects';
  profileDrawerOpen = false;
  darkMode = false;
  readonly folderKeys: FolderKey[] = [
    'cours',
    'exercices',
    'videos',
    'ressources',
  ];
  readonly folderLabels: Record<FolderKey, string> = {
    cours: 'Dossier Cours',
    exercices: 'Dossier Exercices',
    videos: 'Dossier Videos',
    ressources: 'Dossier Ressources',
  };
  activeFolderBySubchapter: Record<string, FolderKey> = {};
  selectedProsit: PrositViewModel | null = null;
  selectedPrositSubmissionFile: File | null = null;
  selectedPrositReportText = '';
  selectedPrositReportHtml = '';
  prositSubmitMessage = '';
  selectedQuiz: QuizViewModel | null = null;
  selectedQuizFile: QuizFileViewModel | null = null;
  selectedQuizResponseFile: File | null = null;
  quizFileSubmitMessage = '';
  quizFileSubmitted = false;
  selectedQuizAnswers: number[] = [];
  quizSubmitMessage = '';
  quizSubmitted = false;
  quizResultsById: Record<string, QuizResultViewModel> = {};
  quizFileSubmissionsById: Record<
    string,
    QuizFileSubmissionViewModel | undefined
  > = {};
  quizFileResponsePreviewOpen = false;
  quizFileResponseDocxHtmlPreview = '';
  quizFileResponseDocxLoading = false;
  quizFileResponseDocxError = '';
  quizReviewMode = false;
  quizAnswersById: Record<string, number[]> = {};
  expandedCodeResources: Record<string, boolean> = {};

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private adaptiveService: AdaptiveLearningService,
    private subjectsService: SubjectsService,
    private quizSubmissionService: QuizSubmissionService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadCourses();
    this.loadPreviousQuizSubmissions();
    this.loadPreviousQuizFileSubmissions();
    this.checkDarkMode();
  }

  private loadPreviousQuizSubmissions(): void {
    this.quizSubmissionService.getStudentQuizSubmissions().subscribe({
      next: (submissions) => {
        submissions.forEach((submission) => {
          this.quizResultsById[submission.quizId] = {
            score: submission.scoreObtained,
            total: submission.totalQuestions,
          };
          this.quizAnswersById[submission.quizId] = submission.answers.map(
            (a) => a.selectedOptionIndex,
          );
        });
      },
      error: () => {
        console.warn('Could not load previous quiz submissions');
      },
    });
  }

  private loadPreviousQuizFileSubmissions(): void {
    this.quizSubmissionService.getStudentQuizFileSubmissions().subscribe({
      next: (submissions) => {
        submissions.forEach((submission) => {
          this.quizFileSubmissionsById[submission.quizId] = {
            status: submission.status,
            grade: submission.grade,
            correctAnswersCount: submission.correctAnswersCount,
            totalQuestionsCount: submission.totalQuestionsCount,
            teacherFeedback: submission.teacherFeedback,
            submittedAt: submission.submittedAt,
            responseFileUrl: submission.responseFileUrl,
            responseFileName: submission.responseFileName,
          };
        });
      },
      error: () => {
        console.warn('Could not load previous file-quiz submissions');
      },
    });
  }

  private checkDarkMode(): void {
    this.darkMode = document.documentElement.classList.contains('dark');
  }

  private loadCourses(): void {
    this.subjectsLoading = true;
    this.subjectsService
      .getSubjects()
      .pipe(catchError(() => of([] as DbSubjectItem[])))
      .subscribe((dbSubjects) => {
        this.applySubjectsFromDatabase(dbSubjects);
        this.subjectsLoading = false;
      });
  }

  private applySubjectsFromDatabase(dbSubjects: DbSubjectItem[]): void {
    const colors = [
      'from-blue-600 to-indigo-600',
      'from-emerald-600 to-teal-600',
      'from-purple-600 to-violet-600',
      'from-orange-500 to-rose-500',
      'from-cyan-600 to-blue-500',
    ];

    const sortedSubjects = [...(dbSubjects || [])].sort((a, b) =>
      String(a?.title || '').localeCompare(String(b?.title || '')),
    );

    this.subjects = sortedSubjects.map((subject, index) => {
      const chapters = Array.isArray(subject?.chapters)
        ? [...subject.chapters].sort(
            (a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0),
          )
        : [];

      const courses = chapters.map((chapter, chapterIndex) => {
        const subChapters = Array.isArray(chapter?.subChapters)
          ? [...chapter.subChapters].sort(
              (a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0),
            )
          : [];

        const modules: CourseModule[] = subChapters.map((subChapter) => ({
          title: String(subChapter?.title || 'Untitled subchapter'),
          description: String(subChapter?.description || ''),
          order: Number(subChapter?.order ?? 0),
        }));

        return {
          id: `${subject._id}-${Number(chapter?.order ?? chapterIndex)}`,
          title: String(chapter?.title || `Chapter ${chapterIndex + 1}`),
          description: String(chapter?.description || ''),
          instructor:
            subject?.instructorId?.name ||
            subject?.instructorId?.first_name ||
            'Enseignant',
          subject: String(subject?.title || 'General'),
          modules,
          moduleCount: modules.length,
          thumbnail:
            chapterIndex % 3 === 0
              ? 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80'
              : chapterIndex % 3 === 1
                ? 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80'
                : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
          sourceSubChapters: subChapters,
        };
      });

      return {
        name: String(subject?.title || `Subject ${index + 1}`),
        count: courses.length,
        courses,
        color: colors[index % colors.length],
        loaded: true,
      };
    });

    this.courses = this.subjects.flatMap((subject) => subject.courses);
    this.viewMode = 'subjects';
  }

  private loadSubjectsFromCourseTitlesOrFallback(): void {
    this.http
      .get<AiMetadataValuesResponse>(
        `${this.aiServiceUrl}/metadata/available-values/course_title`,
      )
      .pipe(
        catchError(() =>
          of<AiMetadataValuesResponse>({
            status: 'error',
            field: 'course_title',
            values: [],
          }),
        ),
      )
      .subscribe((res) => {
        const titles = (Array.isArray(res?.values) ? res.values : [])
          .map((v) => String(v || '').trim())
          .filter((v) => !!v);
        this.availableCourseTitles = titles;

        const rawCandidates = Array.from(
          new Set(titles.map((title) => this.subjectFromCourseTitle(title))),
        ).filter((s) => !!s);

        const chapterLikeOnly =
          rawCandidates.length > 0 &&
          rawCandidates.every((s) => /^chapitre\s*\d+/i.test(s));

        const subjectCandidates = chapterLikeOnly
          ? ['Programmation Procedurale 1']
          : rawCandidates;

        if (subjectCandidates.length > 0) {
          this.initializeSubjects(
            subjectCandidates,
            'course_title',
            chapterLikeOnly,
          );
          this.subjectsLoading = false;
          return;
        }

        this.loadCoursesFallback();
      });
  }

  private subjectFromCourseTitle(title: string): string {
    const t = String(title || '').trim();
    if (!t) return 'General';

    const beforeDash = t.split(' - ')[0]?.trim();
    const beforeColon = t.split(':')[0]?.trim();
    const picked =
      beforeDash && beforeDash.length <= 40 ? beforeDash : beforeColon;
    if (picked && picked.length >= 3) return picked;

    return this.extractSubject({ title: t });
  }

  private buildCoursesFromAiResults(
    results: any[],
    forcedSubject?: string,
  ): any[] {
    const byCourse = new Map<string, any>();

    for (const r of results || []) {
      const key = String(r?.course_id || r?.title || '').trim();
      if (!key) continue;
      if (!byCourse.has(key)) {
        byCourse.set(key, {
          _id: key,
          title: r?.title || key,
          description: r?.content || '',
          subject:
            forcedSubject || this.extractSubject({ title: r?.title || key }),
          modules: [],
          instructorId: { name: 'Enseignant' },
        });
      }
    }

    return Array.from(byCourse.values());
  }

  private loadCoursesFallback(): void {
    if (!this.reindexAttempted) {
      this.reindexAttempted = true;
      this.http
        .post<any>(`${this.aiServiceUrl}/batch-process-chunks`, {})
        .pipe(catchError(() => of(null)))
        .subscribe(() => this.loadCourses());
      return;
    }

    const broadQueries = ['cours', 'chapitre', 'programmation', 'algorithme'];
    const requests = broadQueries.map((query) =>
      this.http
        .get<AiSearchCoursesResponse>(
          `${this.aiServiceUrl}/search-courses?query=${encodeURIComponent(query)}&n_results=50`,
        )
        .pipe(
          map((res) => (Array.isArray(res?.results) ? res.results : [])),
          catchError(() => of([] as any[])),
        ),
    );

    forkJoin(requests).subscribe({
      next: (lists) => {
        const merged = lists.flat();
        if (merged.length > 0) {
          this.applyCourses(this.buildCoursesFromAiResults(merged));
          this.subjectsLoading = false;
          return;
        }

        this.http
          .post<any>(`${this.aiServiceUrl}/search-chunks`, {
            query: 'cours',
            n_results: 50,
            aggregate_by_course: true,
          })
          .pipe(catchError(() => of({ results: [] })))
          .subscribe((res: any) => {
            const rows = Array.isArray(res?.results) ? res.results : [];
            const mapped = rows.map((item: any, idx: number) => ({
              _id: String(item?.course_id || `course-${idx + 1}`),
              title: String(item?.course_id || `Course ${idx + 1}`),
              description: `Detected from AI chunks (${Number(item?.chunk_count || 0)} chunks).`,
              subject: this.extractSubject({
                title: String(item?.course_id || `Course ${idx + 1}`),
              }),
              modules: [],
              instructorId: { name: 'Enseignant' },
            }));
            this.applyCourses(mapped);
            this.subjectsLoading = false;
          });
      },
      error: () => {
        this.subjects = [];
        this.subjectsLoading = false;
      },
    });
  }

  private initializeSubjects(
    subjectNames: string[],
    source: 'subject' | 'course_title' = 'subject',
    includeAllTitles = false,
  ): void {
    const colors = [
      'from-blue-600 to-indigo-600',
      'from-emerald-600 to-teal-600',
      'from-purple-600 to-violet-600',
      'from-orange-500 to-rose-500',
      'from-cyan-600 to-blue-500',
    ];

    const unique = Array.from(new Set(subjectNames)).sort((a, b) =>
      a.localeCompare(b),
    );

    this.subjects = unique.map((name, index) => ({
      name,
      count: 0,
      courses: [],
      color: colors[index % colors.length],
      loaded: false,
      source,
      includeAllTitles,
    }));
    this.courses = [];
    this.viewMode = 'subjects';
  }

  private mapToCourseItems(sourceCourses: any[]): CourseItem[] {
    const thumbs = [
      'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    ];

    return (sourceCourses || []).map((course: any, index: number) => {
      const modules = Array.isArray(course?.modules)
        ? course.modules
            .map((m: any) => ({
              title: m?.title || 'Untitled chapter',
              description: m?.description || '',
              order: Number(m?.order ?? 0),
            }))
            .sort((a: CourseModule, b: CourseModule) => a.order - b.order)
        : [];

      return {
        id: course?._id || course?.id || String(index + 1),
        title: course?.title || `Course ${index + 1}`,
        description: course?.description || '',
        instructor:
          course?.instructorId?.name ||
          course?.instructor?.name ||
          'Enseignant',
        subject: this.extractSubject(course),
        modules,
        moduleCount: modules.length,
        thumbnail: thumbs[index % thumbs.length],
      };
    });
  }

  private loadSubjectCourses(subject: SubjectItem): void {
    this.subjectCoursesLoading = true;

    if (subject.source === 'course_title') {
      const selectedTitles = (
        subject.includeAllTitles
          ? this.availableCourseTitles
          : this.availableCourseTitles.filter(
              (title) => this.subjectFromCourseTitle(title) === subject.name,
            )
      ).filter((title) => !!title);

      if (selectedTitles.length === 0) {
        subject.courses = [];
        subject.count = 0;
        subject.loaded = true;
        this.subjectCoursesLoading = false;
        return;
      }

      const chapterRequests = selectedTitles.map((title) =>
        this.http
          .post<AiAdvancedSearchResponse>(
            `${this.aiServiceUrl}/search/advanced`,
            {
              query: title,
              n_results: 50,
              sources: ['courses'],
              use_relevance_scoring: false,
            },
          )
          .pipe(
            map((res) =>
              this.buildCourseFromTitleAndAdvanced(
                title,
                subject.name,
                res?.results || [],
              ),
            ),
            catchError(() =>
              of(this.buildCourseFromTitleAndAdvanced(title, subject.name, [])),
            ),
          ),
      );

      forkJoin(chapterRequests).subscribe({
        next: (courses) => {
          this.assignCoursesToSubject(subject, courses);
          this.subjectCoursesLoading = false;
        },
        error: () => {
          this.assignCoursesToSubject(subject, []);
          this.subjectCoursesLoading = false;
        },
      });
      return;
    }

    this.http
      .post<AiAdvancedSearchResponse>(`${this.aiServiceUrl}/search/advanced`, {
        query: subject.name,
        n_results: 50,
        sources: ['courses'],
        filters: { subject: subject.name },
        use_relevance_scoring: false,
      })
      .pipe(
        catchError(() =>
          of<AiAdvancedSearchResponse>({
            status: 'error',
            query: subject.name,
            results: [],
          }),
        ),
      )
      .subscribe((res) => {
        const rows = Array.isArray(res?.results) ? res.results : [];
        const fromAdvanced = this.buildCoursesFromAdvancedResults(
          rows,
          subject.name,
        );

        if (fromAdvanced.length > 0) {
          this.assignCoursesToSubject(subject, fromAdvanced);
          this.subjectCoursesLoading = false;
          return;
        }

        this.http
          .get<AiSearchCoursesResponse>(
            `${this.aiServiceUrl}/search-courses?query=${encodeURIComponent(subject.name)}&n_results=50`,
          )
          .pipe(
            catchError(() =>
              of<AiSearchCoursesResponse>({
                status: 'error',
                query: subject.name,
                results: [],
              }),
            ),
          )
          .subscribe((fallbackRes) => {
            const aiRows = Array.isArray(fallbackRes?.results)
              ? fallbackRes.results
              : [];
            const mapped = this.buildCoursesFromAiResults(aiRows, subject.name);
            this.assignCoursesToSubject(subject, mapped);
            this.subjectCoursesLoading = false;
          });
      });
  }

  private buildCourseFromTitleAndAdvanced(
    title: string,
    subjectName: string,
    rows: Array<{ course_id?: string; chunk_text?: string; metadata?: any }>,
  ): any {
    const filteredRows = (rows || []).filter((row) => {
      const metaTitle = String(row?.metadata?.course_title || '').trim();
      return !metaTitle || metaTitle === title;
    });

    const modulesMap = new Map<string, string>();
    for (const row of filteredRows) {
      const moduleName = String(row?.metadata?.module_name || '').trim();
      if (!moduleName) continue;
      if (!modulesMap.has(moduleName)) {
        modulesMap.set(moduleName, String(row?.chunk_text || '').slice(0, 320));
      }
    }

    const modules = Array.from(modulesMap.entries()).map(
      ([name, desc], idx) => ({
        title: name,
        description: desc,
        order: idx,
      }),
    );

    const description =
      String(filteredRows[0]?.chunk_text || '').slice(0, 420) ||
      'Chapter content loaded from ai-service.';

    return {
      _id: String(filteredRows[0]?.course_id || title),
      title,
      description,
      subject: subjectName,
      modules,
      instructorId: { name: 'Enseignant' },
    };
  }

  private buildCoursesFromAdvancedResults(
    results: Array<{ course_id?: string; chunk_text?: string; metadata?: any }>,
    subjectName: string,
  ): any[] {
    const grouped = new Map<string, any>();

    for (const row of results || []) {
      const meta = row?.metadata || {};
      const courseId = String(row?.course_id || meta?.course_id || '').trim();
      const title = String(meta?.course_title || courseId || '').trim();
      const moduleName = String(meta?.module_name || '').trim();
      const key = courseId || title;
      if (!key) continue;

      if (!grouped.has(key)) {
        grouped.set(key, {
          _id: key,
          title: title || key,
          description: String(row?.chunk_text || '').slice(0, 280),
          subject: subjectName,
          modules: [],
          instructorId: { name: 'Enseignant' },
        });
      }

      if (moduleName) {
        const entry = grouped.get(key);
        const exists = (entry.modules || []).some(
          (m: any) =>
            String(m?.title || '').toLowerCase() === moduleName.toLowerCase(),
        );
        if (!exists) {
          entry.modules.push({
            title: moduleName,
            description: '',
            order: entry.modules.length,
          });
        }
      }
    }

    return Array.from(grouped.values());
  }

  private assignCoursesToSubject(
    subject: SubjectItem,
    sourceCourses: any[],
  ): void {
    const mapped = this.mapToCourseItems(sourceCourses).map((course) => ({
      ...course,
      subject: subject.name,
    }));
    subject.courses = mapped;
    subject.count = mapped.length;
    subject.loaded = true;

    if (this.selectedSubject?.name === subject.name) {
      this.selectedSubject = { ...subject };
    }
  }

  private applyCourses(sourceCourses: any[]): void {
    this.courses = this.mapToCourseItems(sourceCourses);

    this.buildSubjects();
  }

  private extractSubject(course: any): string {
    const direct = (course?.subject || course?.level || '').toString().trim();
    if (direct) return direct;

    const title = (course?.title || '').toString();
    const chapterMatch = title.match(/Chapitre\s*\d+/i);
    if (chapterMatch?.[0]) {
      return chapterMatch[0].replace(/\s+/g, ' ').trim();
    }

    return 'General';
  }

  private buildSubjects(): void {
    const colors = [
      'from-blue-600 to-indigo-600',
      'from-emerald-600 to-teal-600',
      'from-purple-600 to-violet-600',
      'from-orange-500 to-rose-500',
      'from-cyan-600 to-blue-500',
    ];

    const map = new Map<string, CourseItem[]>();
    for (const course of this.courses) {
      const key = course.subject || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(course);
    }

    this.subjects = Array.from(map.entries()).map(([name, courses], index) => ({
      name,
      count: courses.length,
      courses,
      color: colors[index % colors.length],
      loaded: true,
    }));

    this.subjects.sort((a, b) => a.name.localeCompare(b.name));
    this.viewMode = 'subjects';
    this.subjectsLoading = false;
  }

  openSubject(subject: SubjectItem): void {
    this.selectedSubject = subject;
    this.selectedCourse = null;
    this.viewMode = 'courses';
    if (!subject.loaded) {
      this.loadSubjectCourses(subject);
    }
  }

  backToSubjects(): void {
    this.selectedSubject = null;
    this.selectedCourse = null;
    this.viewMode = 'subjects';
  }

  openCourse(course: CourseItem): void {
    this.selectedCourse = course;
    this.viewMode = 'content';
    this.loadCourseContent(course);
  }

  backToCourses(): void {
    this.selectedCourse = null;
    this.courseResources = [];
    this.courseExercises = [];
    this.courseQuizzes = [];
    this.selectedProsit = null;
    this.selectedPrositSubmissionFile = null;
    this.selectedPrositReportText = '';
    this.selectedPrositReportHtml = '';
    this.prositSubmitMessage = '';
    this.selectedQuiz = null;
    this.selectedQuizFile = null;
    this.selectedQuizResponseFile = null;
    this.quizFileSubmitMessage = '';
    this.quizFileSubmitted = false;
    this.selectedQuizAnswers = [];
    this.quizSubmitMessage = '';
    this.quizSubmitted = false;
    this.quizReviewMode = false;
    this.viewMode = 'courses';
  }

  backToChapterContent(): void {
    this.selectedProsit = null;
    this.selectedPrositSubmissionFile = null;
    this.selectedPrositReportText = '';
    this.selectedPrositReportHtml = '';
    this.prositSubmitMessage = '';
    this.selectedQuiz = null;
    this.selectedQuizFile = null;
    this.selectedQuizResponseFile = null;
    this.quizFileSubmitMessage = '';
    this.quizFileSubmitted = false;
    this.selectedQuizAnswers = [];
    this.quizSubmitMessage = '';
    this.quizSubmitted = false;
    this.quizReviewMode = false;
    this.quizFileResponsePreviewOpen = false;
    this.quizFileResponseDocxHtmlPreview = '';
    this.quizFileResponseDocxLoading = false;
    this.quizFileResponseDocxError = '';
    this.viewMode = 'content';
  }

  backToChapterContentFromQuiz(): void {
    this.selectedQuiz = null;
    this.selectedQuizFile = null;
    this.selectedQuizResponseFile = null;
    this.quizFileSubmitMessage = '';
    this.quizFileSubmitted = false;
    this.selectedQuizAnswers = [];
    this.quizSubmitMessage = '';
    this.quizSubmitted = false;
    this.quizReviewMode = false;
    this.quizFileResponsePreviewOpen = false;
    this.quizFileResponseDocxHtmlPreview = '';
    this.quizFileResponseDocxLoading = false;
    this.quizFileResponseDocxError = '';
    this.viewMode = 'content';
  }

  getQuizResultLabel(item: SubchapterFolderItem): string | null {
    const quizKey = String(item?.quizId || item?.title || '').trim();
    if (!quizKey) {
      return null;
    }

    const fileSubmission = this.quizFileSubmissionsById[quizKey];
    if (fileSubmission) {
      if (fileSubmission.status === 'graded') {
        if (
          typeof fileSubmission.correctAnswersCount === 'number' &&
          typeof fileSubmission.totalQuestionsCount === 'number' &&
          fileSubmission.totalQuestionsCount > 0
        ) {
          return `Note ${fileSubmission.correctAnswersCount}/${fileSubmission.totalQuestionsCount}`;
        }
        return `Note ${Number(fileSubmission.grade ?? 0)}/100`;
      }
      return 'Remise en attente';
    }

    const result = this.quizResultsById[quizKey];
    if (!result) {
      return null;
    }

    return `Note ${result.score}/${result.total}`;
  }

  private loadCourseContent(course: CourseItem): void {
    this.courseLoading = true;
    this.subchapterContents = this.buildSubchapterContents(course);
    this.courseResources = [];
    this.courseExercises = [];
    this.courseQuizzes = [];

    this.courseLoading = false;
  }

  getSubchapterKey(module: SubchapterContent, index: number): string {
    return `${this.selectedCourse?.id || 'course'}_${index}_${module.title}`;
  }

  getActiveFolderForSubchapter(
    module: SubchapterContent,
    index: number,
  ): FolderKey {
    const key = this.getSubchapterKey(module, index);
    return this.activeFolderBySubchapter[key] || 'cours';
  }

  setActiveFolderForSubchapter(
    module: SubchapterContent,
    index: number,
    folder: FolderKey,
  ): void {
    const key = this.getSubchapterKey(module, index);
    this.activeFolderBySubchapter[key] = folder;
  }

  getFolderItems(
    module: SubchapterContent,
    folder: FolderKey,
  ): SubchapterFolderItem[] {
    return module.folders[folder] || [];
  }

  getItemUrl(item: SubchapterFolderItem): string | null {
    const direct = String(item?.url || '').trim();
    if (/^https?:\/\//i.test(direct)) {
      return direct;
    }

    const fallback = String(item?.subtitle || '').trim();
    if (/^https?:\/\//i.test(fallback)) {
      return fallback;
    }
    if (fallback.startsWith('/uploads/')) {
      return `http://localhost:3000${fallback}`;
    }

    return null;
  }

  hasDownloadableUrl(item: SubchapterFolderItem): boolean {
    return !!this.getItemUrl(item);
  }

  getDownloadFileName(item: SubchapterFolderItem): string {
    const title = String(item?.title || '').trim();
    if (title) return title;
    const url = String(item?.url || '').trim();
    return this.fileNameFromUrl(url);
  }

  isPrositItem(item: SubchapterFolderItem, folder: FolderKey): boolean {
    return folder === 'exercices' && item.type === 'prosit';
  }

  getPrositDueDateLabel(item: SubchapterFolderItem): string {
    if (!item?.dueDate) {
      return 'Echeance non specifiee';
    }

    const dt = new Date(item.dueDate);
    if (Number.isNaN(dt.getTime())) {
      return `Echeance: ${item.dueDate}`;
    }

    return `Echeance: ${dt.toLocaleString('fr-FR')}`;
  }

  getItemDisplaySubtitle(
    item: SubchapterFolderItem,
    folder: FolderKey,
  ): string | null {
    if (this.isPrositItem(item, folder)) {
      const instructions = String(item?.submissionInstructions || '').trim();
      return instructions || null;
    }

    if (this.isQuizItem(item, folder)) {
      const quizId = String(item?.quizId || '').trim();
      const existingSubmission = quizId
        ? this.quizFileSubmissionsById[quizId]
        : undefined;
      const feedback = quizId
        ? String(
            this.quizFileSubmissionsById[quizId]?.teacherFeedback || '',
          ).trim()
        : '';
      if (feedback) {
        return `Feedback: ${feedback}`;
      }
      if (existingSubmission) {
        return existingSubmission.status === 'graded'
          ? 'Feedback: Aucun commentaire du professeur.'
          : 'Feedback: En attente de correction.';
      }

      const quizQuestionCount = Array.isArray(item?.quizQuestions)
        ? item.quizQuestions.length
        : 0;
      if (quizQuestionCount > 0) {
        return `${quizQuestionCount} question(s)`;
      }

      const instructions = String(item?.submissionInstructions || '').trim();
      if (instructions) {
        return instructions;
      }

      const fileName = this.getDownloadFileName(item);
      return fileName ? `Document du quiz: ${fileName}` : 'Quiz fichier';
    }

    if (folder === 'ressources' && item.type === 'code') {
      return 'Cliquez sur le titre pour afficher le code';
    }

    // For course files, keep only the human-readable title and hide raw URL/id-like subtitles.
    if (folder === 'cours' && this.hasDownloadableUrl(item)) {
      return null;
    }

    // For video resources, hide technical ids/urls and keep the readable title only.
    if (folder === 'videos') {
      return null;
    }

    const subtitle = String(item?.subtitle || '').trim();
    if (!subtitle) {
      return null;
    }

    if (/^https?:\/\//i.test(subtitle) || subtitle.startsWith('/uploads/')) {
      const fileName = this.fileNameFromUrl(
        subtitle.startsWith('/uploads/') ? subtitle : subtitle,
      );
      return fileName || null;
    }

    return subtitle;
  }

  isCodeResourceItem(item: SubchapterFolderItem, folder: FolderKey): boolean {
    return folder === 'ressources' && item.type === 'code';
  }

  getCodeResourceKey(
    module: SubchapterContent,
    moduleIndex: number,
    item: SubchapterFolderItem,
  ): string {
    const itemKey = String(item.contentId || item.title || 'resource').trim();
    return `${this.getSubchapterKey(module, moduleIndex)}::${itemKey}`;
  }

  toggleCodeResource(
    module: SubchapterContent,
    moduleIndex: number,
    item: SubchapterFolderItem,
  ): void {
    const key = this.getCodeResourceKey(module, moduleIndex, item);
    this.expandedCodeResources[key] = !this.expandedCodeResources[key];
  }

  isCodeResourceExpanded(
    module: SubchapterContent,
    moduleIndex: number,
    item: SubchapterFolderItem,
  ): boolean {
    const key = this.getCodeResourceKey(module, moduleIndex, item);
    return !!this.expandedCodeResources[key];
  }

  getCodeResourceContent(item: SubchapterFolderItem): string {
    return String(item.codeSnippet || item.subtitle || '').trim();
  }

  isQuizItem(item: SubchapterFolderItem, folder: FolderKey): boolean {
    return folder === 'exercices' && item.type === 'quiz';
  }

  isMcqQuizItem(item: SubchapterFolderItem, folder: FolderKey): boolean {
    return this.isQuizItem(item, folder) && !!item.quizQuestions?.length;
  }

  isFileQuizItem(item: SubchapterFolderItem, folder: FolderKey): boolean {
    return this.isQuizItem(item, folder) && !item.quizQuestions?.length;
  }

  getQuizActionLabel(item: SubchapterFolderItem): string {
    const key = String(item?.quizId || item?.title || '').trim();
    const fileSubmission = this.quizFileSubmissionsById[key];
    const mcqResult = this.quizResultsById[key];

    if (fileSubmission?.status === 'graded' || mcqResult) {
      return 'Afficher remise';
    }
    if (fileSubmission?.status === 'pending') {
      return 'Voir ma remise';
    }
    return item.quizQuestions?.length ? 'Ouvrir le QCM' : 'Deposer ma reponse';
  }

  openQuiz(item: SubchapterFolderItem, module: SubchapterContent): void {
    if (!item.quizQuestions?.length) {
      this.openFileQuiz(item, module);
      return;
    }

    const quizId = item.quizId || item.title;
    const hasResult = !!this.quizResultsById[quizId];

    this.selectedQuiz = {
      title: item.title,
      chapterTitle: this.selectedCourse?.title || 'Chapter',
      subChapterTitle: module.title,
      quizId: quizId,
      questions: item.quizQuestions,
    };

    if (hasResult && this.quizAnswersById[quizId]) {
      this.selectedQuizAnswers = [...this.quizAnswersById[quizId]];
      this.quizReviewMode = true;
    } else {
      this.selectedQuizAnswers = Array(item.quizQuestions.length).fill(null);
      this.quizReviewMode = false;
    }

    this.quizSubmitMessage = '';
    this.quizSubmitted = false;
    this.viewMode = 'quiz';
  }

  openFileQuiz(item: SubchapterFolderItem, module: SubchapterContent): void {
    const quizId = String(
      item.quizId || item.contentId || item.title || '',
    ).trim();
    if (!quizId) {
      return;
    }

    const resolvedInstructionUrl = this.getItemUrl(item);
    const rawSubtitle = String(item.subtitle || '').trim();
    const readableSubtitle =
      /^https?:\/\//i.test(rawSubtitle) || rawSubtitle.startsWith('/uploads/')
        ? ''
        : rawSubtitle;
    const existingSubmission = this.quizFileSubmissionsById[quizId];

    this.selectedQuizFile = {
      quizId,
      title: item.title,
      chapterTitle: this.selectedCourse?.title || 'Chapter',
      subChapterTitle: module.title,
      instructionFileUrl:
        resolvedInstructionUrl || String(item.url || '').trim() || undefined,
      instructionFileName: this.getDownloadFileName(item),
      instructionsText:
        String(item.submissionInstructions || '').trim() ||
        readableSubtitle ||
        'Telechargez le sujet, redigez vos reponses, puis deposez votre fichier.',
      responseFileUrl: existingSubmission?.responseFileUrl,
      responseFileName: existingSubmission?.responseFileName,
      responseStatus: existingSubmission?.status,
      responseGrade: existingSubmission?.grade,
      responseCorrectAnswersCount: existingSubmission?.correctAnswersCount,
      responseTotalQuestionsCount: existingSubmission?.totalQuestionsCount,
      responseFeedback: existingSubmission?.teacherFeedback,
      dueDate: item.dueDate,
    };

    this.selectedQuizResponseFile = null;
    this.quizFileSubmitted = false;
    this.quizFileSubmitMessage = '';
    this.quizFileResponsePreviewOpen = false;
    this.quizFileResponseDocxHtmlPreview = '';
    this.quizFileResponseDocxLoading = false;
    this.quizFileResponseDocxError = '';
    this.viewMode = 'quiz-file';
  }

  setQuizAnswer(questionIndex: number, optionIndex: number): void {
    if (this.quizReviewMode) {
      return;
    }
    this.selectedQuizAnswers[questionIndex] = optionIndex;
    this.quizSubmitMessage = '';
  }

  getQuizAnsweredCount(): number {
    return this.selectedQuizAnswers.filter(
      (answer) => answer !== null && answer !== undefined,
    ).length;
  }

  isQuizComplete(): boolean {
    return (
      !!this.selectedQuiz &&
      this.selectedQuizAnswers.length === this.selectedQuiz.questions.length &&
      this.selectedQuizAnswers.every(
        (answer) => answer !== null && answer !== undefined,
      )
    );
  }

  submitQuiz(): void {
    if (!this.selectedQuiz) {
      return;
    }

    if (this.quizReviewMode) {
      this.backToChapterContentFromQuiz();
      return;
    }

    if (!this.isQuizComplete()) {
      this.quizSubmitMessage =
        'Veuillez repondre a toutes les questions avant de soumettre.';
      this.quizSubmitted = false;
      return;
    }

    this.quizAnswersById[this.selectedQuiz.quizId] = [
      ...this.selectedQuizAnswers,
    ];

    const score = this.selectedQuiz.questions.reduce(
      (total, question, index) => {
        return (
          total +
          (this.selectedQuizAnswers[index] === question.correctOptionIndex
            ? 1
            : 0)
        );
      },
      0,
    );

    this.quizResultsById[this.selectedQuiz.quizId] = {
      score,
      total: this.selectedQuiz.questions.length,
    };

    const answers = this.selectedQuiz.questions.map((question, index) => ({
      questionIndex: index,
      selectedOptionIndex: this.selectedQuizAnswers[index],
      correctOptionIndex: question.correctOptionIndex,
      isCorrect:
        this.selectedQuizAnswers[index] === question.correctOptionIndex,
    }));

    const submitData = {
      quizId: this.selectedQuiz.quizId,
      quizTitle: this.selectedQuiz.title,
      subjectTitle: this.selectedCourse?.subject || 'Unknown Subject',
      chapterTitle: this.selectedQuiz.chapterTitle,
      subChapterTitle: this.selectedQuiz.subChapterTitle,
      totalQuestions: this.selectedQuiz.questions.length,
      scoreObtained: score,
      answers,
    };

    this.quizSubmissionService.submitQuiz(submitData).subscribe({
      next: () => {
        this.quizSubmitted = true;
        this.quizSubmitMessage = `Quiz ${this.selectedQuiz!.title} pret pour validation (${this.getQuizAnsweredCount()}/${this.selectedQuiz!.questions.length} reponses).`;
        this.backToChapterContentFromQuiz();
      },
      error: (err) => {
        console.error('Quiz submission error:', err);
        const errorMsg =
          err?.error?.message ||
          err?.message ||
          'Erreur lors de la soumission du quiz.';
        this.quizSubmitMessage = `Erreur: ${errorMsg}`;
        this.quizSubmitted = false;
      },
    });
  }

  onQuizResponseFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedQuizResponseFile = (input.files && input.files[0]) || null;
    this.quizFileSubmitMessage = '';
  }

  submitQuizFileResponse(): void {
    if (!this.selectedQuizFile) {
      return;
    }

    if (!this.selectedQuizResponseFile) {
      this.quizFileSubmitMessage =
        'Veuillez selectionner un fichier de reponse (PDF/Word).';
      this.quizFileSubmitted = false;
      return;
    }

    const formData = new FormData();
    formData.append('file', this.selectedQuizResponseFile);
    formData.append('quizId', this.selectedQuizFile.quizId);
    formData.append('quizTitle', this.selectedQuizFile.title);
    formData.append(
      'subjectTitle',
      this.selectedCourse?.subject || 'Unknown Subject',
    );
    formData.append('chapterTitle', this.selectedQuizFile.chapterTitle);
    formData.append('subChapterTitle', this.selectedQuizFile.subChapterTitle);

    this.quizSubmissionService.submitQuizFile(formData).subscribe({
      next: (submission) => {
        this.quizFileSubmissionsById[this.selectedQuizFile!.quizId] = {
          status: submission.status,
          grade: submission.grade,
          correctAnswersCount: submission.correctAnswersCount,
          totalQuestionsCount: submission.totalQuestionsCount,
          teacherFeedback: submission.teacherFeedback,
          submittedAt: submission.submittedAt,
          responseFileUrl: submission.responseFileUrl,
          responseFileName: submission.responseFileName,
        };
        this.quizFileSubmitted = true;
        this.quizFileSubmitMessage =
          'Reponse envoyee. Le professeur va verifier et attribuer la note.';
        this.backToChapterContentFromQuiz();
      },
      error: (err) => {
        const errorMsg =
          err?.error?.message ||
          err?.message ||
          'Erreur lors de la soumission du fichier.';
        this.quizFileSubmitMessage = `Erreur: ${errorMsg}`;
        this.quizFileSubmitted = false;
      },
    });
  }

  getSelectedQuizFileInstructionUrl(): string | null {
    return this.resolveQuizFileUrl(this.selectedQuizFile?.instructionFileUrl);
  }

  getSelectedQuizFileResponseUrl(): string | null {
    return this.resolveQuizFileUrl(this.selectedQuizFile?.responseFileUrl);
  }

  hasSelectedQuizFileSubmission(): boolean {
    return !!(
      this.selectedQuizFile?.responseFileUrl ||
      this.selectedQuizFile?.responseFileName
    );
  }

  isSelectedQuizFileResponsePreviewable(): boolean {
    const url = String(
      this.getSelectedQuizFileResponseUrl() || '',
    ).toLowerCase();
    return url.endsWith('.pdf');
  }

  isSelectedQuizFileResponseDocxPreviewable(): boolean {
    const url = String(
      this.getSelectedQuizFileResponseUrl() || '',
    ).toLowerCase();
    return url.endsWith('.docx');
  }

  async toggleSelectedQuizFileResponsePreview(): Promise<void> {
    this.quizFileResponsePreviewOpen = !this.quizFileResponsePreviewOpen;
    if (!this.quizFileResponsePreviewOpen) {
      return;
    }

    if (this.isSelectedQuizFileResponseDocxPreviewable()) {
      await this.loadSelectedQuizFileResponseDocxPreview();
    }
  }

  isSelectedQuizFileResponsePreviewOpen(): boolean {
    return this.quizFileResponsePreviewOpen;
  }

  private async loadSelectedQuizFileResponseDocxPreview(): Promise<void> {
    const url = this.getSelectedQuizFileResponseUrl();
    if (!url) {
      this.quizFileResponseDocxError = 'Lien de la remise indisponible.';
      this.quizFileResponseDocxHtmlPreview = '';
      return;
    }

    this.quizFileResponseDocxLoading = true;
    this.quizFileResponseDocxError = '';

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const mammothModule: any = await import('mammoth/mammoth.browser');
      const result = await mammothModule.convertToHtml({ arrayBuffer });
      this.quizFileResponseDocxHtmlPreview = String(result?.value || '').trim();

      if (!this.quizFileResponseDocxHtmlPreview) {
        this.quizFileResponseDocxError =
          'Apercu indisponible pour ce document DOCX.';
      }
    } catch (error: any) {
      this.quizFileResponseDocxHtmlPreview = '';
      this.quizFileResponseDocxError =
        error?.message || "Impossible de charger l'apercu DOCX.";
    } finally {
      this.quizFileResponseDocxLoading = false;
    }
  }

  private resolveQuizFileUrl(value?: string): string | null {
    const directCandidates = [String(value || '').trim()];

    for (const candidate of directCandidates) {
      if (!candidate) {
        continue;
      }
      if (/^https?:\/\//i.test(candidate)) {
        return candidate;
      }
      if (candidate.startsWith('/uploads/')) {
        return `http://localhost:3000${candidate}`;
      }
      if (candidate.startsWith('uploads/')) {
        return `http://localhost:3000/${candidate}`;
      }
    }

    return null;
  }

  formatQuizFileStatusLabel(status?: 'pending' | 'graded'): string {
    if (status === 'graded') {
      return 'Corrige';
    }
    return 'En attente de correction';
  }

  openProsit(item: SubchapterFolderItem, module: SubchapterContent): void {
    if (item.type !== 'prosit') {
      return;
    }

    this.selectedProsit = {
      title: item.title,
      chapterTitle: this.selectedCourse?.title || 'Chapter',
      subChapterTitle: module.title,
      fileUrl: this.getItemUrl(item),
      fileName: this.getDownloadFileName(item),
      subtitle: item.subtitle,
      dueDate: item.dueDate,
      submissionInstructions: item.submissionInstructions,
    };
    this.selectedPrositSubmissionFile = null;
    this.selectedPrositReportText = '';
    this.selectedPrositReportHtml = '';
    this.prositSubmitMessage = '';
    this.viewMode = 'prosit';
  }

  onPrositEditorInput(event: Event): void {
    const target = event.target as HTMLDivElement;
    const html = String(target?.innerHTML || '');
    const text = String(target?.innerText || '').trim();
    this.selectedPrositReportHtml = html;
    this.selectedPrositReportText = text;
    this.prositSubmitMessage = '';
  }

  applyPrositEditorCommand(command: string): void {
    if (!this.prositEditor?.nativeElement) {
      return;
    }

    this.prositEditor.nativeElement.focus();
    document.execCommand(command, false);
    const html = String(this.prositEditor.nativeElement.innerHTML || '');
    const text = String(this.prositEditor.nativeElement.innerText || '').trim();
    this.selectedPrositReportHtml = html;
    this.selectedPrositReportText = text;
  }

  onPrositSubmissionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedPrositSubmissionFile = (input.files && input.files[0]) || null;
    this.prositSubmitMessage = '';
  }

  get prositReportWordCount(): number {
    const text = String(this.selectedPrositReportText || '').trim();
    if (!text) return 0;
    return text.split(/\s+/).filter((word) => !!word).length;
  }

  submitProsit(): void {
    const reportText = String(this.selectedPrositReportText || '').trim();
    if (!this.selectedPrositSubmissionFile && !reportText) {
      this.prositSubmitMessage =
        'Veuillez ecrire un compte rendu ou deposer un fichier.';
      return;
    }

    if (this.selectedPrositSubmissionFile && reportText) {
      this.prositSubmitMessage = `Compte rendu (${this.prositReportWordCount} mots) et fichier (${this.selectedPrositSubmissionFile.name}) prets pour validation.`;
      return;
    }

    if (this.selectedPrositSubmissionFile) {
      this.prositSubmitMessage = `Fichier pret pour validation: ${this.selectedPrositSubmissionFile.name}`;
      return;
    }

    this.prositSubmitMessage = `Compte rendu pret pour validation (${this.prositReportWordCount} mots).`;
  }

  getPrositFileUrl(): string | null {
    const current = this.selectedProsit;
    if (!current) {
      return null;
    }

    const direct = String(current.fileUrl || '').trim();
    if (/^https?:\/\//i.test(direct)) {
      return direct;
    }

    const subtitle = String(current.subtitle || '').trim();
    if (/^https?:\/\//i.test(subtitle)) {
      return subtitle;
    }
    if (subtitle.startsWith('/uploads/')) {
      return `http://localhost:3000${subtitle}`;
    }

    const name = String(current.fileName || '').trim();
    if (!name) {
      return null;
    }

    if (/^https?:\/\//i.test(name)) {
      return name;
    }
    if (name.startsWith('/uploads/')) {
      return `http://localhost:3000${name}`;
    }

    if (/\.(pdf|doc|docx|ppt|pptx)$/i.test(name)) {
      return `http://localhost:3000/uploads/subjects/cours/${encodeURIComponent(name)}`;
    }

    return null;
  }

  canOpenPrositFile(): boolean {
    return !!this.getPrositFileUrl();
  }

  private buildSubchapterContents(course: CourseItem): SubchapterContent[] {
    const subChapters = Array.isArray(course.sourceSubChapters)
      ? [...course.sourceSubChapters].sort(
          (a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0),
        )
      : [];

    if (subChapters.length > 0) {
      return subChapters.map((subChapter) => {
        const contents = Array.isArray(subChapter?.contents)
          ? subChapter.contents
          : [];

        const folders: Record<FolderKey, SubchapterFolderItem[]> = {
          cours: [],
          exercices: [],
          videos: [],
          ressources: [],
        };

        for (const content of contents) {
          this.pushSubchapterResource(content, folders);
        }

        return {
          title: String(subChapter?.title || 'Untitled subchapter'),
          description: String(subChapter?.description || ''),
          folders,
        };
      });
    }

    return (course.modules || []).map((module) => {
      const links = this.extractFileLinksFromText(module.description || '');
      return {
        title: module.title,
        description: module.description || '',
        folders: {
          cours: [
            ...links.pdfs.map((url) => ({
              title: this.fileNameFromUrl(url),
              subtitle: url,
              type: 'file',
              url,
            })),
            ...links.words.map((url) => ({
              title: this.fileNameFromUrl(url),
              subtitle: url,
              type: 'file',
              url,
            })),
          ],
          exercices: [],
          videos: [],
          ressources: [],
        },
      };
    });
  }

  private pushSubchapterResource(
    content: SubjectChapterContent,
    folders: Record<FolderKey, SubchapterFolderItem[]>,
  ): void {
    const folder = this.resolveContentFolder(content);
    const title = String(content?.title || 'Untitled content').trim();
    const text =
      String(
        content?.quizText || content?.submissionInstructions || '',
      ).trim() || title;
    const url = String(content?.url || '').trim();
    const quizQuestions = Array.isArray(content?.quizQuestions)
      ? content.quizQuestions.map((question) => ({
          question: String(question?.question || '').trim(),
          options: Array.isArray(question?.options)
            ? question.options.map((option) => String(option || '').trim())
            : [],
          correctOptionIndex:
            typeof question?.correctOptionIndex === 'number'
              ? question.correctOptionIndex
              : undefined,
        }))
      : [];

    folders[folder].push({
      contentId: content.contentId,
      title: content.fileName || title,
      subtitle:
        content?.type === 'quiz'
          ? quizQuestions.length
            ? `${quizQuestions.length || 0} question(s)`
            : String(content?.submissionInstructions || '').trim() ||
              String(content?.url || '').trim() ||
              'Quiz fichier (deposez votre reponse)'
          : content?.type === 'code'
            ? String(content?.codeSnippet || '').trim() ||
              String(content?.submissionInstructions || '').trim() ||
              String(content?.quizText || '').trim() ||
              String(content?.url || '').trim() ||
              ''
            : url || text,
      type: String(content?.type || 'file'),
      url: url || undefined,
      codeSnippet: String(content?.codeSnippet || '').trim() || undefined,
      dueDate: content?.dueDate,
      submissionInstructions: content?.submissionInstructions,
      quizId:
        content?.type === 'quiz'
          ? content.contentId || content.fileName || title
          : undefined,
      quizQuestions: content?.type === 'quiz' ? quizQuestions : undefined,
    });
  }

  private resolveContentFolder(content: SubjectChapterContent): FolderKey {
    const folder = String(content?.folder || '').trim() as FolderKey;
    if (folder && this.folderKeys.includes(folder)) {
      return folder;
    }

    if (content?.type === 'quiz' || content?.type === 'prosit') {
      return 'exercices';
    }
    if (content?.type === 'video') {
      return 'videos';
    }
    if (content?.type === 'code') {
      return 'ressources';
    }
    return 'cours';
  }

  private extractFileLinksFromText(text: string): {
    pdfs: string[];
    words: string[];
  } {
    const raw = String(text || '');
    const pdfs = raw.match(/https?:\/\/[^\s)]+\.pdf/gi) || [];
    const words = raw.match(/https?:\/\/[^\s)]+\.(docx?|DOCX?)/g) || [];
    return {
      pdfs: Array.from(new Set(pdfs)),
      words: Array.from(new Set(words)),
    };
  }

  private extractPdfResources(course: CourseItem): CourseContentResource[] {
    const out: CourseContentResource[] = [];
    const texts = [
      course.description,
      ...course.modules.map((m) => m.description),
    ];
    const seen = new Set<string>();

    for (const text of texts) {
      const matches =
        String(text || '').match(/https?:\/\/[^\s)]+\.pdf/gi) || [];
      for (const url of matches) {
        if (seen.has(url)) continue;
        seen.add(url);
        out.push({
          title: this.fileNameFromUrl(url),
          subtitle: url,
          type: 'pdf',
        });
      }
    }

    if (out.length === 0 && course.modules.length > 0) {
      for (const module of course.modules) {
        out.push({
          title: `${module.title} - Notes`,
          subtitle: 'Module material',
          type: 'pdf',
        });
      }
    }

    return out;
  }

  private fileNameFromUrl(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'document.pdf';
  }

  openContinueLearning(courseId: string): void {
    this.router.navigate([`/student-dashboard/continue-learning/${courseId}`]);
  }

  toggleProfileDrawer(): void {
    this.profileDrawerOpen = !this.profileDrawerOpen;
  }

  closeProfileDrawer(): void {
    this.profileDrawerOpen = false;
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    if (this.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  logout(): void {
    this.authService.logout();
  }

  get inProgressCount(): number {
    return this.courses.length;
  }
}
