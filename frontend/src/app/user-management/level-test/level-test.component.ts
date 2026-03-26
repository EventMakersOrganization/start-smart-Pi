import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-level-test',
  templateUrl: './level-test.component.html',
  styleUrls: ['./level-test.component.css'],
})
export class LevelTestComponent implements OnInit, OnDestroy {
  loading = true;
  submitting = false;
  user: any;
  userFullName = '';

  testData: any;
  currentQuestionIndex = 0;

  // Format matching backend expectations
  answers: {
    questionIndex: number;
    selectedAnswer: string;
    timeSpent: number;
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
    this.startTimer();
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
          this.setupTest(existingTest);
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

  setupTest(test: any) {
    this.testData = test;
    // Ensure answers array has an entry for each question so template can access safely
    const existing = test.answers || [];
    const questionsCount = (test.questions && test.questions.length) || 0;
    this.answers = Array.from({ length: questionsCount }).map((_, i) => {
      return (
        existing[i] || { questionIndex: i, selectedAnswer: null, timeSpent: 0 }
      );
    });
    this.loading = false;
    this.questionStartTime = Date.now();
  }

  get currentQuestion() {
    if (!this.testData || !this.testData.questions) return null;
    return this.testData.questions[this.currentQuestionIndex];
  }

  selectAnswer(answer: string) {
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
    if (this.currentQuestionIndex < this.testData.questions.length - 1) {
      this.updateTimeSpent();
      this.currentQuestionIndex++;
      this.questionStartTime = Date.now();
    }
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
    }
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

    this.adaptiveService
      .submitLevelTest(this.testData._id, finalAnswers)
      .subscribe({
        next: (result) => {
          // Redirect to result page and pass the result object via navigation state
          this.router.navigate(['/student-dashboard/level-test-result'], {
            state: { result },
          });
        },
        error: (err) => {
          console.error('Error submitting test', err);
          this.submitting = false;
        },
      });
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
