import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, from, of } from 'rxjs';
import {
  catchError,
  concatMap,
  last,
  map,
  switchMap,
  tap,
  timeout,
} from 'rxjs/operators';
import { AuthService } from './auth.service';
import { apiUrl } from '../core/api-url';

export type TargetLevel = 'beginner' | 'intermediate' | 'advanced';

export interface GoalSettings {
  studyHoursPerWeek: number;
  targetTopic: string;
  targetScorePerTopic: number;
  exercisesPerDay: number;
  targetLevel: TargetLevel;
  deadline: string;
  createdAt: string;
}

export type BadgeCategory = 'performance' | 'progress' | 'topic' | 'milestone';

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
}

export interface AchievementBadgesResponse {
  totalBadges: number;
  earnedBadges: number;
  completionRate: number;
  badges: AchievementBadge[];
}

export type ReviewUrgency = 'overdue' | 'due_today' | 'upcoming' | 'scheduled';

export interface SpacedRepetitionSession {
  topic: string;
  lastScore: number;
  lastAttemptDate: string;
  nextReviewDate: string;
  intervalDays: number;
  urgency: ReviewUrgency;
  daysUntilReview: number;
  recommendedDifficulty: string;
}

export interface SpacedRepetitionResponse {
  schedule: SpacedRepetitionSession[];
  overdueCount: number;
  dueTodayCount: number;
  nextSession: {
    topic: string;
    urgency: string;
    date: string;
  } | null;
}

export interface CollaborativeRecommendationItem {
  topic: string;
  reason: string;
  similarStudentsCount: number;
  averageSuccessRate: number;
  suggestedDifficulty: string;
}

export interface CollaborativeRecommendationsResponse {
  recommendations: CollaborativeRecommendationItem[];
  similarStudentsFound: number;
  basedOn: string;
}

export interface StudyGroupMember {
  userId: string;
  level: string;
  commonWeaknesses: string[];
}

export interface StudyGroupSuggestion {
  groupName: string;
  groupType: 'remediation' | 'mixed' | 'advanced';
  commonTopics: string[];
  suggestedActivities: string[];
  compatibilityScore: number;
  members: StudyGroupMember[];
}

export interface StudyGroupSuggestionsResponse {
  suggestedGroups: StudyGroupSuggestion[];
  totalStudentsAnalyzed: number;
  bestMatch: { userId: string; compatibilityScore: number } | null;
}

export interface LearningStyleIndicators {
  averageTimePerExercise: number;
  scoreConsistency: number;
  preferredDifficulty: string;
  preferredTopics: string[];
  sessionsPerWeek: number;
}

export interface LearningStyleResponse {
  primaryStyle: string;
  secondaryStyle: string | null;
  confidence: number;
  styleDescription: string;
  learningTips: string[];
  indicators: LearningStyleIndicators;
}

export interface UnifiedStudentProfileResponse {
  studentId: string;
  profile: any;
  summary: {
    currentLevel: string;
    progress: number;
    strengths: string[];
    weaknesses: string[];
    riskLevel: string;
    totalInteractions: number;
  };
  sources: {
    exercises: any;
    game: any;
    chat: any;
    levelTest: any;
  };
  analytics: {
    learningVelocity: any;
    spacedRepetition: any;
    learningStyle: any;
    learningPath: any;
    achievementBadges: any;
  };
  adaptivePath: Array<{
    topic: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    recommendedActions: string[];
  }>;
}

export interface StudentComparisonAnalyticsResponse {
  studentId: string;
  rankingPercentile: number;
  totalStudents: number;
  student: {
    averageScore: number;
    completionRate: number;
    totalTimeSpent: number;
    streak: number;
  };
  classAverage: {
    averageScore: number;
    completionRate: number;
    totalTimeSpent: number;
    streak: number;
  };
  topStrengths: string[];
  focusTopics: string[];
}

