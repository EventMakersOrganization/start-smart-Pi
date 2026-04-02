import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { NavigationEnd, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, filter } from 'rxjs';
import {
  AdaptiveLearningService,
  ClassifyDifficultyBatchResponse,
  ClassifyDifficultyResponse,
  ClassifySuggestAdjustmentResponse,
  FeedbackSignalStatsResponse,
  MonitorErrorsResponse,
  MonitorHealthResponse,
  MonitorStatsResponse,
  MonitorThroughputResponse,
  RecordFeedbackResponse,
  UserRatingResponse,
  FeedbackRecommendationsResponse,
  EvaluateBatchResponse,
  EvaluateAnswerResponse,
  LearningAnalyticsResponse,
} from '../adaptive-learning.service';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.css'],
})
export class StudentDashboardComponent implements OnInit, OnDestroy {
  user: any;
  profileData: any = null;

  // Adaptive Learning
  adaptiveProfile: any = null;
  learningState: any = null;
  recommendations: any[] = [];
  performances: any[] = [];
  adaptiveLoading = true;
  adaptivePace = 'unknown';
  adaptiveConfidence = 0;
  adaptiveMastery = 0;
  adaptiveMasteryCount = 0;

  // Learning analytics dashboard
  learningAnalytics: LearningAnalyticsResponse | null = null;
  analyticsLoading = false;
  analyticsError = '';
  analyticsMessage = '';
  analyticsProgressScore = 0;
  analyticsAttempts = 0;
  analyticsTrend = 'stable';
  strongConceptsCount = 0;
  weakConceptsCount = 0;
  conceptStrengths: Array<{ concept?: string; mastery?: number }> = [];
  conceptWeaknesses: Array<{ concept?: string; mastery?: number }> = [];
  conceptsMessage = '';
  interventionStats = {
    count: 0,
    effectiveRate: 0,
    avgDeltaScore: 0,
    byType: {} as Record<string, number>,
  };
  interventionsMessage = '';
  interventionsLastUpdatedAt: number | null = null;
  private relativeClockNow = Date.now();
  private relativeClockHandle: ReturnType<typeof setInterval> | null = null;
  private internalOpsDataLoaded = false;
  predictedSuccessTop = 0;
  predictedSuccessCount = 0;
  paceMode = 'unknown';
  paceTrend = 'stable';
  paceConfidence = 0;

  // Evaluate answer
  evaluationQuestion = '';
  evaluationCorrectAnswer = '';
  evaluationStudentAnswer = '';
  evaluationDifficulty = 'medium';
  evaluationTimeTakenSec: number | null = null;
  evaluationLoading = false;
  evaluationError = '';
  evaluationResult: EvaluateAnswerResponse | null = null;
  batchEvaluationInput = `[
  {
    "question": {
      "question": "What is 2 + 2?",
      "correct_answer": "4",
      "type": "open_ended",
      "difficulty": "easy"
    },
    "student_answer": "4",
    "time_taken": 8
  },
  {
    "question": {
      "question": "Define photosynthesis.",
      "correct_answer": "Process where plants convert light into chemical energy.",
      "type": "open_ended",
      "difficulty": "medium"
    },
    "student_answer": "Plants use sunlight to make food.",
    "time_taken": 22
  }
]`;
  batchEvaluationLoading = false;
  batchEvaluationError = '';
  batchEvaluationResult: EvaluateBatchResponse | null = null;

  // Difficulty classification
  classifyQuestionText = '';
  classifyExplanation = '';
  classifyTopic = '';
  classifySubject = '';
  classifyClaimedDifficulty = '';
  classifyLoading = false;
  classifyError = '';
  classifyResult: ClassifyDifficultyResponse | null = null;
  suggestAdjustmentLoading = false;
  suggestAdjustmentError = '';
  suggestAdjustmentResult: ClassifySuggestAdjustmentResponse | null = null;

  recordFeedbackSignalType = 'question_quality';
  recordFeedbackValue = 5;
  recordFeedbackMetadata = '';
  recordFeedbackLoading = false;
  recordFeedbackError = '';
  recordFeedbackResult: RecordFeedbackResponse | null = null;

  userRatingValue = 5;
  userRatingContext = '';
  userRatingMetadata = '';
  userRatingLoading = false;
  userRatingError = '';
  userRatingResult: UserRatingResponse | null = null;

  feedbackRecommendationsLoading = false;
  feedbackRecommendationsError = '';
  feedbackRecommendationsResult: FeedbackRecommendationsResponse | null = null;

  feedbackStatsSignalType = 'question_quality';
  feedbackStatsLastN = 200;
  feedbackStatsLoading = false;
  feedbackStatsError = '';
  feedbackStatsResult: FeedbackSignalStatsResponse | null = null;

  monitorStatsMinutes = 60;
  monitorStatsLoading = false;
  monitorStatsError = '';
  monitorStatsResult: MonitorStatsResponse | null = null;

  monitorHealthLoading = false;
  monitorHealthError = '';
  monitorHealthResult: MonitorHealthResponse | null = null;

  monitorErrorsLastN = 50;
  monitorErrorsLoading = false;
  monitorErrorsError = '';
  monitorErrorsResult: MonitorErrorsResponse | null = null;

