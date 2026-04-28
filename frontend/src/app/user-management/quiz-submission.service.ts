import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface QuizAnswerDto {
  questionIndex: number;
  selectedOptionIndex: number | null;
  correctOptionIndex?: number;
  isCorrect: boolean;
}

interface SubmitQuizRequestDto {
  quizId: string;
  quizTitle: string;
  subjectTitle: string;
  chapterTitle: string;
  subChapterTitle: string;
  totalQuestions: number;
  scoreObtained: number;
  answers: QuizAnswerDto[];
}

interface QuizSubmissionResponse {
  _id: string;
  studentId: string;
  quizId: string;
  quizTitle: string;
  subjectTitle: string;
  chapterTitle: string;
  subChapterTitle: string;
  totalQuestions: number;
  scoreObtained: number;
  scorePercentage: number;
  answers: QuizAnswerDto[];
  submittedAt: string;
  updatedAt?: string;
}

export interface QuizFileSubmissionResponse {
  _id: string;
  studentId:
    | string
    | {
        _id?: string;
        first_name?: string;
        last_name?: string;
        email?: string;
      };
  quizId: string;
  quizTitle: string;
  subjectTitle: string;
  chapterTitle: string;
  subChapterTitle: string;
  responseFileUrl: string;
  responseFileName: string;
  responseMimeType?: string;
  status: 'pending' | 'graded';
  grade?: number;
  teacherFeedback?: string;
  correctAnswersCount?: number;
  totalQuestionsCount?: number;
  submittedAt: string;
  gradedAt?: string;
}

export interface GradeQuizFileSubmissionRequestDto {
  grade: number;
  teacherFeedback?: string;
  correctAnswersCount?: number;
  totalQuestionsCount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class QuizSubmissionService {
  private apiUrl = 'http://localhost:3000/api/subjects';

  constructor(private http: HttpClient) {}

  submitQuiz(
    submitData: SubmitQuizRequestDto,
  ): Observable<QuizSubmissionResponse> {
    console.log('Submitting quiz data:', submitData);
    return this.http.post<QuizSubmissionResponse>(
      `${this.apiUrl}/quiz-submissions/submit`,
      submitData,
    );
  }

  getStudentQuizSubmissions(): Observable<QuizSubmissionResponse[]> {
    return this.http.get<QuizSubmissionResponse[]>(
      `${this.apiUrl}/quiz-submissions/student`,
    );
  }

  getQuizSubmission(submissionId: string): Observable<QuizSubmissionResponse> {
    return this.http.get<QuizSubmissionResponse>(
      `${this.apiUrl}/quiz-submissions/${submissionId}`,
    );
  }

  getLatestQuizSubmission(
    quizId: string,
  ): Observable<QuizSubmissionResponse | null> {
    return this.http.get<QuizSubmissionResponse | null>(
      `${this.apiUrl}/quiz-submissions/${quizId}/latest`,
    );
  }

  submitQuizFile(formData: FormData): Observable<QuizFileSubmissionResponse> {
    return this.http.post<QuizFileSubmissionResponse>(
      `${this.apiUrl}/quiz-file-submissions/submit`,
      formData,
    );
  }

  getStudentQuizFileSubmissions(): Observable<QuizFileSubmissionResponse[]> {
    return this.http.get<QuizFileSubmissionResponse[]>(
      `${this.apiUrl}/quiz-file-submissions/student`,
    );
  }

  getInstructorQuizFileSubmissions(): Observable<QuizFileSubmissionResponse[]> {
    return this.http.get<QuizFileSubmissionResponse[]>(
      `${this.apiUrl}/quiz-file-submissions/instructor`,
    );
  }

  gradeQuizFileSubmission(
    submissionId: string,
    payload: GradeQuizFileSubmissionRequestDto,
  ): Observable<QuizFileSubmissionResponse> {
    return this.http.put<QuizFileSubmissionResponse>(
      `${this.apiUrl}/quiz-file-submissions/${encodeURIComponent(submissionId)}/grade`,
      payload,
    );
  }
}