export interface StudentRankHistoryPoint {
  attemptIndex: number;
  rank: number;
  score: number;
  classAverageScore: number;
  classSize: number;
}

export interface StudentRankHistoryResponse {
  studentId: string;
  points: StudentRankHistoryPoint[];
}

export interface StudentQuizRankHistoryPoint {
  attemptIndex: number;
  quizId: string;
  quizTitle: string;
  correctAnswersCount: number;
  totalQuestions: number;
  scorePercentage: number;
  rank: number;
  classSize: number;
  submittedAt: string;
}

export interface StudentQuizRankHistoryResponse {
  studentId: string;
  points: StudentQuizRankHistoryPoint[];
}

export interface LearningEventRequest {
  student_id?: string;
  event_type: 'quiz' | 'exercise' | 'chat' | 'brainrush';
  score?: number;
  duration_sec?: number;
  metadata?: {
    concept?: string;
    topic?: string;
    is_correct?: boolean;
    [key: string]: any;
  };
}

export type ActivityTraceAction =
  | 'subject_open'
  | 'page_view'
  | 'page_leave'
  | 'course_open'
  | 'chapter_open'
  | 'subchapter_open'
  | 'content_open'
  | 'video_start'
  | 'video_pause'
  | 'video_complete'
  | 'quiz_start'
  | 'quiz_submit'
  | 'exercise_start'
  | 'exercise_submit';