  monitorThroughputMinutes = 60;
  monitorThroughputLoading = false;
  monitorThroughputError = '';
  monitorThroughputResult: MonitorThroughputResponse | null = null;

  classifyBatchInput = `[
  {
    "question": "What is photosynthesis?",
    "explanation": "Define the biological process.",
    "topic": "Biology",
    "subject": "Science"
  },
  {
    "question": "Solve: If f(x)=2x+3 and f(x)=11, find x.",
    "explanation": "Linear equation",
    "topic": "Algebra",
    "subject": "Mathematics",
    "difficulty": "medium"
  }
]`;
  classifyBatchLoading = false;
  classifyBatchError = '';
  classifyBatchResult: ClassifyDifficultyBatchResponse | null = null;

  // Stats
  progress = 0;
  performance = 0;
  completedModules = 0;
  totalModules = 20;
  learningStreak = 0;
  studyHours = 0;

  goalTracking: any = {
    studyHoursCompleted: 0,
    studyHoursGoal: 15,
    quizSuccess: 0,
  };

  alerts: any[] = [];
  showProfileSidebar = false;
  activeNav = 'dashboard';
  private routerEventsSubscription?: Subscription;

  // Topic scores pour les progress rings
  topicRings: any[] = [];

  suggestedCourses: any[] = [
    {
      title: 'Advanced Angular Patterns',
      image: 'assets/img/angular.png',
      level: 'Intermediate',
      duration: '4h 30m',
    },
    {
      title: 'Machine Learning Basics',
      image: 'assets/img/ml.png',
      level: 'Beginner',
      duration: '6h 15m',
    },
    {
      title: 'UI/UX Design Principles',
      image: 'assets/img/design.png',
      level: 'Beginner',
      duration: '3h 45m',
    },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private adaptiveService: AdaptiveLearningService,
  ) {}

