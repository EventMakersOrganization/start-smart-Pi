import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PrositSubmissionResponse {
  _id: string;
  prositTitle: string;
  subjectTitle?: string;
  chapterTitle: string;
  subChapterTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  reportText?: string;
  reportHtml?: string;
  wordCount?: number;
  fileName?: string;
  filePath?: string;
  dueDate?: string;
  status: 'submitted' | 'graded' | 'reviewed';
  grade?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
}

interface WrappedPrositSubmissionsResponse {
  success?: boolean;
  submissions?: PrositSubmissionResponse[];
}

interface WrappedPrositSubmissionResponse {
  success?: boolean;
  message?: string;
  submission?: PrositSubmissionResponse;
}

@Injectable({
  providedIn: 'root',
})
export class PrositSubmissionService {
  private readonly apiUrl = 'http://localhost:3000/api/prosits';

  constructor(private http: HttpClient) {}

  submitProsit(
    formData: FormData,
  ): Observable<WrappedPrositSubmissionResponse> {
    return this.http.post<WrappedPrositSubmissionResponse>(
      `${this.apiUrl}/submit`,
      formData,
    );
  }

  getStudentPrositSubmissions(
    studentId: string,
  ): Observable<WrappedPrositSubmissionsResponse> {
    return this.http.get<WrappedPrositSubmissionsResponse>(
      `${this.apiUrl}/student/${encodeURIComponent(studentId)}`,
    );
  }

  getInstructorPrositSubmissions(
    instructorId: string,
  ): Observable<WrappedPrositSubmissionsResponse> {
    return this.http.get<WrappedPrositSubmissionsResponse>(
      `${this.apiUrl}/instructor/${encodeURIComponent(instructorId)}`,
    );
  }

  gradePrositSubmission(
    submissionId: string,
    payload: { grade: number; feedback?: string },
  ): Observable<WrappedPrositSubmissionResponse> {
    return this.http.post<WrappedPrositSubmissionResponse>(
      `${this.apiUrl}/${encodeURIComponent(submissionId)}/grade`,
      payload,
    );
  }
}