export interface ActivityTraceRequest {
  action: ActivityTraceAction;
  page_path?: string;
  resource_type?: string;
  resource_id?: string;
  resource_title?: string;
  duration_sec?: number;
  metadata?: Record<string, any>;
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatbotAskRequest {
  question: string;
  conversation_history?: ChatMessage[];
  mode?: string;
  student_id?: string;
}

export interface ChatbotAskResponse {
  status: string;
  answer?: string;
  sources?: Array<{
    course_id?: string;
    course_title?: string;
    chunk_text?: string;
    similarity?: number;
  }>;
  validation?: Record<string, any>;
  pedagogical_response?: Record<string, any>;
  pace_decision?: Record<string, any>;
  intervention?: Record<string, any>;
  continuous_recommendations?: any[];
}

export interface LearningAnalyticsItem {
  concept?: string;
  mastery?: number;
}

export interface PredictedSuccessItem {
  title?: string;
  predicted_success_probability?: number;
}

export interface LearningAnalyticsResponse {
  status: string;
  initialized?: boolean;
  message?: string;
  daily_progress?: {
    today_score?: number;
    trend?: string;
    attempts?: number;
  };
  concepts?: {
    strong_concepts?: LearningAnalyticsItem[];
    weak_concepts?: LearningAnalyticsItem[];
    unlock_status?: {
      unlocked?: string[];
      locked?: string[];
      threshold?: number;
    };
  };
  pace?: {
    pace_mode?: string;
    confidence_score?: number;
  };
  predicted_success?: PredictedSuccessItem[];
}

export interface PaceAnalyticsResponse {
  status: string;
  pace_mode?: string;
  trend?: string;
  confidence_score?: number;
  initialized?: boolean;
  message?: string;
}

export interface ConceptsAnalyticsResponse {
  status: string;
  strong_concepts?: LearningAnalyticsItem[];
  weak_concepts?: LearningAnalyticsItem[];
  initialized?: boolean;
  message?: string;
}

export interface InterventionsEffectivenessResponse {
  status: string;
  student_id?: string;
  stats?: {
    count?: number;
    effective_rate?: number;
    avg_delta_score?: number;
    by_type?: Record<string, number>;
  };
  message?: string;
}

export interface InterventionsEffectivenessGlobalResponse {
  status: string;
  stats?: {
    count?: number;
    effective_rate?: number;
    avg_delta_score?: number;
    by_type?: Record<string, number>;
  };
  message?: string;
}

export interface PersonalizedRecommendationsAiResponse {
  status: string;
  overall_level?: string;
  overall_mastery?: number;
  recommendations?: any[];
  continuous_recommendations?: any[];
}

export interface EvaluateAnswerRequest {
  question: Record<string, any>;
  student_answer: string;
  time_taken?: number | null;
}

export interface EvaluateAnswerResponse {
  status: string;
  is_correct?: boolean;
  score?: number;
  max_score?: number;
  partial_credit?: number;
  time_bonus?: number;
  feedback?: string;
  correct_answer?: string;
  detailed_result?: Record<string, any>;
}

export interface EvaluateBatchRequestItem {
  question: Record<string, any>;
  student_answer: string;
  time_taken?: number | null;
}

export interface EvaluateBatchRequest {
  submissions: EvaluateBatchRequestItem[];
}

export interface EvaluateBatchResponse {
  status: string;
  count?: number;
  correct?: number;
  incorrect?: number;
  accuracy?: number;
  total_score?: number;
  total_max_score?: number;
  percentage?: number;
  per_answer?: EvaluateAnswerResponse[];
}

export interface ClassifyDifficultyRequest {
  question: Record<string, any>;
}

export interface ClassifyDifficultyResponse {
  status: string;
  difficulty?: string;
  confidence?: number;
  composite_score?: number;
  feature_breakdown?: Record<string, any>;
  suggestions?: string[];
}
export interface ClassifySuggestAdjustmentRequest {
  question: Record<string, any>;
}

export interface ClassifySuggestAdjustmentResponse {
  status: string;
  adjustment_needed?: boolean;
  claimed?: string;
  predicted?: string;
  direction?: string;
  tips?: string[];
  current_score?: number;
}

export interface ClassifyDifficultyBatchRequest {
  questions: Record<string, any>[];
}

export interface ClassifyDifficultyBatchResponse {
  status: string;
  count?: number;
  distribution?: Record<string, number>;
  average_score?: number;
  stdev_score?: number;
  mismatches?: Array<Record<string, any>>;
  per_question?: ClassifyDifficultyResponse[];
}

export interface RecordFeedbackRequest {
  signal_type: string;
  value: number;
  metadata?: Record<string, any>;
}

export interface RecordFeedbackResponse {
  status: string;
  id?: string;
}

export interface UserRatingRequest {
  rating: number;
  context?: string;
  metadata?: Record<string, any>;
}

export interface UserRatingResponse {
  status: string;
  id?: string;
}

export interface FeedbackRecommendation {
  area: string;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface FeedbackRecommendationsResponse {
  status: string;
  generated_at?: string;
  signal_summary?: Record<string, any>;
  topic_accuracy?: Record<string, any>;
  recommendations?: FeedbackRecommendation[];
}

export interface FeedbackSignalStatsResponse {
  status: string;
  signal_type?: string;
  count?: number;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  std?: number;
}

export interface MonitorEndpointStats {
  count?: number;
  mean_latency?: number;
  median_latency?: number;
  p95_latency?: number;
  max_latency?: number;
}

export interface MonitorStatsResponse {
  status: string;
  window_minutes?: number;
  total_requests?: number;
  successes?: number;
  failures?: number;
  success_rate?: number;
  mean_latency?: number;
  median_latency?: number;
  p95_latency?: number;
  per_endpoint?: Record<string, MonitorEndpointStats>;
}

export interface MonitorHealthResponse {
  status: string;
  overall?: string;
  components?: Record<string, any>;
  api_performance_15m?: {
    total_requests?: number;
    success_rate?: number | null;
    median_latency?: number | null;
  };
  checks?: {
    api_success_rate_ok?: boolean;
    api_latency_ok?: boolean;
  };
  checked_at?: string;
}

export interface MonitorErrorItem {
  endpoint?: string;
  latency?: number;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface MonitorErrorsResponse {
  status: string;
  count?: number;
  errors?: MonitorErrorItem[];
}

export interface MonitorThroughputResponse {
  status: string;
  window_minutes?: number;
  total_requests?: number;
  requests_per_minute?: number;
}

export interface PostEvaluationAreaScore {
  topic: string;
  score: number;
  correct: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AdaptiveLearningService {
  private readonly apiUrl = apiUrl('/api/adaptive');
  private readonly chatApiUrl = apiUrl('/api/chat/ai');
  private aiServiceUrl = apiUrl('/ai');
  private readonly trackingApiUrl = apiUrl('/api');
  private readonly learningRecommendationsSubject = new Subject<any[]>();
  readonly learningRecommendations$ =
    this.learningRecommendationsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  getProfile(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/profiles/${userId}`);
  }

  getAllProfiles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/profiles`);
  }

