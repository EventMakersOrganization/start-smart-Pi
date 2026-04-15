import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface SubjectQuizQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
}

export interface SubjectChapterContent {
  contentId?: string;
  folder?: 'cours' | 'exercices' | 'videos' | 'ressources';
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
  createdAt?: string;
}

export interface SubjectSubChapter {
  title: string;
  description?: string;
  order: number;
  contents?: SubjectChapterContent[];
}

export interface SubjectChapter {
  title: string;
  description?: string;
  order: number;
  subChapters?: SubjectSubChapter[];
}

export interface SubjectItem {
  _id: string;
  id?: string;
  code: string;
  title: string;
  description?: string;
  chapters: SubjectChapter[];
  instructors?: unknown[];
  instructorId?: any;
  createdAt?: string;
  updatedAt?: string;
}

/** API returns `id`; UI expects `_id`. Default `chapters` when omitted. */
export function normalizeSubjectItem(raw: any): SubjectItem {
  const idVal = raw?._id ?? raw?.id;
  const _id = idVal != null ? String(idVal) : '';
  return {
    ...raw,
    _id,
    chapters: Array.isArray(raw?.chapters) ? raw.chapters : [],
  };
}

@Injectable({ providedIn: 'root' })
export class SubjectsService {
  private apiUrl = 'http://localhost:3000/api/subjects';

  constructor(private http: HttpClient) {}

  getSubjects(instructorId?: string): Observable<SubjectItem[]> {
    const query = instructorId
      ? `?instructorId=${encodeURIComponent(instructorId)}`
      : '';
    return this.http.get<any[]>(`${this.apiUrl}${query}`).pipe(
      map((rows) =>
        Array.isArray(rows) ? rows.map(normalizeSubjectItem) : [],
      ),
    );
  }

  getSubject(id: string): Observable<SubjectItem> {
    return this.http
      .get<any>(`${this.apiUrl}/${id}`)
      .pipe(map(normalizeSubjectItem));
  }

  /**
   * Aggregate progress for the logged-in student (JWT): average module % (exercises, quizzes, content).
   */
  getSubjectLearningProgress(subjectId: string): Observable<{
    percent: number;
    moduleCount: number;
  }> {
    return this.http
      .get<{ percent: number; moduleCount: number }>(
        `${this.apiUrl}/${encodeURIComponent(subjectId)}/learning-progress`,
      )
      .pipe(
        catchError(() => of({ percent: 0, moduleCount: 0 })),
      );
  }

  createSubject(payload: {
    title: string;
    description?: string;
    instructorId?: string;
    instructorIds?: string[];
  }): Observable<SubjectItem> {
    const instructorIds =
      payload.instructorIds?.length && payload.instructorIds.length > 0
        ? payload.instructorIds
        : payload.instructorId
          ? [payload.instructorId]
          : [];
    return this.http
      .post<any>(this.apiUrl, {
        title: payload.title,
        description: payload.description,
        instructorIds,
      })
      .pipe(map(normalizeSubjectItem));
  }

  addChapter(
    subjectId: string,
    payload: { title: string; description?: string; order?: number },
  ): Observable<SubjectItem> {
    return this.http
      .post<any>(`${this.apiUrl}/${subjectId}/chapters`, payload)
      .pipe(map(normalizeSubjectItem));
  }

  deleteChapter(
    subjectId: string,
    chapterOrder: number,
  ): Observable<SubjectItem> {
    return this.http
      .delete<any>(
        `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}`,
      )
      .pipe(map(normalizeSubjectItem));
  }

  addChapterContent(
    subjectId: string,
    chapterOrder: number,
    payload: {
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
    },
  ): Observable<SubjectItem> {
    return this.http
      .post<any>(
        `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/contents`,
        payload,
      )
      .pipe(map(normalizeSubjectItem));
  }

  updateChapterContent(
    subjectId: string,
    chapterOrder: number,
    contentId: string,
    payload: {
      folder?: 'cours' | 'exercices' | 'videos' | 'ressources';
      type?: 'file' | 'quiz' | 'video' | 'link' | 'prosit' | 'code';
      title?: string;
      url?: string;
      quizText?: string;
      quizQuestions?: SubjectQuizQuestion[];
      fileName?: string;
      mimeType?: string;
      dueDate?: string;
      submissionInstructions?: string;
      codeSnippet?: string;
    },
  ): Observable<SubjectItem> {
    return this.http
      .put<any>(
        `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/contents/${contentId}`,
        payload,
      )
      .pipe(map(normalizeSubjectItem));
  }

  deleteChapterContent(
    subjectId: string,
    chapterOrder: number,
    contentId: string,
  ): Observable<SubjectItem> {
    return this.http
      .delete<any>(
        `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/contents/${contentId}`,
      )
      .pipe(map(normalizeSubjectItem));
  }

  // ==================== SubChapter Methods ====================

  addSubChapter(
    subjectId: string,
    chapterOrder: number,
    payload: { title: string; description?: string; order?: number },
  ): Observable<SubjectItem> {
    return this.http
      .post<any>(
        `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/subchapters`,
        payload,
      )
      .pipe(map(normalizeSubjectItem));
  }

  addSubChapterContent(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    payload: {
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
    },
  ): Observable<SubjectItem> {
    return this.http
      .post<any>(
        `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/subchapters/${subChapterOrder}/contents`,
        payload,
      )
      .pipe(map(normalizeSubjectItem));
  }

  updateSubChapterContent(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    contentId: string,
    payload: {
      folder?: 'cours' | 'exercices' | 'videos' | 'ressources';
      type?: 'file' | 'quiz' | 'video' | 'link' | 'prosit' | 'code';
      title?: string;
      url?: string;
      quizText?: string;
      quizQuestions?: SubjectQuizQuestion[];
      fileName?: string;
      mimeType?: string;
      dueDate?: string;
      submissionInstructions?: string;
      codeSnippet?: string;
    },
  ): Observable<SubjectItem> {
    return this.http
      .put<any>(
        `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/subchapters/${subChapterOrder}/contents/${contentId}`,
        payload,
      )
      .pipe(map(normalizeSubjectItem));
  }

  deleteSubChapterContent(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    contentId: string,
  ): Observable<SubjectItem> {
    return this.http
      .delete<any>(
        `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/subchapters/${subChapterOrder}/contents/${contentId}`,
      )
      .pipe(map(normalizeSubjectItem));
  }
}
