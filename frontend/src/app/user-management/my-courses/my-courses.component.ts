import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { AdaptiveLearningService } from '../adaptive-learning.service';

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

interface SubchapterContent {
  title: string;
  description: string;
  pdfs: CourseContentResource[];
  words: CourseContentResource[];
  quizzes: CourseContentResource[];
  exercises: CourseContentResource[];
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
  viewMode: 'subjects' | 'courses' | 'content' = 'subjects';
  profileDrawerOpen = false;
  darkMode = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private adaptiveService: AdaptiveLearningService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadCourses();
    this.checkDarkMode();
  }

  private checkDarkMode(): void {
    this.darkMode = document.documentElement.classList.contains('dark');
  }

  private loadCourses(): void {
    this.subjectsLoading = true;
    this.http
      .get<AiMetadataValuesResponse>(
        `${this.aiServiceUrl}/metadata/available-values/subject`,
      )
      .pipe(
        catchError(() =>
          of<AiMetadataValuesResponse>({
            status: 'error',
            field: 'subject',
            values: [],
          }),
        ),
      )
      .subscribe((res) => {
        const values = Array.isArray(res?.values) ? res.values : [];
        const subjects = values
          .map((v) => String(v || '').trim())
          .filter((v) => !!v);

        if (subjects.length > 0) {
          this.initializeSubjects(subjects);
          this.subjectsLoading = false;
          return;
        }

        // `subject` might not be stored in chunk metadata; fallback to title metadata.
        this.loadSubjectsFromCourseTitlesOrFallback();
      });
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
    this.viewMode = 'courses';
  }

  private loadCourseContent(course: CourseItem): void {
    this.courseLoading = true;
    this.courseResources = this.extractPdfResources(course);
    this.subchapterContents = this.buildSubchapterContents(course);
    this.courseExercises = [];
    this.courseQuizzes = [];

    this.http
      .post<AiAdvancedSearchResponse>(`${this.aiServiceUrl}/search/advanced`, {
        query: course.title,
        n_results: 50,
        sources: ['courses'],
        use_relevance_scoring: false,
      })
      .pipe(
        catchError(() =>
          of<AiAdvancedSearchResponse>({
            status: 'error',
            query: course.title,
            results: [],
          }),
        ),
      )
      .subscribe({
        next: (response) => {
          const rows = Array.isArray(response?.results) ? response.results : [];
          this.courseQuizzes = rows.filter((r: any) =>
            /quiz|qcm|question/i.test(String(r?.chunk_text || '')),
          );
          this.courseExercises = rows.filter((r: any) => {
            const ctype = String(r?.metadata?.chunk_type || '').toLowerCase();
            return (
              ctype === 'exercise' ||
              /exercice|exercise/i.test(String(r?.chunk_text || ''))
            );
          });

          this.enrichSubchapterContentsFromRows(rows);
          this.courseLoading = false;
        },
        error: () => {
          this.courseQuizzes = [];
          this.courseExercises = [];
          this.courseLoading = false;
        },
      });
  }

  private buildSubchapterContents(course: CourseItem): SubchapterContent[] {
    return (course.modules || []).map((module) => {
      const links = this.extractFileLinksFromText(module.description || '');
      return {
        title: module.title,
        description: module.description || '',
        pdfs: links.pdfs.map((url) => ({
          title: this.fileNameFromUrl(url),
          subtitle: url,
          type: 'pdf' as const,
        })),
        words: links.words.map((url) => ({
          title: this.fileNameFromUrl(url),
          subtitle: url,
          type: 'word' as const,
        })),
        quizzes: [],
        exercises: [],
      };
    });
  }

  private enrichSubchapterContentsFromRows(rows: any[]): void {
    if (!this.subchapterContents.length) return;
    for (const row of rows || []) {
      const moduleName = String(row?.metadata?.module_name || '').trim();
      if (!moduleName) continue;

      const target = this.subchapterContents.find(
        (m) => m.title.toLowerCase() === moduleName.toLowerCase(),
      );
      if (!target) continue;

      const text = String(row?.chunk_text || '').trim();
      if (!text) continue;

      const links = this.extractFileLinksFromText(text);
      for (const url of links.pdfs) {
        if (!target.pdfs.some((p) => p.subtitle === url)) {
          target.pdfs.push({
            title: this.fileNameFromUrl(url),
            subtitle: url,
            type: 'pdf',
          });
        }
      }
      for (const url of links.words) {
        if (!target.words.some((w) => w.subtitle === url)) {
          target.words.push({
            title: this.fileNameFromUrl(url),
            subtitle: url,
            type: 'word',
          });
        }
      }

      const ctype = String(row?.metadata?.chunk_type || '').toLowerCase();
      const looksLikeQuiz = /quiz|qcm|question/i.test(text);
      const looksLikeExercise =
        ctype === 'exercise' || /exercice|exercise/i.test(text);

      if (looksLikeQuiz) {
        target.quizzes.push({
          title: target.title,
          subtitle: text.slice(0, 180),
          type: 'quiz',
        });
      }
      if (looksLikeExercise) {
        target.exercises.push({
          title: target.title,
          subtitle: text.slice(0, 180),
          type: 'exercise',
        });
      }
    }
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