  getUnifiedStudentProfile(
    studentId: string,
  ): Observable<UnifiedStudentProfileResponse> {
    return this.http.get<UnifiedStudentProfileResponse>(
      `${this.apiUrl}/students/${studentId}/unified-profile`,
    );
  }

  getStudentComparisonAnalytics(
    studentId: string,
  ): Observable<StudentComparisonAnalyticsResponse> {
    return this.http.get<StudentComparisonAnalyticsResponse>(
      `${this.apiUrl}/students/${studentId}/comparison`,
    );
  }

  getStudentRankHistory(
    studentId: string,
  ): Observable<StudentRankHistoryResponse> {
    return this.http.get<StudentRankHistoryResponse>(
      `${this.apiUrl}/students/${studentId}/rank-history`,
    );
  }

  getStudentQuizRankHistory(
    studentId: string,
  ): Observable<StudentQuizRankHistoryResponse> {
    return this.http.get<StudentQuizRankHistoryResponse>(
      `${this.apiUrl}/students/${studentId}/quiz-rank-history`,
    );
  }

  getAllPerformances(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/performances`);
  }

  createProfile(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/profiles`, data);
  }

  updateProfile(userId: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/profiles/${userId}`, data);
  }

  getPerformances(studentId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/performances/student/${studentId}`,
    );
  }

  createPerformance(data: {
    studentId: string;
    exerciseId: string;
    score: number;
    timeSpent?: number;
    source?: 'quiz' | 'exercise' | 'brainrush' | 'level-test';
    topic?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/performances`, data);
  }

  getRecommendations(studentId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/recommendations/student/${studentId}`,
    );
  }

  getPersonalizedRecommendationsFromAi(
    studentProfile: Record<string, any>,
    nResults = 5,
  ): Observable<PersonalizedRecommendationsAiResponse> {
    return this.http.post<PersonalizedRecommendationsAiResponse>(
      `${this.aiServiceUrl}/recommendations/personalized`,
      {
        student_profile: studentProfile || {},
        n_results: nResults,
      },
    );
  }

  getCollaborativeRecommendations(
    studentId: string,
  ): Observable<CollaborativeRecommendationsResponse> {
    return this.http.get<CollaborativeRecommendationsResponse>(
      `${this.apiUrl}/recommendations/collaborative/${studentId}`,
    );
  }

  getStudyGroupSuggestions(
    studentId: string,
  ): Observable<StudyGroupSuggestionsResponse> {
    return this.http.get<StudyGroupSuggestionsResponse>(
      `${this.apiUrl}/study-groups/${studentId}`,
    );
  }

  detectLearningStyle(studentId: string): Observable<LearningStyleResponse> {
    return this.http.get<LearningStyleResponse>(
      `${this.apiUrl}/learning-style/${studentId}`,
    );
  }

  startLevelTest(studentId: string): Observable<any> {
    return this.http
      .post<any>(`${this.aiServiceUrl}/level-test/start`, {
        student_id: studentId,
        subjects: [],
      })
      .pipe(
        map((aiResponse) => {
          if (!aiResponse || !aiResponse.session_id) {
            throw new Error('Invalid AI response');
          }

          return {
            _id: aiResponse.session_id,
            session_id: aiResponse.session_id,
            first_question: aiResponse.first_question,
            total_questions: aiResponse.total_questions,
            subjects: aiResponse.subjects || [],
            status: aiResponse.status || 'in-progress',
            isAiGenerated: !!(
              aiResponse?.isAiGenerated ?? aiResponse?.is_ai_generated
            ),
          };
        }),
        catchError((err) => {
          console.error('Level test start error:', err);
          throw err;
        }),
      );
  }

