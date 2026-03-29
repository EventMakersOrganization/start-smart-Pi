import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import {
  catchError,
  concatMap,
  last,
  map,
  switchMap,
  tap,
  timeout,
} from 'rxjs/operators';

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

export interface LearningEventRequest {
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

@Injectable({ providedIn: 'root' })
export class AdaptiveLearningService {
  private apiUrl = 'http://localhost:3000/api/adaptive';
  private chatApiUrl = 'http://localhost:3000/api/chat/ai';
  private goalsStorageKey = 'adaptive_learning_goals_v1';

  constructor(private http: HttpClient) {}

  getProfile(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/profiles/${userId}`);
  }

  getAllProfiles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/profiles`);
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

  startLevelTest(studentId: string): Observable<any> {
    // Call AI service to start level test (100% AI-generated questions)
    return this.http.post<any>(`${this.chatApiUrl}/level-test/start`, {}).pipe(
      map((aiResponse) => {
        // Transform AI response to match component expectations
        if (!aiResponse || !aiResponse.session_id) {
          throw new Error('Invalid AI response');
        }

        const firstQuestion = aiResponse.first_question || {};
        const totalQuestions = aiResponse.total_questions || 1;

        // Build questions array with placeholders
        // First question is real, rest are placeholders that will be fetched on demand
        const questions = [firstQuestion];
        for (let i = 1; i < totalQuestions; i++) {
          questions.push({
            questionIndex: i,
            question: 'Loading next question...',
            options: [],
            difficulty: 'medium',
            topic: 'Loading...',
            subject: 'Loading...',
            progress: { answered: i - 1, total: totalQuestions },
          });
        }

        return {
          _id: aiResponse.session_id, // Component expects _id for submit
          session_id: aiResponse.session_id, // Keep for AI flow
          questions,
          total_questions: totalQuestions,
          subjects: aiResponse.subjects || [],
          status: 'in-progress',
          answers: Array(totalQuestions)
            .fill(null)
            .map((_, i) => ({
              questionIndex: i,
              selectedAnswer: null,
              timeSpent: 0,
            })),
          isAiGenerated: true,
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

  submitLevelTestAnswer(sessionId: string, answer: string): Observable<any> {
    return this.http
      .post(`${this.chatApiUrl}/level-test/submit-answer`, {
        session_id: sessionId,
        answer,
      })
      .pipe(timeout(15000));
  }

  submitLevelTestAnswersToAi(
    sessionId: string,
    answers: Array<{ selectedAnswer?: string | null }>,
    onQuestionLoaded?: (index: number, question: any) => void,
  ): Observable<any> {
    const preparedAnswers = (answers || [])
      .map((a) => (a?.selectedAnswer || '').toString().trim())
      .filter((a) => !!a);

    if (!sessionId || preparedAnswers.length === 0) {
      return of({ status: 'skipped' });
    }

    return from(preparedAnswers).pipe(
      concatMap((answer, index) =>
        this.submitLevelTestAnswer(sessionId, answer).pipe(
          tap((response) => {
            // Inject next question if provided by AI
            if (onQuestionLoaded && response?.next_question) {
              const nextIndex = index + 1;
              onQuestionLoaded(nextIndex, response.next_question);
            }
          }),
        ),
      ),
      last(undefined, { status: 'submitted' }),
      map((lastResponse) => lastResponse || { status: 'submitted' }),
    );
  }

  completeLevelTestAi(sessionId: string): Observable<any> {
    return this.http.post(`${this.chatApiUrl}/level-test/complete`, {
      session_id: sessionId,
    });
  }

  getPersonalizedRecommendations(
    studentProfile: Record<string, any>,
    nResults = 5,
  ): Observable<any> {
    return this.http.post(`${this.chatApiUrl}/recommendations`, {
      student_profile: studentProfile,
      n_results: nResults,
    });
  }

  getLevelTest(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/level-test/student/${studentId}`);
  }

  getLatestCompletedLevelTest(studentId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/level-test/student/${studentId}/latest-completed`,
    );
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
    return this.http.post(`${this.chatApiUrl}/adaptive/event`, payload);
  }

  getAdaptiveLearningState(studentId: string): Observable<any> {
    return this.http.get(`${this.chatApiUrl}/learning-state/${studentId}`);
  }

  getLearningAnalytics(
    studentId: string,
    refresh = false,
  ): Observable<LearningAnalyticsResponse> {
    const params = refresh
      ? new HttpParams().set('refresh', 'true')
      : undefined;
    return this.http.get<LearningAnalyticsResponse>(
      `${this.chatApiUrl}/analytics/learning/${studentId}`,
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
      `${this.chatApiUrl}/analytics/pace/${studentId}`,
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
      `${this.chatApiUrl}/analytics/concepts/${studentId}`,
      { params },
    );
  }

  getInterventionsEffectiveness(
    studentId: string,
  ): Observable<InterventionsEffectivenessResponse> {
    return this.http.get<InterventionsEffectivenessResponse>(
      `${this.chatApiUrl}/interventions/effectiveness/${studentId}`,
    );
  }

  getInterventionsEffectivenessGlobal(): Observable<InterventionsEffectivenessGlobalResponse> {
    return this.http.get<InterventionsEffectivenessGlobalResponse>(
      `${this.chatApiUrl}/interventions/effectiveness`,
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

  getGoalSettings(studentId: string): GoalSettings | null {
    const store = this.readGoalsStore();
    return store[studentId] || null;
  }

  saveGoalSettings(studentId: string, goals: GoalSettings): void {
    const store = this.readGoalsStore();
    store[studentId] = goals;
    localStorage.setItem(this.goalsStorageKey, JSON.stringify(store));
  }

  resetGoalSettings(studentId: string): void {
    const store = this.readGoalsStore();
    delete store[studentId];
    localStorage.setItem(this.goalsStorageKey, JSON.stringify(store));
  }

  private readGoalsStore(): Record<string, GoalSettings> {
    try {
      const raw = localStorage.getItem(this.goalsStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