  private collectRoles(): string[] {
    const normalized = new Set<string>();

    const addRole = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach((v) => addRole(v));
        return;
      }
      if (typeof value === 'string') {
        const role = value.trim().toLowerCase();
        if (role) {
          normalized.add(role);
        }
      }
    };

    addRole(this.user?.role);
    addRole(this.user?.roles);
    addRole(this.profileData?.user?.role);
    addRole(this.profileData?.user?.roles);

    return Array.from(normalized);
  }

  get canSeeInternalOpsPanels(): boolean {
    const roles = this.collectRoles();
    if (roles.length === 0) {
      return false;
    }

    const privilegedRoles = new Set([
      'admin',
      'superadmin',
      'teacher',
      'instructor',
      'staff',
      'developer',
      'devops',
    ]);

    return roles.some((r) => privilegedRoles.has(r));
  }

  private ensureInternalOpsDataLoaded(): void {
    if (!this.canSeeInternalOpsPanels || this.internalOpsDataLoaded) {
      return;
    }

    this.internalOpsDataLoaded = true;
    this.loadMonitorHealth();
    this.loadMonitorStats();
    this.loadMonitorErrors();
    this.loadMonitorThroughput();
  }

  ngOnInit() {
    this.startRelativeClock();
    this.user = this.authService.getUser();
    this.syncActiveNavFromUrl();
    this.routerEventsSubscription = this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
      )
      .subscribe((event) => this.syncActiveNavFromUrl(event.urlAfterRedirects));
    this.loadProfile();
    this.ensureInternalOpsDataLoaded();
    if (this.user) {
      const forceAnalyticsRefresh = this.consumeForceAnalyticsRefreshFlag();
      this.loadUserInfo();
      this.loadAdaptiveData(forceAnalyticsRefresh);
    }
  }

  ngOnDestroy(): void {
    if (this.relativeClockHandle) {
      clearInterval(this.relativeClockHandle);
      this.relativeClockHandle = null;
    }
    this.routerEventsSubscription?.unsubscribe();
  }

  loadUserInfo(): void {
    this.http.get<any>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        // Merge les infos du backend avec le user actuel
        if (data?.user) {
          this.user = { ...this.user, ...data.user };
        } else if (data) {
          this.user = { ...this.user, ...data };
        }
        this.ensureInternalOpsDataLoaded();
        console.log('✅ User enriched:', this.user);
      },
      error: (err) => {
        console.log('❌ User info error:', err);
      },
    });
  }

  loadProfile() {
    this.http.get<any>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        this.profileData = data;
        if (this.user && data?.user?.phone) {
          this.user.phone = data.user.phone;
        }
        this.ensureInternalOpsDataLoaded();
      },
      error: () => {},
    });
  }

  loadAdaptiveData(forceAnalyticsRefresh = false): void {
    const userId = this.user._id || this.user.id;

    this.loadLearningAnalytics('me', forceAnalyticsRefresh);
    this.loadPaceAnalytics('me', forceAnalyticsRefresh);
    this.loadConceptsAnalytics('me', forceAnalyticsRefresh);
    this.loadInterventionsEffectivenessGlobal();

    // ── Charger état adaptatif courant (AI service) ──
    this.adaptiveService.getAdaptiveLearningState(userId).subscribe({
      next: (data) => {
        const state = data?.learning_state || null;
        this.learningState = state;
        this.adaptivePace = state?.pace_mode || 'unknown';

        const rawConfidence = Number(state?.confidence_score ?? 0);
        this.adaptiveConfidence = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence,
            ),
          ),
        );

        const masteryMap = state?.concept_mastery || {};
        const masteryValues = Object.values(masteryMap)
          .map((v: any) => Number(v))
          .filter((v: number) => Number.isFinite(v));
        this.adaptiveMasteryCount = masteryValues.length;

        if (masteryValues.length > 0) {
          const avg =
            masteryValues.reduce((sum: number, v: number) => sum + v, 0) /
            masteryValues.length;
          this.adaptiveMastery = Math.max(0, Math.min(100, Math.round(avg)));
        } else {
          this.adaptiveMastery = 0;
        }
      },
      error: () => {
        this.learningState = null;
        this.adaptivePace = 'unknown';
        this.adaptiveConfidence = 0;
        this.adaptiveMastery = 0;
        this.adaptiveMasteryCount = 0;
      },
    });

    // ── Charger profil adaptatif ──
    this.adaptiveService.getProfile(userId).subscribe({
      next: (data) => {
        this.adaptiveProfile = data;
        this.progress = data.progress || 0;
        this.adaptiveLoading = false;
        this.buildTopicRings();
        this.updateAlerts();
      },
      error: () => {
        this.adaptiveService
          .createProfile({
            userId,
            level: 'beginner',
            progress: 0,
            strengths: [],
            weaknesses: [],
          })
          .subscribe({
            next: (data) => {
              this.adaptiveProfile = data;
              this.adaptiveLoading = false;
              this.updateAlerts();
            },
            error: () => {
              this.adaptiveLoading = false;
            },
          });
      },
    });

    // ── Charger performances ──
    this.adaptiveService.getPerformances(userId).subscribe({
      next: (data) => {
        this.performances = data;
        if (data.length > 0) {
          const total = data.reduce((sum: number, p: any) => sum + p.score, 0);
          this.performance = Math.round(total / data.length);

          const totalMinutes = data.reduce(
            (sum: number, p: any) => sum + (p.timeSpent || 0),
            0,
          );
          this.studyHours = Math.round((totalMinutes / 60) * 10) / 10;

          this.goalTracking = {
            studyHoursCompleted: this.studyHours,
            studyHoursGoal: 15,
            quizSuccess: this.performance,
          };

          this.completedModules = data.filter((p: any) => p.score >= 70).length;
          this.learningStreak = this.calculateStreak(data);
          this.buildTopicRings();
        }
      },
      error: () => {},
    });

    // ── Charger recommandations ──
    this.adaptiveService.getRecommendations(userId).subscribe({
      next: (data) => {
        this.recommendations = data;
        this.updateAlerts();
      },
      error: () => {
        this.recommendations = [];
      },
    });
  }

  loadLearningAnalytics(studentId: string, refresh = false): void {
    this.analyticsLoading = true;
    this.analyticsError = '';
    this.analyticsMessage = '';

    this.adaptiveService.getLearningAnalytics(studentId, refresh).subscribe({
      next: (data) => {
        this.learningAnalytics = data;
        this.analyticsMessage = String(data?.message || '');

        const daily = data?.daily_progress || {};
        const concepts = data?.concepts || {};
        const pace = data?.pace || {};
        const predicted = Array.isArray(data?.predicted_success)
          ? data.predicted_success
          : [];

        this.analyticsProgressScore = this.normalizePercent(daily.today_score);
        this.analyticsAttempts = Number(daily.attempts ?? 0);
        this.analyticsTrend = String(daily.trend || 'stable');

        this.strongConceptsCount = Array.isArray(concepts.strong_concepts)
          ? concepts.strong_concepts.length
          : 0;
        this.weakConceptsCount = Array.isArray(concepts.weak_concepts)
          ? concepts.weak_concepts.length
          : 0;

        if (this.paceMode === 'unknown') {
          this.paceMode = String(pace.pace_mode || 'unknown');
        }
        if (this.paceConfidence === 0) {
          this.paceConfidence = this.normalizePercent(pace.confidence_score);
        }

        this.predictedSuccessCount = predicted.length;
        this.predictedSuccessTop = predicted.length
          ? this.normalizePercent(predicted[0]?.predicted_success_probability)
          : 0;

        this.analyticsLoading = false;
      },
      error: () => {
        this.learningAnalytics = null;
        this.analyticsMessage = '';
        this.analyticsError = 'Unable to load learning analytics.';
        this.analyticsLoading = false;
      },
    });
  }

  loadPaceAnalytics(studentId: string, refresh = false): void {
    this.adaptiveService.getPaceAnalytics(studentId, refresh).subscribe({
      next: (data) => {
        this.paceMode = String(data?.pace_mode || 'unknown');
        this.paceTrend = String(data?.trend || 'stable');
        this.paceConfidence = this.normalizePercent(data?.confidence_score);
      },
      error: () => {
        this.paceMode = this.paceMode || 'unknown';
        this.paceTrend = this.paceTrend || 'stable';
      },
    });
  }

  loadConceptsAnalytics(studentId: string, refresh = false): void {
    this.adaptiveService.getConceptsAnalytics(studentId, refresh).subscribe({
      next: (data) => {
        this.conceptStrengths = Array.isArray(data?.strong_concepts)
          ? data.strong_concepts
          : [];
        this.conceptWeaknesses = Array.isArray(data?.weak_concepts)
          ? data.weak_concepts
          : [];
        this.conceptsMessage = String(data?.message || '');

        this.strongConceptsCount = this.conceptStrengths.length;
        this.weakConceptsCount = this.conceptWeaknesses.length;
      },
      error: () => {
        this.conceptStrengths = [];
        this.conceptWeaknesses = [];
        this.conceptsMessage = 'Unable to load concept analytics.';
      },
    });
  }

  loadInterventionsEffectiveness(studentId: string): void {
    this.adaptiveService.getInterventionsEffectiveness(studentId).subscribe({
      next: (data) => {
        const stats = data?.stats || {};
        this.interventionStats = {
          count: Number(stats?.count ?? 0),
          effectiveRate: this.normalizePercent(stats?.effective_rate),
          avgDeltaScore:
            Math.round(Number(stats?.avg_delta_score ?? 0) * 10) / 10,
          byType:
            stats?.by_type && typeof stats.by_type === 'object'
              ? (stats.by_type as Record<string, number>)
              : {},
        };
        this.interventionsMessage = String(data?.message || '');
      },
      error: () => {
        this.interventionStats = {
          count: 0,
          effectiveRate: 0,
          avgDeltaScore: 0,
          byType: {},
        };
        this.interventionsMessage =
          'Unable to load intervention effectiveness.';
      },
    });
  }

  loadInterventionsEffectivenessGlobal(): void {
    this.adaptiveService.getInterventionsEffectivenessGlobal().subscribe({
      next: (data) => {
        const stats = data?.stats || {};
        this.interventionStats = {
          count: Number(stats?.count ?? 0),
          effectiveRate: this.normalizePercent(stats?.effective_rate),
          avgDeltaScore:
            Math.round(Number(stats?.avg_delta_score ?? 0) * 10) / 10,
          byType:
            stats?.by_type && typeof stats.by_type === 'object'
              ? (stats.by_type as Record<string, number>)
              : {},
        };
        this.interventionsMessage = String(data?.message || '');
        this.interventionsLastUpdatedAt = Date.now();
      },
      error: () => {
        this.interventionStats = {
          count: 0,
          effectiveRate: 0,
          avgDeltaScore: 0,
          byType: {},
        };
        this.interventionsMessage =
          'Unable to load global intervention effectiveness.';
        this.interventionsLastUpdatedAt = null;
      },
    });
  }

  getInterventionsLastUpdatedRelative(): string {
    if (!this.interventionsLastUpdatedAt) {
      return '';
    }

    const diffSec = Math.max(
      0,
      Math.floor(
        (this.relativeClockNow - this.interventionsLastUpdatedAt) / 1000,
      ),
    );

    if (diffSec < 60) {
      return `il y a ${diffSec}s`;
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return `il y a ${diffMin}min`;
    }

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      return `il y a ${diffHours}h`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `il y a ${diffDays}j`;
  }

  private consumeForceAnalyticsRefreshFlag(): boolean {
    try {
      const key = 'forceAnalyticsRefresh';
      const shouldRefresh = sessionStorage.getItem(key) === '1';
      if (shouldRefresh) {
        sessionStorage.removeItem(key);
      }
      return shouldRefresh;
    } catch {
      return false;
    }
  }

  private startRelativeClock(): void {
    this.relativeClockHandle = setInterval(() => {
      this.relativeClockNow = Date.now();
    }, 1000);
  }

  getEffectiveRateCardClass(): string {
    const rate = Number(this.interventionStats.effectiveRate || 0);
    if (rate >= 75) {
      return 'bg-emerald-50 border-emerald-200';
    }
    if (rate >= 50) {
      return 'bg-orange-50 border-orange-200';
    }
    return 'bg-red-50 border-red-200';
  }

  getEffectiveRateValueClass(): string {
    const rate = Number(this.interventionStats.effectiveRate || 0);
    if (rate >= 75) {
      return 'text-emerald-700';
    }
    if (rate >= 50) {
      return 'text-orange-700';
    }
    return 'text-red-700';
  }

  getPaceCardClass(): string {
    const trend = (this.paceTrend || '').toLowerCase();
    if (trend === 'up') {
      return 'bg-emerald-50 border-emerald-200';
    }
    if (trend === 'down') {
      return 'bg-orange-50 border-orange-200';
    }
    return 'bg-slate-50 border-slate-300';
  }

  getPaceIconWrapClass(): string {
    const trend = (this.paceTrend || '').toLowerCase();
    if (trend === 'up') {
      return 'bg-emerald-100';
    }
    if (trend === 'down') {
      return 'bg-orange-100';
    }
    return 'bg-slate-200';
  }

  getPaceIconClass(): string {
    const trend = (this.paceTrend || '').toLowerCase();
    if (trend === 'up') {
      return 'text-emerald-600';
    }
    if (trend === 'down') {
      return 'text-orange-500';
    }
    return 'text-slate-600';
  }

  getPaceValueClass(): string {
    const trend = (this.paceTrend || '').toLowerCase();
    if (trend === 'up') {
      return 'text-emerald-900';
    }
    if (trend === 'down') {
      return 'text-orange-900';
    }
    return 'text-slate-700';
  }

  evaluateStudentAnswer(): void {
    const question = this.evaluationQuestion.trim();
    const correctAnswer = this.evaluationCorrectAnswer.trim();
    const studentAnswer = this.evaluationStudentAnswer.trim();

    if (!question || !correctAnswer || !studentAnswer) {
      this.evaluationError =
        'Please fill question, correct answer and student answer.';
      return;
    }

    this.evaluationLoading = true;
    this.evaluationError = '';
    this.evaluationResult = null;

    const payload = {
      question: {
        question,
        correct_answer: correctAnswer,
        type: 'open_ended',
        difficulty: this.evaluationDifficulty || 'medium',
      },
      student_answer: studentAnswer,
      time_taken:
        this.evaluationTimeTakenSec && this.evaluationTimeTakenSec > 0
          ? this.evaluationTimeTakenSec
          : null,
    };

    this.adaptiveService.evaluateAnswer(payload).subscribe({
      next: (data) => {
        this.evaluationResult = data;
        this.evaluationLoading = false;
      },
      error: () => {
        this.evaluationError = 'Unable to evaluate answer right now.';
        this.evaluationLoading = false;
      },
    });
  }

  getEvaluationScorePercent(): number {
    if (!this.evaluationResult) {
      return 0;
    }
    const max = Number(this.evaluationResult.max_score ?? 100);
    const score = Number(this.evaluationResult.score ?? 0);
    if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(score)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((score / max) * 100)));
  }

  getEvaluationScoreClass(): string {
    const pct = this.getEvaluationScorePercent();
    if (pct >= 75) {
      return 'text-emerald-700';
    }
    if (pct >= 50) {
      return 'text-orange-700';
    }
    return 'text-red-700';
  }

  evaluateBatchAnswers(): void {
    this.batchEvaluationLoading = true;
    this.batchEvaluationError = '';
    this.batchEvaluationResult = null;

    let parsed: any;
    try {
      parsed = JSON.parse(this.batchEvaluationInput || '[]');
    } catch {
      this.batchEvaluationError = 'Invalid JSON format for batch submissions.';
      this.batchEvaluationLoading = false;
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      this.batchEvaluationError =
        'Batch must be a non-empty JSON array of submissions.';
      this.batchEvaluationLoading = false;
      return;
    }

    const submissions = parsed.map((item: any) => ({
      question: item?.question || {},
      student_answer: String(item?.student_answer ?? ''),
      time_taken:
        item?.time_taken === undefined || item?.time_taken === null
          ? null
          : Number(item.time_taken),
    }));

    this.adaptiveService.evaluateBatch({ submissions }).subscribe({
      next: (data) => {
        this.batchEvaluationResult = data;
        this.batchEvaluationLoading = false;
      },
      error: () => {
        this.batchEvaluationError = 'Unable to run batch evaluation right now.';
        this.batchEvaluationLoading = false;
      },
    });
  }

  classifyDifficulty(): void {
    const question = this.classifyQuestionText.trim();
    if (!question) {
      this.classifyError = 'Please provide a question text.';
      return;
    }

    this.classifyLoading = true;
    this.classifyError = '';
    this.classifyResult = null;

    const payload = {
      question: {
        question,
        explanation: this.classifyExplanation.trim(),
        topic: this.classifyTopic.trim(),
        subject: this.classifySubject.trim(),
        difficulty: this.classifyClaimedDifficulty.trim().toLowerCase(),
      },
    };

    this.adaptiveService.classifyDifficulty(payload).subscribe({
      next: (data) => {
        this.classifyResult = data;
        this.classifyLoading = false;
      },
      error: () => {
        this.classifyError = 'Unable to classify difficulty right now.';
        this.classifyLoading = false;
      },
    });
  }

  classifySuggestAdjustment(): void {
    const question = this.classifyQuestionText.trim();
    if (!question) {
      this.suggestAdjustmentError = 'Please provide a question text.';
      return;
    }

    this.suggestAdjustmentLoading = true;
    this.suggestAdjustmentError = '';
    this.suggestAdjustmentResult = null;

    const payload = {
      question: {
        question,
        explanation: this.classifyExplanation.trim(),
        topic: this.classifyTopic.trim(),
        subject: this.classifySubject.trim(),
        difficulty: this.classifyClaimedDifficulty.trim().toLowerCase(),
      },
    };

    this.adaptiveService.classifySuggestAdjustment(payload).subscribe({
      next: (data) => {
        this.suggestAdjustmentResult = data;
        this.suggestAdjustmentLoading = false;
      },
      error: () => {
        this.suggestAdjustmentError =
          'Unable to suggest difficulty adjustment right now.';
        this.suggestAdjustmentLoading = false;
      },
    });
  }

  recordFeedback(): void {
    if (!this.recordFeedbackSignalType?.trim()) {
      this.recordFeedbackError = 'Please select a signal type.';
      return;
    }

    this.recordFeedbackError = '';
    this.recordFeedbackLoading = true;

    let metadata: Record<string, any> = {};
    if (this.recordFeedbackMetadata?.trim()) {
      try {
        metadata = JSON.parse(this.recordFeedbackMetadata);
      } catch {
        this.recordFeedbackError = 'Invalid metadata JSON';
        this.recordFeedbackLoading = false;
        return;
      }
    }

    const payload = {
      signal_type: this.recordFeedbackSignalType,
      value: this.recordFeedbackValue,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    this.adaptiveService.recordFeedback(payload).subscribe({
      next: (result) => {
        this.recordFeedbackResult = result;
        this.recordFeedbackLoading = false;
        // Reset form after success
        setTimeout(() => {
          this.recordFeedbackSignalType = 'question_quality';
          this.recordFeedbackValue = 5;
          this.recordFeedbackMetadata = '';
          this.recordFeedbackResult = null;
        }, 2000);
      },
      error: (err) => {
        this.recordFeedbackError =
          err?.error?.message || 'Failed to record feedback';
        this.recordFeedbackLoading = false;
      },
    });
  }

  recordUserRating(): void {
    if (this.userRatingValue < 1 || this.userRatingValue > 5) {
      this.userRatingError = 'Rating must be between 1 and 5.';
      return;
    }

    this.userRatingError = '';
    this.userRatingLoading = true;

    let metadata: Record<string, any> = {};
    if (this.userRatingMetadata?.trim()) {
      try {
        metadata = JSON.parse(this.userRatingMetadata);
      } catch {
        this.userRatingError = 'Invalid metadata JSON';
        this.userRatingLoading = false;
        return;
      }
    }

    const payload = {
      rating: this.userRatingValue,
      context: this.userRatingContext || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    this.adaptiveService.recordUserRating(payload).subscribe({
      next: (result) => {
        this.userRatingResult = result;
        this.userRatingLoading = false;
        // Reset form after success
        setTimeout(() => {
          this.userRatingValue = 5;
          this.userRatingContext = '';
          this.userRatingMetadata = '';
          this.userRatingResult = null;
        }, 2000);
      },
      error: (err) => {
        this.userRatingError =
          err?.error?.message || 'Failed to record user rating';
        this.userRatingLoading = false;
      },
    });
  }

  loadFeedbackRecommendations(): void {
    this.feedbackRecommendationsError = '';
    this.feedbackRecommendationsLoading = true;

    this.adaptiveService.getFeedbackRecommendations().subscribe({
      next: (result) => {
        this.feedbackRecommendationsResult = result;
        this.feedbackRecommendationsLoading = false;
      },
      error: (err) => {
        this.feedbackRecommendationsError =
          err?.error?.message || 'Failed to load recommendations';
        this.feedbackRecommendationsLoading = false;
      },
    });
  }

  loadFeedbackSignalStats(): void {
    if (!this.feedbackStatsSignalType?.trim()) {
      this.feedbackStatsError = 'Please select a signal type.';
      return;
    }

    this.feedbackStatsError = '';
    this.feedbackStatsLoading = true;

    const lastN = Number(this.feedbackStatsLastN);
    const safeLastN = Number.isFinite(lastN) && lastN > 0 ? lastN : 200;

    this.adaptiveService
      .getFeedbackSignalStats(this.feedbackStatsSignalType, safeLastN)
      .subscribe({
        next: (result) => {
          this.feedbackStatsResult = result;
          this.feedbackStatsLoading = false;
        },
        error: (err) => {
          this.feedbackStatsError =
            err?.error?.message || 'Failed to load signal stats';
          this.feedbackStatsLoading = false;
        },
      });
  }

  loadMonitorStats(): void {
    this.monitorStatsError = '';
    this.monitorStatsLoading = true;

    const minutes = Number(this.monitorStatsMinutes);
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;

    this.adaptiveService.getMonitorStats(safeMinutes).subscribe({
      next: (result) => {
        this.monitorStatsResult = result;
        this.monitorStatsLoading = false;
      },
      error: (err) => {
        this.monitorStatsError =
          err?.error?.message || 'Failed to load API performance stats';
        this.monitorStatsLoading = false;
      },
    });
  }

  loadMonitorHealth(): void {
    this.monitorHealthError = '';
    this.monitorHealthLoading = true;

    this.adaptiveService.getMonitorHealth().subscribe({
      next: (result) => {
        this.monitorHealthResult = result;
        this.monitorHealthLoading = false;
      },
      error: (err) => {
        this.monitorHealthError =
          err?.error?.message || 'Failed to load global health';
        this.monitorHealthLoading = false;
      },
    });
  }

  loadMonitorErrors(): void {
    this.monitorErrorsError = '';
    this.monitorErrorsLoading = true;

    const lastN = Number(this.monitorErrorsLastN);
    const safeLastN = Number.isFinite(lastN) && lastN > 0 ? lastN : 50;

    this.adaptiveService.getMonitorErrors(safeLastN).subscribe({
      next: (result) => {
        this.monitorErrorsResult = result;
        this.monitorErrorsLoading = false;
      },
      error: (err) => {
        this.monitorErrorsError =
          err?.error?.message || 'Failed to load recent errors';
        this.monitorErrorsLoading = false;
      },
    });
  }

  loadMonitorThroughput(): void {
    this.monitorThroughputError = '';
    this.monitorThroughputLoading = true;

    const minutes = Number(this.monitorThroughputMinutes);
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;

    this.adaptiveService.getMonitorThroughput(safeMinutes).subscribe({
      next: (result) => {
        this.monitorThroughputResult = result;
        this.monitorThroughputLoading = false;
      },
      error: (err) => {
        this.monitorThroughputError =
          err?.error?.message || 'Failed to load throughput';
        this.monitorThroughputLoading = false;
      },
    });
  }

  getRecommendationPriorityClass(priority: string): string {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'medium':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  }

  classifyDifficultyBatch(): void {
    this.classifyBatchLoading = true;
    this.classifyBatchError = '';
    this.classifyBatchResult = null;

    let parsed: any;
    try {
      parsed = JSON.parse(this.classifyBatchInput || '[]');
    } catch {
      this.classifyBatchError = 'Invalid JSON format for questions array.';
      this.classifyBatchLoading = false;
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      this.classifyBatchError =
        'Questions must be a non-empty JSON array of question objects.';
      this.classifyBatchLoading = false;
      return;
    }

    const questions = parsed.map((q: any) =>
      q && typeof q === 'object' ? q : {},
    );

    this.adaptiveService.classifyDifficultyBatch({ questions }).subscribe({
      next: (data) => {
        this.classifyBatchResult = data;
        this.classifyBatchLoading = false;
      },
      error: () => {
        this.classifyBatchError =
          'Unable to classify difficulty batch right now.';
        this.classifyBatchLoading = false;
      },
    });
  }

  getClassifiedDifficultyBadgeClass(): string {
    const level = String(this.classifyResult?.difficulty || '').toLowerCase();
    if (level === 'easy') {
      return 'bg-emerald-50 border-emerald-200';
    }
    if (level === 'hard') {
      return 'bg-red-50 border-red-200';
    }
    return 'bg-orange-50 border-orange-200';
  }

  getClassifiedDifficultyTextClass(): string {
    const level = String(this.classifyResult?.difficulty || '').toLowerCase();
    if (level === 'easy') {
      return 'text-emerald-700';
    }
    if (level === 'hard') {
      return 'text-red-700';
    }
    return 'text-orange-700';
  }

  private normalizePercent(value: unknown): number {
    const raw = Number(value ?? 0);
    if (!Number.isFinite(raw)) return 0;
    const pct = raw <= 1 ? raw * 100 : raw;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  // ── Construit les anneaux par topic ──
  buildTopicRings(): void {
    const colors = [
      'text-primary',
      'text-emerald-500',
      'text-orange-500',
      'text-purple-500',
    ];

    if (this.performances.length > 0) {
      // Grouper par topic
      const topicMap: Record<string, { total: number; count: number }> = {};
      this.performances.forEach((p: any) => {
        const t = p.topic || 'general';
        if (!topicMap[t]) topicMap[t] = { total: 0, count: 0 };
        topicMap[t].total += p.score;
        topicMap[t].count++;
      });

      this.topicRings = Object.entries(topicMap)
        .slice(0, 4)
        .map(([topic, stat], i) => ({
          name: topic,
          score: Math.round(stat.total / stat.count),
          color: colors[i % colors.length],
        }));
    } else if (this.adaptiveProfile) {
      // Fallback : strengths/weaknesses du profil
      const allTopics = [
        ...(this.adaptiveProfile.strengths || []).map((t: string) => ({
          name: t,
          score: 80,
        })),
        ...(this.adaptiveProfile.weaknesses || []).map((t: string) => ({
          name: t,
          score: 35,
        })),
      ].slice(0, 4);

      this.topicRings = allTopics.map((t, i) => ({
        ...t,
        color: colors[i % colors.length],
      }));
    }

    // Fallback si vide
    if (this.topicRings.length === 0) {
      this.topicRings = [
        { name: 'Mathematics', score: 0, color: colors[0] },
        { name: 'Sciences', score: 0, color: colors[1] },
        { name: 'Literature', score: 0, color: colors[2] },
        { name: 'Economics', score: 0, color: colors[3] },
      ];
    }
  }

  updateAlerts(): void {
    this.alerts = [];

    if (!this.adaptiveProfile?.levelTestCompleted) {
      this.alerts.push({
        type: 'warning',
        icon: 'quiz',
        message:
          'Complete your Level Test to get personalized recommendations!',
        action: 'Take Test',
        actionFn: () => this.goToLevelTest(),
      });
    }

    if (this.adaptiveProfile?.weaknesses?.length > 0) {
      this.alerts.push({
        type: 'info',
        icon: 'tips_and_updates',
        message: `Focus areas detected: ${this.adaptiveProfile.weaknesses.slice(0, 3).join(', ')}.`,
      });
    }

    if (this.recommendations.length > 0) {
      this.alerts.push({
        type: 'success',
        icon: 'auto_awesome',
        message: `${this.recommendations.length} personalized recommendations ready for you!`,
      });
    }
  }

  calculateStreak(performances: any[]): number {
    if (performances.length === 0) return 0;
    const dates = performances.map((p: any) =>
      new Date(p.attemptDate).toDateString(),
    );
    const uniqueDates = [...new Set(dates)].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );
    let streak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const diff =
        (new Date(uniqueDates[i]).getTime() -
          new Date(uniqueDates[i + 1]).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  }

  // ── Navigation ──
  goToLevelTest(): void {
    const userId = this.user._id || this.user.id;
    this.adaptiveService.startLevelTest(userId).subscribe({
      next: (test) => {
        this.router.navigate(['/student-dashboard/level-test'], {
          state: { testId: test._id, test },
        });
      },
      error: () => alert('Error starting level test'),
    });
  }

  openLevelTestFromSidebar(): void {
    const userId = this.user?._id || this.user?.id;
    if (!userId) {
      this.activeNav = 'level-test';
      this.router.navigate(['/student-dashboard/level-test']);
      return;
    }

    this.adaptiveService.getLatestCompletedLevelTest(userId).subscribe({
      next: (test) => {
        if (test && test.status === 'completed') {
          this.activeNav = 'level-test-result';
          this.router.navigate(['/student-dashboard/level-test-result'], {
            state: { result: test },
          });
          return;
        }

        this.activeNav = 'level-test';
        this.router.navigate(['/student-dashboard/level-test']);
      },
      error: () => {
        this.activeNav = 'level-test';
        this.router.navigate(['/student-dashboard/level-test']);
      },
    });
  }

  getLevelColor(): string {
    const level = this.adaptiveProfile?.level;
    if (level === 'advanced') return 'bg-green-100 text-green-700';
    if (level === 'intermediate') return 'bg-blue-100 text-blue-700';
    return 'bg-orange-100 text-orange-700';
  }

  getLevelIcon(): string {
    const level = this.adaptiveProfile?.level;
    if (level === 'advanced') return 'workspace_premium';
    if (level === 'intermediate') return 'trending_up';
    return 'school';
  }

  getAlertClass(type: string): string {
    if (type === 'warning')
      return 'bg-orange-50 border-orange-200 text-orange-800';
    if (type === 'success')
      return 'bg-green-50 border-green-200 text-green-800';
    return 'bg-blue-50 border-blue-200 text-blue-800';
  }

  getRecommendationGradient(index: number): string {
    const gradients = [
      'from-primary/40 to-purple-600/40',
      'from-emerald-500/40 to-teal-500/40',
      'from-orange-500/40 to-pink-500/40',
      'from-blue-500/40 to-cyan-500/40',
      'from-violet-500/40 to-purple-500/40',
    ];
    return gradients[index % gradients.length];
  }

  getRecommendationColor(index: number): string {
    const colors = [
      'text-primary',
      'text-emerald-500',
      'text-orange-500',
      'text-blue-500',
      'text-violet-500',
    ];
    return colors[index % colors.length];
  }

  getContentTypeLabel(type: string): string {
    if (type === 'course') return 'Course';
    if (type === 'topic') return 'Topic Review';
    return 'Exercise';
  }

  isSubPageView(): boolean {
    return (
      this.router.url.includes('/student-dashboard/level-test') ||
      this.router.url.includes('/student-dashboard/level-test-result') ||
      this.router.url.includes('/student-dashboard/goal-setting') ||
      this.router.url.includes('/student-dashboard/badges') ||
      this.router.url.includes('/student-dashboard/my-courses') ||
      this.router.url.includes('/student-dashboard/performance') ||
      this.router.url.includes('/student-dashboard/learning-path') ||
      this.router.url.includes('/student-dashboard/assignments') ||
      this.router.url.includes('/student-dashboard/continue-learning')
    );
  }

  private syncActiveNavFromUrl(url: string = this.router.url): void {
    if (url.includes('/student-dashboard/goal-setting')) {
      this.activeNav = 'goal-setting';
      return;
    }

    if (url.includes('/student-dashboard/badges')) {
      this.activeNav = 'badges';
      return;
    }

    if (url.includes('/student-dashboard/level-test-result')) {
      this.activeNav = 'level-test-result';
      return;
    }

    if (url.includes('/student-dashboard/level-test')) {
      this.activeNav = 'level-test';
      return;
    }

    if (url.includes('/student-dashboard/my-courses')) {
      this.activeNav = 'my-courses';
      return;
    }

    if (url.includes('/student-dashboard/performance')) {
      this.activeNav = 'performance';
      return;
    }

    if (url.includes('/student-dashboard/learning-path')) {
      this.activeNav = 'learning-path';
      return;
    }

    if (url.includes('/student-dashboard/assignments')) {
      this.activeNav = 'assignments';
      return;
    }

    this.activeNav = 'dashboard';
  }

  logout() {
    this.authService.logout();
  }
  openProfileSidebar() {
    this.showProfileSidebar = true;
  }
  closeProfileSidebar() {
    this.showProfileSidebar = false;
  }
  manageAccount() {
    this.closeProfileSidebar();
    this.router.navigate(['/profile']);
  }

  onRecommendationViewed(id: string): void {
    const rec = this.recommendations.find((r) => r._id === id);
    if (rec) rec.isViewed = true;
  }
}
