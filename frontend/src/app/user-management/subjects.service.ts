import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  code: string;
  title: string;
  description?: string;
  chapters: SubjectChapter[];
  instructorId?: any;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class SubjectsService {
  private apiUrl = 'http://localhost:3000/api/subjects';

  constructor(private http: HttpClient) {}

  getSubjects(instructorId?: string): Observable<SubjectItem[]> {
    const query = instructorId
      ? `?instructorId=${encodeURIComponent(instructorId)}`
      : '';
    return this.http.get<SubjectItem[]>(`${this.apiUrl}${query}`);
  }

  getSubject(id: string): Observable<SubjectItem> {
    return this.http.get<SubjectItem>(`${this.apiUrl}/${id}`);
  }

  createSubject(payload: {
    title: string;
    description?: string;
    instructorId?: string;
  }): Observable<SubjectItem> {
    return this.http.post<SubjectItem>(this.apiUrl, payload);
  }

  addChapter(
    subjectId: string,
    payload: { title: string; description?: string; order?: number },
  ): Observable<SubjectItem> {
    return this.http.post<SubjectItem>(
      `${this.apiUrl}/${subjectId}/chapters`,
      payload,
    );
  }

  deleteChapter(
    subjectId: string,
    chapterOrder: number,
  ): Observable<SubjectItem> {
    return this.http.delete<SubjectItem>(
      `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}`,
    );
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
    return this.http.post<SubjectItem>(
      `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/contents`,
      payload,
    );
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
    return this.http.put<SubjectItem>(
      `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/contents/${contentId}`,
      payload,
    );
  }

  deleteChapterContent(
    subjectId: string,
    chapterOrder: number,
    contentId: string,
  ): Observable<SubjectItem> {
    return this.http.delete<SubjectItem>(
      `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/contents/${contentId}`,
    );
  }

  // ==================== SubChapter Methods ====================

  addSubChapter(
    subjectId: string,
    chapterOrder: number,
    payload: { title: string; description?: string; order?: number },
  ): Observable<SubjectItem> {
    return this.http.post<SubjectItem>(
      `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/subchapters`,
      payload,
    );
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
    return this.http.post<SubjectItem>(
      `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/subchapters/${subChapterOrder}/contents`,
      payload,
    );
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
    return this.http.put<SubjectItem>(
      `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/subchapters/${subChapterOrder}/contents/${contentId}`,
      payload,
    );
  }

  deleteSubChapterContent(
    subjectId: string,
    chapterOrder: number,
    subChapterOrder: number,
    contentId: string,
  ): Observable<SubjectItem> {
    return this.http.delete<SubjectItem>(
      `${this.apiUrl}/${subjectId}/chapters/${chapterOrder}/subchapters/${subChapterOrder}/contents/${contentId}`,
    );
  }
}
