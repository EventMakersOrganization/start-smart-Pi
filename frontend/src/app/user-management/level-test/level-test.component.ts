import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
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
  loadingNextQuestion = false;
  nextErrorMessage = '';
  user: any;
  userFullName = '';

  testData: any;
  currentQuestionIndex = 0;

  // Format matching backend expectations
  answers: {
    questionIndex: number;
    selectedAnswer: string;
    timeSpent: number;
    isCorrect?: boolean;
  }[] = [];

  timeRemaining = 1800; // 60 minutes
  timerInterval: any;
  questionStartTime = Date.now();

  constructor(
    private router: Router,
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
    this.initializeTest();
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  initializeTest() {
    const userId = this.user._id || this.user.id;

    // First, check if test exists
    this.adaptiveService.getLevelTest(userId).subscribe({
      next: (existingTest) => {
        if (existingTest && existingTest.status === 'in-progress') {
          if (this.shouldReuseExistingTest(existingTest)) {
            this.setupTest(existingTest);
          } else {
            // Old/malformed session: start a fresh AI session.
            this.adaptiveService.startLevelTest(userId).subscribe({
              next: (newTest) => this.setupTest(newTest),
              error: () => (this.loading = false),
            });
          }
        } else if (existingTest && existingTest.status === 'completed') {
          // Redirect if test is already complete
          this.router.navigate(['/student-dashboard/level-test-result'], {
            state: { result: existingTest },
          });
        } else {
          // Test does not exist or empty, generate new
          this.adaptiveService.startLevelTest(userId).subscribe({
            next: (newTest) => this.setupTest(newTest),
            error: () => (this.loading = false),
          });
        }
      },
      error: () => {
        // Create new
        this.adaptiveService.startLevelTest(userId).subscribe({
          next: (newTest) => this.setupTest(newTest),
          error: () => (this.loading = false),
        });
      },
    });
  }

  private shouldReuseExistingTest(test: any): boolean {
    if (
      !test ||
      !Array.isArray(test.questions) ||
      test.questions.length === 0
    ) {
      return false;
    }

    // Prefer AI flow and avoid old legacy tests that can contain malformed content.
    if (!test.isAiGenerated) {
      return false;
    }

    // Allow placeholders for future questions, but validate loaded ones.
    const loaded = test.questions.filter(
      (q: any) => q && q.question && q.question !== 'Loading next question...',
    );

    if (loaded.length === 0) return false;

    return loaded.every((q: any) => {
      const question = (q.questionText || q.question || '').toString().trim();
      const opts = Array.isArray(q.options)
        ? q.options.filter((o: any) => `${o}`.trim())
        : [];
      return (
        question.length >= 8 &&
        opts.length >= 2 &&
        this.isPromptComplete(question) &&
        this.hasBasicQuestionOptionCoherence(question, opts)
      );
    });
  }

  private isPromptComplete(questionText: string): boolean {
    const q = (questionText || '').trim();
    if (!q) return false;

    if (/^quelle est la sortie\s*\?$/i.test(q)) {
      return false;
    }

    const asksOutput =
      /quelle est la sortie|que va-t-il s[’']afficher|what is the output/i.test(
        q,
      );
    if (asksOutput) {
      const hasCodeContext =
        /\n|;|\bif\b|\bfor\b|\bwhile\b|\bswitch\b|printf|cout|System\.out|\bprint\b/i.test(
          q,
        );
      const hasOutputCall = /printf|cout|System\.out|\bprint\b/i.test(q);
      if (!(hasCodeContext && hasOutputCall)) {
        return false;
      }
    }

    const asksCodeContext =
      /soit le code suivant|consid[eé]rez le code suivant|given the following code|following code/i.test(
        q,
      );
    if (asksCodeContext) {
      const hasCodeContext =
        /\n|;|\bif\b|\bfor\b|\bwhile\b|\bswitch\b|\bcase\b|\breturn\b/i.test(q);
      if (!hasCodeContext) {
        return false;
      }
    }

    return true;
  }

  private hasBasicQuestionOptionCoherence(
    questionText: string,
    options: string[],
  ): boolean {
    const q = (questionText || '').toLowerCase();
    if (!q || !Array.isArray(options) || options.length < 2) return false;

    const stopwords = new Set([
      'le',
      'la',
      'les',
      'de',
      'des',
      'du',
      'un',
      'une',
      'et',
      'ou',
      'dans',
      'pour',
      'avec',
      'que',
      'quel',
      'quelle',
      'quels',
      'quelles',
      'est',
      'sont',
      'the',
      'and',
      'for',
      'with',
      'what',
      'which',
      'when',
      'where',
    ]);

    const qTokens = new Set(
      (q.match(/[A-Za-zÀ-ÿ]{4,}/g) || []).filter((t) => !stopwords.has(t)),
    );
    if (qTokens.size < 4) {
      return true;
    }

    let overlap = 0;
    for (const opt of options) {
      const body = `${opt || ''}`
        .replace(/^\s*[A-Ea-e]\s*[\.)]\s*/, '')
        .toLowerCase();
      const oTokens = new Set(
        (body.match(/[A-Za-zÀ-ÿ]{4,}/g) || []).filter((t) => !stopwords.has(t)),
      );
      for (const t of oTokens) {
        if (qTokens.has(t)) {
          overlap++;
        }
      }
    }

    if (overlap > 0) {
      return true;
    }

    const compactBodies = options.map((opt) =>
      `${opt || ''}`
        .replace(/^\s*[A-Ea-e]\s*[\.)]\s*/, '')
        .trim()
        .toLowerCase(),
    );
    const boolSet = new Set(['true', 'false', 'vrai', 'faux', 'yes', 'no']);
    if (
      compactBodies.length > 0 &&
      compactBodies.every((b) => boolSet.has(b) || b.length <= 3)
    ) {
      return true;
    }

    return false;
  }

  setupTest(test: any) {
    this.testData = test;
    this.aiSubmittedQuestions.clear();

    // Initialize answers array
    const questionsCount =
      test.total_questions || (test.questions && test.questions.length) || 0;
    const existing = test.answers || [];

    this.answers = Array.from({ length: questionsCount }).map((_, i) => {
      return (
        existing[i] || { questionIndex: i, selectedAnswer: null, timeSpent: 0 }
      );
    });

    this.loading = false;
    this.questionStartTime = Date.now();

    // Pre-fetch next questions if AI-generated (background load)
    if (test.isAiGenerated && test.session_id) {
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
    if (this.loadingNextQuestion) return;
    if (!this.testData?.questions?.length) return;

    if (this.currentQuestionIndex < this.testData.questions.length - 1) {
      if (this.testData?.isAiGenerated && this.testData?.session_id) {
        const currentIndex = this.currentQuestionIndex;
        const nextIndex = currentIndex + 1;
        const selectedAnswer =
          this.answers[currentIndex]?.selectedAnswer?.toString().trim() || '';

        if (!selectedAnswer) {
          this.nextErrorMessage =
            'Selectionne une reponse avant de passer a la question suivante.';
          return;
        }

        const nextQuestion = this.testData.questions[nextIndex];
        const nextQuestionLoaded =
          !!nextQuestion?.options?.length ||
          !!nextQuestion?.questionText ||
          (!!nextQuestion?.question &&
            nextQuestion.question !== 'Loading next question...');

        this.updateTimeSpent();

        if (this.aiSubmittedQuestions.has(currentIndex) && nextQuestionLoaded) {
          this.currentQuestionIndex++;
          this.questionStartTime = Date.now();
          return;
        }

        this.loadingNextQuestion = true;
        this.nextErrorMessage = '';
        this.adaptiveService
          .submitLevelTestAnswer(this.testData.session_id, selectedAnswer)
          .pipe(
            finalize(() => {
              this.loadingNextQuestion = false;
            }),
          )
          .subscribe({
            next: (response) => {
              const hasUsableNextQuestion =
                !!response?.next_question ||
                !!this.testData?.questions?.[nextIndex]?.options?.length ||
                !!this.testData?.questions?.[nextIndex]?.questionText ||
                (!!this.testData?.questions?.[nextIndex]?.question &&
                  this.testData.questions[nextIndex].question !==
                    'Loading next question...');

              if (!hasUsableNextQuestion) {
                // Keep user on current question and allow explicit retry.
                this.aiSubmittedQuestions.delete(currentIndex);
                this.nextErrorMessage =
                  "La question suivante n'est pas encore disponible. Reessaie dans quelques secondes.";
                return;
              }

              this.aiSubmittedQuestions.add(currentIndex);
              if (
                typeof response?.correct === 'boolean' &&
                this.answers[currentIndex]
              ) {
                this.answers[currentIndex] = {
                  ...this.answers[currentIndex],
                  isCorrect: response.correct,
                };
              }
              if (response?.next_question) {
                this.injectLoadedQuestion(nextIndex, response.next_question);
              }
              this.currentQuestionIndex++;
              this.questionStartTime = Date.now();
              this.nextErrorMessage = '';
            },
            error: (err) => {
              console.error('Error loading next AI question', err);
              this.nextErrorMessage =
                'Impossible de charger la prochaine question. Verifie ai-service puis reessaie.';
            },
          });
        return;
      }

      this.updateTimeSpent();
      this.currentQuestionIndex++;
      this.questionStartTime = Date.now();

      // Pre-load next question if AI-generated
      if (this.testData?.isAiGenerated && this.testData?.session_id) {
        this.loadQuestionAtIndex(this.currentQuestionIndex);
      }
    }
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
    if (index >= 0 && index < this.testData.questions.length) {
      this.updateTimeSpent();
      this.currentQuestionIndex = index;
      this.questionStartTime = Date.now();

      // Pre-load question if AI-generated
      if (this.testData?.isAiGenerated && this.testData?.session_id) {
        this.loadQuestionAtIndex(index);
      }
    }
  }

  private loadQuestionAtIndex(index: number) {
    if (!this.testData?.questions?.[index]) return;

    const currentQ = this.testData.questions[index];
    if (currentQ.options && currentQ.options.length > 0) {
      // Already loaded
      return;
    }

    // In MVP, question is loaded during submit-answer flow
    // For now, just mark it as loading
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
    return this.countCompleted() === this.testData?.questions?.length;
  }

  submitTest() {
    if (!this.isAssessmentComplete() || this.submitting) return;

    this.updateTimeSpent(); // ensure last viewed gets time
    this.submitting = true;

    // Fill gaps of 'empty' responses if edge-case skips happened
    const finalAnswers = this.testData.questions.map((q: any, i: number) => {
      return (
        this.answers[i] || {
          questionIndex: i,
          selectedAnswer: null,
          timeSpent: 0,
        }
      );
    });

    const submitLegacyFlow = (aiPersonalizedRecommendations: any[] = []) => {
      this.adaptiveService
        .submitLevelTest(this.testData._id, finalAnswers)
        .subscribe({
          next: (result) => {
            const totalDurationSec = finalAnswers.reduce(
              (acc: number, item: any) => acc + Number(item?.timeSpent || 0),
              0,
            );

            this.adaptiveService
              .recordLearningEvent({
                event_type: 'quiz',
                score: Number(result?.totalScore || 0),
                duration_sec: totalDurationSec,
                metadata: {
                  source: 'level-test',
                  level_result: result?.resultLevel || 'unknown',
                  test_id: result?._id || this.testData?._id,
                },
              })
              .subscribe({
                next: () => {
                  sessionStorage.setItem('forceAnalyticsRefresh', '1');
                  // Redirect to result page and pass the result object via navigation state
                  this.router.navigate(
                    ['/student-dashboard/level-test-result'],
                    {
                      state: {
                        result,
                        aiPersonalizedRecommendations,
                      },
                    },
                  );
                },
                error: () => {
                  // Keep UX smooth even if analytics ingest fails
                  sessionStorage.setItem('forceAnalyticsRefresh', '1');
                  this.router.navigate(
                    ['/student-dashboard/level-test-result'],
                    {
                      state: {
                        result,
                        aiPersonalizedRecommendations,
                      },
                    },
                  );
                },
              });
          },
          error: (err) => {
            console.error('Error submitting test', err);
            this.submitting = false;
          },
        });
    };

    const buildAiResult = (profile: any) => {
      const totalQuestions = this.testData?.questions?.length || 0;
      const correctCount = this.answers.filter((a) => a?.isCorrect).length;
      const totalScore =
        totalQuestions > 0
          ? Math.round((correctCount / totalQuestions) * 100)
          : 0;
      const userId = this.user?._id || this.user?.id;

      return {
        _id: this.testData?.session_id || this.testData?._id,
        studentId: userId,
        questions: this.testData?.questions || [],
        answers: (this.answers || []).map((a) => ({
          questionIndex: a.questionIndex,
          selectedAnswer: a.selectedAnswer,
          timeSpent: a.timeSpent,
          isCorrect: !!a.isCorrect,
        })),
        totalScore,
        resultLevel: profile?.overall_level || profile?.level || 'beginner',
        status: 'completed',
      };
    };

    const toTopicTitles = (arr: any): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            return String(item.title || item.topic || '').trim();
          }
          return '';
        })
        .filter((v: string) => !!v);
    };

    const syncAiProfileToBackend = (profile: any, result: any) => {
      const userId = this.user?._id || this.user?.id;
      if (!userId || !profile) return;

      const mappedProfile = {
        userId,
        level: profile?.overall_level || profile?.level || 'beginner',
        progress: Number(result?.totalScore ?? profile?.overall_mastery ?? 0),
        strengths: toTopicTitles(profile?.strengths),
        weaknesses: toTopicTitles(profile?.weaknesses),
        levelTestCompleted: true,
      };

      // Keep NestJS profile (dashboard source) in sync with AI-level-test result.
      this.adaptiveService.updateProfile(userId, mappedProfile).subscribe({
        next: () => {},
        error: () => {
          this.adaptiveService.createProfile(mappedProfile).subscribe({
            next: () => {},
            error: () => {},
          });
        },
      });

      const totalDurationSec = (result?.answers || []).reduce(
        (acc: number, item: any) => acc + Number(item?.timeSpent || 0),
        0,
      );

      this.adaptiveService
        .createPerformance({
          studentId: userId,
          exerciseId: String(
            result?._id || this.testData?._id || 'ai-level-test',
          ),
          score: Number(result?.totalScore || 0),
          timeSpent: totalDurationSec,
          source: 'level-test',
          topic: 'Level Test',
          difficulty: mappedProfile.level as
            | 'beginner'
            | 'intermediate'
            | 'advanced',
        })
        .subscribe({
          next: () => {},
          error: () => {},
        });
    };

    const finalizeAiResult = (
      profile: any,
      aiPersonalizedRecommendations: any[] = [],
    ) => {
      const result = buildAiResult(profile);
      syncAiProfileToBackend(profile, result);
      const totalDurationSec = (result.answers || []).reduce(
        (acc: number, item: any) => acc + Number(item?.timeSpent || 0),
        0,
      );

      this.adaptiveService
        .recordLearningEvent({
          event_type: 'quiz',
          score: Number(result?.totalScore || 0),
          duration_sec: totalDurationSec,
          metadata: {
            source: 'level-test-ai',
            level_result: result?.resultLevel || 'unknown',
            test_id: result?._id || this.testData?._id,
          },
        })
        .subscribe({
          next: () => {
            sessionStorage.setItem('forceAnalyticsRefresh', '1');
            this.router.navigate(['/student-dashboard/level-test-result'], {
              state: {
                result,
                aiPersonalizedRecommendations,
              },
            });
          },
          error: () => {
            sessionStorage.setItem('forceAnalyticsRefresh', '1');
            this.router.navigate(['/student-dashboard/level-test-result'], {
              state: {
                result,
                aiPersonalizedRecommendations,
              },
            });
          },
        });
    };

    const aiSessionId = this.testData?.session_id;
    if (aiSessionId) {
      const finishAiFlow = () => {
        this.adaptiveService.completeLevelTestAi(aiSessionId).subscribe({
          next: (completeResponse) => {
            const studentProfile = completeResponse?.profile;
            if (!studentProfile) {
              this.submitting = false;
              return;
            }

            this.adaptiveService
              .getPersonalizedRecommendations(studentProfile)
              .subscribe({
                next: (recResponse) => {
                  const aiRecs = Array.isArray(recResponse?.recommendations)
                    ? recResponse.recommendations
                    : [];
                  finalizeAiResult(studentProfile, aiRecs);
                },
                error: () => finalizeAiResult(studentProfile, []),
              });
          },
          error: () => {
            this.submitting = false;
          },
        });
      };

      const lastIndex = this.testData.questions.length - 1;
      const lastAnswer =
        this.answers[lastIndex]?.selectedAnswer?.toString().trim() || '';

      if (!this.aiSubmittedQuestions.has(lastIndex) && lastAnswer) {
        this.adaptiveService
          .submitLevelTestAnswer(aiSessionId, lastAnswer)
          .subscribe({
            next: (resp) => {
              this.aiSubmittedQuestions.add(lastIndex);
              if (
                typeof resp?.correct === 'boolean' &&
                this.answers[lastIndex]
              ) {
                this.answers[lastIndex] = {
                  ...this.answers[lastIndex],
                  isCorrect: resp.correct,
                };
              }
              finishAiFlow();
            },
            error: () => finishAiFlow(),
          });
      } else {
        finishAiFlow();
      }
      return;
    }

    submitLegacyFlow();
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