  submitLevelTest(testId: string, answers: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/level-test/${testId}/submit`, {
      answers,
    });
  }

  startLevelTestStage(
    subjects?: string[],
    subjectId?: string,
  ): Observable<any> {
    const studentId = this.resolveCurrentStudentId();
    const body: any = {
      student_id: studentId,
      subjects: subjects || [],
    };
    if (subjectId) {
      body.subject_id = subjectId;
    }
    return this.http.post(`${this.aiServiceUrl}/level-test/start`, body);
  }

  submitLevelTestAnswer(sessionId: string, answer: string): Observable<any> {
    return this.http.post(`${this.aiServiceUrl}/level-test/submit-answer`, {
      session_id: sessionId,
      answer,
    });
  }

  completeLevelTestStage(sessionId: string): Observable<any> {
    return this.http.post(`${this.aiServiceUrl}/level-test/complete`, {
      session_id: sessionId,
    });
  }

  startPostEvaluationStage(weakAreas: string[] = []): Observable<any> {
    const studentId = this.resolveCurrentStudentId();
    return this.http.post(`${this.aiServiceUrl}/post-evaluation/start`, {
      student_id: studentId,
      weak_areas: weakAreas,
    });
  }

  submitPostEvaluationAnswer(
    sessionId: string,
    answer: string,
  ): Observable<any> {
    return this.http.post(
      `${this.aiServiceUrl}/post-evaluation/submit-answer`,
      {
        session_id: sessionId,
        answer,
      },
    );
  }

  completePostEvaluationStage(sessionId: string): Observable<any> {
    return this.http.post(`${this.aiServiceUrl}/post-evaluation/complete`, {
      session_id: sessionId,
    });
  }

  getPostEvaluationSession(sessionId: string): Observable<any> {
    return this.http.get(
      `${this.aiServiceUrl}/post-evaluation/session/${sessionId}`,
    );
  }

  syncPostEvaluationProfileToBackend(
    studentId: string,
    profile: any,
    sessionId?: string,
    postEvaluationResult?: any,
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/post-evaluation/student/${studentId}/sync-profile`,
      {
        profile,
        sessionId,
        postEvaluationResult,
      },
    );
  }

  getLatestCompletedPostEvaluation(studentId: string): Observable<any> {
    return this.http
      .get(
        `${this.apiUrl}/post-evaluation/student/${studentId}/latest-completed`,
      )
      .pipe(catchError(() => of(null)));
  }

