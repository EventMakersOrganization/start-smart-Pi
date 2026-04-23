import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { AuthService } from '../auth.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-level-test',
  templateUrl: './level-test.component.html',
  styleUrls: ['./level-test.component.css'],
})
export class LevelTestComponent implements OnInit, OnDestroy {
  loading = true;
  submitting = false;
  submittingAnswer = false;
  user: any;
  userFullName = '';

  testData: any;
  currentQuestionIndex = 0;
  loadedQuestionsCount = 0;
  sessionId: string | null = null;
  loadingNextQuestion = false;
  nextErrorMessage = '';
  private submittedQuestionIndexes = new Set<number>();

  // Format matching backend expectations
  answers: {
    questionIndex: number;
    selectedAnswer: string | null;
    timeSpent: number;
    isCorrect?: boolean;
    serverSubmitted?: boolean;
  }[] = [];

  timeRemaining = 1800; // 60 minutes
  timerInterval: any;
  questionStartTime = Date.now();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private adaptiveService: AdaptiveLearningService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    this.user = this.authService.getUser();
    if (!this.user) {
      this.router.navigate(['/login']);
      return;
    }

    this.userFullName =
      `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim() ||
      'Student';
    
    this.route.queryParams.subscribe(params => {
      const subject = params['subject'];
      this.initializeTest(subject ? [subject] : []);
    });
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  initializeTest(subjects: string[] = []) {
    this.adaptiveService.startLevelTestStage(subjects).subscribe({
      next: (response) => this.setupTestFromSession(response),
      error: () => (this.loading = false),
    });
  }

  setupTestFromSession(response: any) {
    const firstQuestion = this.mapQuestion(response?.first_question);
    const totalQuestions = response?.total_questions || 0;
    const isAiGenerated = !!(
      response?.isAiGenerated ?? response?.is_ai_generated
    );

    this.sessionId = response?.session_id || null;
    this.loadedQuestionsCount = firstQuestion ? 1 : 0;
    this.submittedQuestionIndexes.clear();

    this.testData = {
      session_id: this.sessionId,
      isAiGenerated,
      total_questions: totalQuestions,
      questions: Array.from({ length: totalQuestions }).map((_, i) =>
        i === 0 && firstQuestion
          ? firstQuestion
          : {
              questionText: '',
              options: [],
              difficulty: '',
              topic: '',
              pending: true,
            },
      ),
    };

    this.answers = Array.from({ length: totalQuestions }).map((_, i) => ({
      questionIndex: i,
      selectedAnswer: null,
      timeSpent: 0,
      isCorrect: undefined,
      serverSubmitted: false,
    }));

    this.loading = false;
    this.questionStartTime = Date.now();

    // Pre-fetch next questions if AI-generated (background load)
    if (this.testData?.isAiGenerated && this.testData?.session_id) {
      this.prefetchNextQuestions();
    }

    // START TIMER ONLY AFTER TEST IS LOADED
    this.startTimer();
  }

  private questionsCache: Map<number, any> = new Map();
  private aiSubmittedQuestions: Set<number> = new Set<number>();

  prefetchNextQuestions() {
    // Pre-cache the first question we already have
    if (this.testData?.questions?.[0]) {
      this.questionsCache.set(0, this.testData.questions[0]);
    }
  }

  private mapQuestion(question: any): any {
    if (!question) return null;
    return {
      questionText: question.question || '',
      options: question.options || [],
      difficulty: question.difficulty || 'medium',
      topic: question.topic || 'General',
      subject: question.subject || '',
      pending: false,
    };
  }

  get currentQuestion() {
    if (!this.testData) return null;

    // For AI-generated tests, questions are loaded dynamically
    const questions = this.testData.questions || [];

    if (this.currentQuestionIndex < questions.length) {
      const q = questions[this.currentQuestionIndex];
      // Return null if it's a placeholder (loading state)
      if (q && q.options && q.options.length > 0) {
        return q;
      }
      if (q && q.question && q.question !== 'Loading next question...') {
        return q;
      }
    }

    // If question not loaded yet, return null (template will show loading or nothing)
    return null;
  }

  formatQuestionText(question: any): string {
    const raw = (question?.questionText || question?.question || '')
      .toString()
      .trim();
    if (!raw) return '';

    // Remove noisy heading lines such as: "Quiz 1 : ..."
    const lines = raw
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => !!l);

    if (lines.length > 1 && /^quiz\s*\d+/i.test(lines[0])) {
      return lines.slice(1).join(' ');
    }
    return lines.join(' ');
  }

  formatOptionText(option: any): string {
    const raw = (option || '').toString().trim();
    if (!raw) return '';

    // Remove duplicated prefixes like "A. ...", "B) ..."
    return raw.replace(/^\s*[A-Ea-e]\s*[\.)]\s*/, '').trim();
  }

  injectLoadedQuestion(questionIndex: number, question: any) {
    if (
      this.testData &&
      this.testData.questions &&
      questionIndex < this.testData.questions.length
    ) {
      this.testData.questions[questionIndex] = question;
    }
  }

  selectAnswer(answer: string) {
    this.nextErrorMessage = '';
    if (
      this.testData?.isAiGenerated &&
      this.aiSubmittedQuestions.has(this.currentQuestionIndex)
    ) {
      return;
    }

    const timeSpentOnQuestion = Math.round(
      (Date.now() - this.questionStartTime) / 1000,
    );

    this.answers[this.currentQuestionIndex] = {
      questionIndex: this.currentQuestionIndex,
      selectedAnswer: answer,
      timeSpent:
        (this.answers[this.currentQuestionIndex]?.timeSpent || 0) +
        timeSpentOnQuestion,
    };

    this.questionStartTime = Date.now(); // reset tracking for next toggle/view
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.loadedQuestionsCount - 1) {
      this.updateTimeSpent();
      this.currentQuestionIndex++;
      this.questionStartTime = Date.now();
      return;
    }

    this.submitCurrentAnswerAndFetchNext();
  }

  canGoNext(): boolean {
    if (!this.testData?.questions?.length) return false;
    if (this.loadingNextQuestion) return false;
    if (this.currentQuestionIndex >= this.testData.questions.length - 1) {
      return false;
    }

    if (this.testData?.isAiGenerated && this.testData?.session_id) {
      const selected =
        this.answers?.[this.currentQuestionIndex]?.selectedAnswer
          ?.toString()
          .trim() || '';
      return !!selected;
    }

    return true;
  }

  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.updateTimeSpent();
      this.currentQuestionIndex--;
      this.questionStartTime = Date.now();
    }
  }

  goToQuestion(index: number) {
    if (index >= 0 && index < this.loadedQuestionsCount) {
      this.updateTimeSpent();
      this.currentQuestionIndex = index;
      this.questionStartTime = Date.now();

      // Pre-load question if AI-generated
      if (this.testData?.isAiGenerated && this.testData?.session_id) {
        this.loadQuestionAtIndex(index);
      }
    }
  }

  private loadQuestionAtIndex(index: number): void {
    const cached = this.questionsCache.get(index);
    if (cached) {
      this.injectLoadedQuestion(index, cached);
    }
  }

  private submitCurrentAnswerAndFetchNext(onDone?: () => void) {
    if (this.submittingAnswer || !this.sessionId) return;

    const currentAnswer =
      this.answers[this.currentQuestionIndex]?.selectedAnswer;
    if (!currentAnswer) return;

    if (this.submittedQuestionIndexes.has(this.currentQuestionIndex)) {
      if (onDone) onDone();
      return;
    }

    this.updateTimeSpent();
    this.submittingAnswer = true;
    const currentQuestion =
      this.testData?.questions?.[this.currentQuestionIndex];

    this.adaptiveService
      .submitLevelTestAnswer(this.sessionId, currentAnswer)
      .subscribe({
        next: (result) => {
          this.submittedQuestionIndexes.add(this.currentQuestionIndex);
          this.answers[this.currentQuestionIndex].serverSubmitted = true;
          this.answers[this.currentQuestionIndex].isCorrect = !!result?.correct;

          const nextQuestion = this.mapQuestion(result?.next_question);
          if (
            nextQuestion &&
            this.loadedQuestionsCount < this.testData.questions.length
          ) {
            this.testData.questions[this.loadedQuestionsCount] = nextQuestion;
            this.loadedQuestionsCount += 1;
            this.currentQuestionIndex = Math.min(
              this.currentQuestionIndex + 1,
              this.loadedQuestionsCount - 1,
            );
            this.questionStartTime = Date.now();
          }

          this.recordLearningEvent({
            eventType: 'quiz',
            score: result?.correct ? 100 : 0,
            durationSec: Math.max(
              0,
              Math.round(
                this.answers[this.currentQuestionIndex]?.timeSpent || 0,
              ),
            ),
            concept:
              currentQuestion?.topic || currentQuestion?.subject || 'general',
            isCorrect: !!result?.correct,
          });

          this.submittingAnswer = false;
          if (onDone) onDone();
        },
        error: (err) => {
          console.error('Error submitting answer', err);
          this.submittingAnswer = false;
        },
      });
  }

  private recordLearningEvent(options: {
    eventType: 'quiz' | 'exercise' | 'chat' | 'brainrush';
    score?: number;
    durationSec?: number;
    concept?: string;
    isCorrect?: boolean;
  }): void {
    const studentId = this.user?._id || this.user?.id;
    if (!studentId) {
      return;
    }

    this.adaptiveService
      .recordLearningEvent({
        student_id: studentId,
        event_type: options.eventType,
        score: options.score,
        duration_sec: options.durationSec,
        metadata: {
          concept: options.concept,
          topic: options.concept,
          is_correct: options.isCorrect,
          source: 'level-test',
        },
      })
      .subscribe({
        next: () => {},
        error: () => {},
      });
  }

  updateTimeSpent() {
    const timeSpentOnQuestion = Math.round(
      (Date.now() - this.questionStartTime) / 1000,
    );
    if (!this.answers[this.currentQuestionIndex]) {
      this.answers[this.currentQuestionIndex] = {
        questionIndex: this.currentQuestionIndex,
        selectedAnswer: '',
        timeSpent: timeSpentOnQuestion,
      };
    } else {
      this.answers[this.currentQuestionIndex].timeSpent += timeSpentOnQuestion;
    }
  }

  countCompleted(): number {
    return this.answers.filter((a) => !!a?.selectedAnswer).length;
  }

  getProgressPercentage(): number {
    if (!this.testData?.questions?.length) return 0;
    return (this.countCompleted() / this.testData.questions.length) * 100;
  }

  isAssessmentComplete(): boolean {
    const total = this.testData?.total_questions || 0;
    return (
      total > 0 &&
      this.loadedQuestionsCount === total &&
      this.submittedQuestionIndexes.size === total
    );
  }

  canSubmitFinal(): boolean {
    const total = this.testData?.total_questions || 0;
    if (
      total <= 0 ||
      !this.sessionId ||
      this.submitting ||
      this.loadingNextQuestion
    ) {
      return false;
    }

    if (this.isAssessmentComplete()) {
      return true;
    }

    if (this.loadedQuestionsCount !== total) {
      return false;
    }

    const answeredCount = this.answers
      .slice(0, total)
      .filter((a) => !!a?.selectedAnswer).length;

    // Allow final click when all loaded questions are answered; submitTest() will
    // submit the current unanswered-on-server answer before completing the stage.
    return answeredCount === total;
  }

  submitTest() {
    if (this.submitting || !this.sessionId) return;

    const completeStage = () => {
      if (!this.isAssessmentComplete()) return;

      this.submitting = true;
      this.adaptiveService.completeLevelTestStage(this.sessionId!).subscribe({
        next: (completeRes) => {
          const profile = completeRes?.profile || {};
          const studentId =
            profile?.student_id || this.user?._id || this.user?.id || '';
          this.recordLearningEvent({
            eventType: 'quiz',
            score: Math.round(profile?.overall_mastery || 0),
            durationSec: this.answers.reduce(
              (sum, answer) => sum + Number(answer?.timeSpent || 0),
              0,
            ),
            concept: 'level-test',
            isCorrect: true,
          });
          const result = this.buildResultPayload(profile);

          const goToResult = () => {
            this.router.navigate(['/student-dashboard/level-test-result'], {
              state: { result },
            });
          };

          if (!studentId) {
            goToResult();
            return;
          }

          this.adaptiveService
            .syncLevelTestProfileToBackend(
              studentId,
              profile,
              this.sessionId!,
              result,
            )
            .subscribe({
              next: () => goToResult(),
              error: (syncErr) => {
                console.warn(
                  'Profile sync failed after level test completion',
                  syncErr,
                );
                goToResult();
              },
            });
        },
        error: (err) => {
          console.error('Error completing test', err);
          this.submitting = false;
        },
      });
    };

    const canSubmitCurrent =
      !!this.answers[this.currentQuestionIndex]?.selectedAnswer &&
      !this.submittedQuestionIndexes.has(this.currentQuestionIndex);

    if (canSubmitCurrent) {
      this.submitCurrentAnswerAndFetchNext(completeStage);
      return;
    }

    completeStage();
  }

  private buildResultPayload(profile: any): any {
    const studentId = profile?.student_id || this.user?._id || this.user?.id;
    const totalScore = Math.round(profile?.overall_mastery || 0);
    const resultLevel = profile?.overall_level || 'beginner';

    const questions = this.testData.questions
      .slice(0, this.loadedQuestionsCount)
      .map((q: any, idx: number) => ({
        questionText: q?.question || q?.questionText || `Question ${idx + 1}`,
        options: Array.isArray(q?.options) ? q.options : [],
        topic: q.topic || 'General',
        difficulty: q?.difficulty || 'beginner',
      }));

    const answers = this.answers
      .slice(0, this.loadedQuestionsCount)
      .map((a, idx) => ({
        questionIndex: idx,
        selectedAnswer: a?.selectedAnswer || '',
        isCorrect: !!a.isCorrect,
        timeSpent: a.timeSpent || 0,
      }));

    const detectedStrengths = (profile?.strengths || []).map((s: any) => ({
      topic: s?.title || 'General',
      score: Math.round(s?.mastery || 0),
    }));

    const detectedWeaknesses = (profile?.weaknesses || []).map((w: any) => ({
      topic: w?.title || 'General',
      score: Math.round(w?.mastery || 0),
    }));

    return {
      studentId,
      totalScore,
      resultLevel,
      questions,
      answers,
      detectedStrengths,
      detectedWeaknesses,
      recommendations: profile?.recommendations || [],
    };
  }

  // --- UI Helpers for Sidebar Navigation ---

  getNavigationItemClass(index: number): string {
    const isCurrent = this.currentQuestionIndex === index;
    const isAnswered = !!this.answers[index]?.selectedAnswer;

    if (isCurrent) return 'bg-primary/10 border border-primary/20 text-primary';
    if (isAnswered)
      return 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500';
    return 'opacity-50 grayscale hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500';
  }

  getNavigationIconClass(index: number): string {
    const isCurrent = this.currentQuestionIndex === index;
    const isAnswered = !!this.answers[index]?.selectedAnswer;

    if (isCurrent) return 'bg-primary text-white border-transparent';
    if (isAnswered)
      return 'bg-green-100 dark:bg-green-900/30 text-green-600 border-transparent';
    return 'border-slate-200 dark:border-slate-700 text-slate-400';
  }

  getNavigationTextClass(index: number): string {
    const isCurrent = this.currentQuestionIndex === index;
    if (isCurrent) return 'font-bold';
    return 'font-medium';
  }

  // --- Timer logic ---
  startTimer() {
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.submitTest();
      }
    }, 1000);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