  syncLevelTestProfileToBackend(
    studentId: string,
    profile: any,
    sessionId?: string,
    levelTestResult?: any,
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/level-test/student/${studentId}/sync-profile`,
      {
        profile,
        sessionId,
        levelTestResult,
      },
    );
  }

  getLevelTestSession(sessionId: string): Observable<any> {
    return this.http.get(
      `${this.aiServiceUrl}/level-test/session/${sessionId}`,
    );
  }

  getLevelTest(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/level-test/student/${studentId}`);
  }

  getLatestCompletedLevelTest(studentId: string): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/level-test/student/${studentId}/latest-completed`)
      .pipe(catchError(() => of(null)));
  }

  markRecommendationViewed(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/recommendations/${id}/viewed`, {});
  }

  generateRecommendations(studentId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/recommendations/generate/${studentId}`,
      {},
    );
  }

  generateRecommendationsV2(studentId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/recommendations/generate/v2/${studentId}`,
      {},
    );
  }

  getExerciseCompletionTracking(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/tracking/${studentId}`);
  }

  getLearningPath(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/learning-path/${studentId}`);
  }

  getSpacedRepetitionSchedule(
    studentId: string,
  ): Observable<SpacedRepetitionResponse> {
    return this.http.get<SpacedRepetitionResponse>(
      `${this.apiUrl}/spaced-repetition/${studentId}`,
    );
  }

  getWeakAreaRecommendations(studentId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/recommendations/weak-areas/${studentId}`,
    );
  }

  getAchievementBadges(
    studentId: string,
  ): Observable<AchievementBadgesResponse> {
    return this.http.get<AchievementBadgesResponse>(
      `${this.apiUrl}/badges/${studentId}`,
    );
  }

  recordLearningEvent(payload: LearningEventRequest): Observable<any> {
    const studentId = payload.student_id || this.resolveCurrentStudentId();
    return this.http
      .post(`${this.aiServiceUrl}/learning-state/event`, {
        ...payload,
        student_id: studentId,
      })
      .pipe(
        tap((response: any) => {
          const recommendations = Array.isArray(
            response?.continuous_recommendations,
          )
            ? response.continuous_recommendations
            : [];
          this.learningRecommendationsSubject.next(recommendations);
        }),
      );
  }

  recordActivity(payload: ActivityTraceRequest): Observable<any> {
    return this.http.post(`${this.trackingApiUrl}/tracking/event`, payload);
  }

  askChatbot(payload: ChatbotAskRequest): Observable<ChatbotAskResponse> {
    const studentId = payload.student_id || this.resolveCurrentStudentId();
    return this.http.post<ChatbotAskResponse>(
      `${this.aiServiceUrl}/chatbot/ask`,
      {
        question: payload.question,
        conversation_history: payload.conversation_history || [],
        mode: payload.mode || null,
        student_id: studentId,
      },
    );
  }

  getLearningRecommendationsStream(): Observable<any[]> {
    return this.learningRecommendations$;
  }

  getAdaptiveLearningState(studentId: string): Observable<any> {
    return this.http.get(`${this.aiServiceUrl}/learning-state/${studentId}`);
  }

  getLearningAnalytics(
    studentId: string,
    refresh = false,
  ): Observable<LearningAnalyticsResponse> {
    const params = refresh
      ? new HttpParams().set('refresh', 'true')
      : undefined;
    return this.http.get<LearningAnalyticsResponse>(
      `${this.aiServiceUrl}/analytics/learning/${studentId}`,
      { params },
    );
  }

  getPaceAnalytics(
    studentId: string,
    refresh = false,
  ): Observable<PaceAnalyticsResponse> {
    const params = refresh
      ? new HttpParams().set('refresh', 'true')
      : undefined;
    return this.http.get<PaceAnalyticsResponse>(
      `${this.aiServiceUrl}/analytics/pace/${studentId}`,
      { params },
    );
  }

  getConceptsAnalytics(
    studentId: string,
    refresh = false,
  ): Observable<ConceptsAnalyticsResponse> {
    const params = refresh
      ? new HttpParams().set('refresh', 'true')
      : undefined;
    return this.http.get<ConceptsAnalyticsResponse>(
      `${this.aiServiceUrl}/analytics/concepts/${studentId}`,
      { params },
    );
  }

  getInterventionsEffectiveness(
    studentId: string,
  ): Observable<InterventionsEffectivenessResponse> {
    return this.http.get<InterventionsEffectivenessResponse>(
      `${this.aiServiceUrl}/interventions/effectiveness/${studentId}`,
    );
  }

  getInterventionsEffectivenessGlobal(): Observable<InterventionsEffectivenessGlobalResponse> {
    return this.http.get<InterventionsEffectivenessGlobalResponse>(
      `${this.aiServiceUrl}/interventions/effectiveness`,
    );
  }

  evaluateAnswer(
    payload: EvaluateAnswerRequest,
  ): Observable<EvaluateAnswerResponse> {
    return this.http.post<EvaluateAnswerResponse>(
      `${this.chatApiUrl}/evaluate/answer`,
      payload,
    );
  }

  evaluateBatch(
    payload: EvaluateBatchRequest,
  ): Observable<EvaluateBatchResponse> {
    return this.http.post<EvaluateBatchResponse>(
      `${this.chatApiUrl}/evaluate/batch`,
      payload,
    );
  }

  classifyDifficulty(
    payload: ClassifyDifficultyRequest,
  ): Observable<ClassifyDifficultyResponse> {
    return this.http.post<ClassifyDifficultyResponse>(
      `${this.chatApiUrl}/classify/difficulty`,
      payload,
    );
  }

  classifySuggestAdjustment(
    payload: ClassifySuggestAdjustmentRequest,
  ): Observable<ClassifySuggestAdjustmentResponse> {
    return this.http.post<ClassifySuggestAdjustmentResponse>(
      `${this.chatApiUrl}/classify/suggest-adjustment`,
      payload,
    );
  }

  classifyDifficultyBatch(
    payload: ClassifyDifficultyBatchRequest,
  ): Observable<ClassifyDifficultyBatchResponse> {
    return this.http.post<ClassifyDifficultyBatchResponse>(
      `${this.chatApiUrl}/classify/difficulty-batch`,
      payload,
    );
  }

  recordFeedback(
    payload: RecordFeedbackRequest,
  ): Observable<RecordFeedbackResponse> {
    return this.http.post<RecordFeedbackResponse>(
      `${this.chatApiUrl}/feedback/record`,
      payload,
    );
  }

  recordUserRating(payload: UserRatingRequest): Observable<UserRatingResponse> {
    return this.http.post<UserRatingResponse>(
      `${this.chatApiUrl}/feedback/user-rating`,
      payload,
    );
  }

  getFeedbackRecommendations(): Observable<FeedbackRecommendationsResponse> {
    return this.http.get<FeedbackRecommendationsResponse>(
      `${this.chatApiUrl}/feedback/recommendations`,
    );
  }

  getFeedbackSignalStats(
    signalType: string,
    lastN = 200,
  ): Observable<FeedbackSignalStatsResponse> {
    return this.http.get<FeedbackSignalStatsResponse>(
      `${this.chatApiUrl}/feedback/stats/${encodeURIComponent(signalType)}?last_n=${lastN}`,
    );
  }

  getMonitorStats(minutes = 60): Observable<MonitorStatsResponse> {
    return this.http.get<MonitorStatsResponse>(
      `${this.chatApiUrl}/monitor/stats?minutes=${minutes}`,
    );
  }

  getMonitorHealth(): Observable<MonitorHealthResponse> {
    return this.http.get<MonitorHealthResponse>(
      `${this.chatApiUrl}/monitor/health`,
    );
  }

  private resolveCurrentStudentId(): string | undefined {
    const user = this.authService.getUser();
    return user?.id || user?._id || undefined;
  }

  getMonitorErrors(lastN = 50): Observable<MonitorErrorsResponse> {
    return this.http.get<MonitorErrorsResponse>(
      `${this.chatApiUrl}/monitor/errors?last_n=${lastN}`,
    );
  }

  getMonitorThroughput(minutes = 60): Observable<MonitorThroughputResponse> {
    return this.http.get<MonitorThroughputResponse>(
      `${this.chatApiUrl}/monitor/throughput?minutes=${minutes}`,
    );
  }

  getGoalSettings(studentId: string): Observable<GoalSettings | null> {
    return this.http
      .get<GoalSettings | null>(`${this.apiUrl}/goals/${studentId}`)
      .pipe(catchError(() => of(null)));
  }

  saveGoalSettings(
    studentId: string,
    goals: GoalSettings,
  ): Observable<GoalSettings> {
    return this.http.put<GoalSettings>(
      `${this.apiUrl}/goals/${studentId}`,
      goals,
    );
  }

  resetGoalSettings(studentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/goals/${studentId}`);
  }
}
