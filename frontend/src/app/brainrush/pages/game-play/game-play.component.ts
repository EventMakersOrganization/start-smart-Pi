import {
  Component, OnInit, OnDestroy, Input, Output, EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { BrainrushService } from '../../services/brainrush.service';
import { ScoringService } from '../../services/scoring.service';
import { SocketService } from '../../services/socket.service';
import { AudioService } from '../../services/audio.service';

// ─────────────────────────────────────────────
// CIRCULAR TIMER
// ─────────────────────────────────────────────
@Component({
  selector: 'app-game-timer',
  standalone: true,
  template: `
    <div class="relative w-20 h-20">
      <svg class="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="6"/>
        <circle cx="40" cy="40" r="34" fill="none"
          [attr.stroke]="timeLeft > 10 ? '#22c55e' : (timeLeft > 5 ? '#eab308' : '#ef4444')"
          stroke-width="6" stroke-linecap="round"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="offset"
          style="transition: stroke-dashoffset 0.9s linear, stroke 0.3s">
        </circle>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-2xl font-black"
          [style.color]="timeLeft > 10 ? '#4ade80' : (timeLeft > 5 ? '#facc15' : '#f87171')">
          {{ timeLeft }}
        </span>
      </div>
    </div>
  `
})
export class GameTimerComponent {
  @Input() timeLeft = 20;
  @Input() total = 20;
  readonly circumference = 2 * Math.PI * 34;
  get offset() { return this.circumference - (this.timeLeft / this.total) * this.circumference; }
}

// ─────────────────────────────────────────────
// POWER-UP
// ─────────────────────────────────────────────
@Component({
  selector: 'app-power-up',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button (click)="onUse()"
      class="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 border border-white/20 bg-white/10 hover:-translate-y-1 hover:border-white/50"
      [class.opacity-40]="count === 0"
      [class.cursor-not-allowed]="count === 0">
      <span class="text-2xl">{{ icon }}</span>
      <span class="text-white/70 text-[10px] font-bold uppercase tracking-wider">{{ label }}</span>
      <span *ngIf="count > 0"
        class="absolute -top-2 -right-2 w-5 h-5 bg-yellow-400 text-yellow-900 text-[10px] font-black rounded-full flex items-center justify-center">
        {{ count }}
      </span>
    </button>
  `
})
export class PowerUpComponent {
  @Input() icon = '';
  @Input() label = '';
  @Input() count = 0;
  @Output() use = new EventEmitter<void>();
  onUse() { if (this.count > 0) this.use.emit(); }
}

// ─────────────────────────────────────────────
// ANSWER OPTION
// ─────────────────────────────────────────────
@Component({
  selector: 'app-answer-option',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    @keyframes bounceIn {
      0%   { transform: scale(0.95); opacity: 0; }
      60%  { transform: scale(1.02); }
      100% { transform: scale(1);    opacity: 1; }
    }
    .bounce-in { animation: bounceIn 0.3s ease-out forwards; }
  `],
  template: `
    <button (click)="onSelect()"
      class="bounce-in w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 font-semibold text-lg group"
      [ngClass]="buttonClass">
      <span class="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all text-white"
        [ngClass]="labelClass">
        {{ label }}
      </span>
      <span class="mt-1 leading-snug">{{ text }}</span>
      <span *ngIf="isCorrect && answered" class="ml-auto text-2xl">✅</span>
      <span *ngIf="isSelected && !isCorrect && answered" class="ml-auto text-2xl">❌</span>
    </button>
  `
})
export class AnswerOptionComponent {
  @Input() label = 'A';
  @Input() text = '';
  @Input() isSelected = false;
  @Input() isCorrect = false;
  @Input() answered = false;
  @Input() isLocked = false;
  @Output() select = new EventEmitter<void>();

  onSelect() { if (!this.answered && !this.isLocked) this.select.emit(); }

  get buttonClass(): string {
    if (!this.answered) {
      if (this.isSelected) return 'border-blue-400 bg-blue-500/20 text-blue-300 scale-[1.01]';
      if (this.isLocked) return 'border-white/5 bg-white/5 text-white/20 cursor-not-allowed grayscale-50 opacity-40';
      return 'border-white/20 bg-white/5 text-white hover:border-blue-400 hover:bg-white/10 hover:scale-[1.01]';
    }
    if (this.isCorrect) return 'border-green-400 bg-green-500/20 text-green-300';
    if (this.isSelected) return 'border-red-400 bg-red-500/20 text-red-300';
    return 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed';
  }

  get labelClass(): string {
    if (!this.answered) return 'bg-blue-500';
    if (this.isCorrect) return 'bg-green-500';
    if (this.isSelected) return 'bg-red-500';
    return 'bg-white/20';
  }
}

// ─────────────────────────────────────────────
// MAIN GAME-PLAY COMPONENT
// ─────────────────────────────────────────────
interface Question {
  questionId: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
  points?: number;
  timeLimit?: number;
}

@Component({
  selector: 'app-game-play',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    GameTimerComponent, PowerUpComponent, AnswerOptionComponent
  ],
  styles: [`
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes popScore {
      0%   { transform: scale(1); color: white; }
      50%  { transform: scale(1.3); color: #facc15; }
      100% { transform: scale(1); color: white; }
    }
    .fade-slide-in { animation: fadeSlideIn 0.4s ease-out forwards; }
    .pop-score     { animation: popScore 0.5s ease-out; }
  `],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col text-white">

      <!-- ── TOP STATS BAR ── -->
      <div class="sticky top-0 z-50 backdrop-blur-md bg-black/30 border-b border-white/10 px-4 py-3">
        <div class="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">

          <!-- Score -->
          <div class="flex flex-col items-center min-w-[80px]">
            <span class="text-white/50 text-[10px] uppercase tracking-widest font-bold">Score</span>
            <span class="text-2xl font-black text-yellow-300" [class.pop-score]="scorePopped">{{ score }} pts</span>
          </div>

          <!-- Combo -->
          <div *ngIf="combo > 1"
            class="flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/50 rounded-full px-4 py-1 animate-pulse">
            <span class="text-yellow-300 text-lg">⚡</span>
            <span class="text-yellow-300 font-black text-lg">{{ combo }}x Combo!</span>
          </div>

          <!-- Timer -->
          <app-game-timer [timeLeft]="timeLeft" [total]="totalTime"></app-game-timer>

          <!-- Q Progress -->
          <div class="flex flex-col items-center min-w-[80px]">
            <span class="text-white/50 text-[10px] uppercase tracking-widest font-bold">Question</span>
            <span class="text-xl font-black">{{ questionIndex + 1 }} / {{ totalQuestions }}</span>
          </div>

          <!-- Difficulty -->
          <div class="flex flex-col items-center">
            <span class="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-1">Level</span>
            <span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
              [ngClass]="difficultyClass">
              🎯 {{ difficulty }}
            </span>
          </div>
        </div>

        <!-- Power-ups -->
        <div class="max-w-4xl mx-auto mt-3 flex items-center justify-center gap-3">
          <app-power-up icon="⚡" label="2× Boost" [count]="powerUps.doubler" (use)="usePowerUp('doubler')"></app-power-up>
          <app-power-up icon="🛡️" label="Shield"   [count]="powerUps.shield"  (use)="usePowerUp('shield')"></app-power-up>
          <app-power-up icon="💡" label="Hint"     [count]="powerUps.hint"    (use)="usePowerUp('hint')"></app-power-up>
          <app-power-up icon="🎁" label="Bonus"    [count]="powerUps.bonus"   (use)="usePowerUp('bonus')"></app-power-up>
        </div>
      </div>

      <!-- ── MAIN CONTENT ── -->
      <div class="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-3xl w-full mx-auto">

        <!-- ── FEEDBACK & STATUS CONTAINER (Fixed height to prevent layout shift) ── -->
        <div class="w-full h-24 mb-6 relative flex items-center justify-center">
          
          <!-- Feedback Banner (Solo/Non-Overlay states) -->
          <div *ngIf="feedbackState && !multiplayerLeaderboard"
            class="absolute inset-0 text-center py-4 px-6 rounded-2xl font-black text-2xl shadow-2xl border-2 fade-slide-in flex items-center justify-center z-10"
            [ngClass]="feedbackState === 'correct' ? 'bg-green-500/30 border-green-400' : 'bg-red-500/30 border-red-400'">
            <span *ngIf="feedbackState === 'correct'">🎉 Correct! +{{ lastPointsEarned }} pts</span>
            <span *ngIf="feedbackState === 'wrong'">😔 Wrong! Answer: "{{ currentQuestion?.correctAnswer }}"</span>
          </div>
  
          <!-- Players Answered List (Multiplayer - only when no feedback yet) -->
          <div *ngIf="isMultiplayer && !feedbackState" class="absolute inset-x-0 flex justify-center gap-2 flex-wrap fade-slide-in z-0">
            <div *ngFor="let p of roomPlayers" 
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border"
              [ngClass]="answeredPlayers.includes(p.socketId) ? 'bg-green-500/20 border-green-400 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-white/5 border-white/10 text-white/40'">
              <span>{{ p.avatar }}</span>
              <span>{{ p.username }}</span>
              <span *ngIf="answeredPlayers.includes(p.socketId)" class="material-symbols-outlined text-[14px]">check_circle</span>
            </div>
          </div>
        </div>

        <!-- Question Card -->
        <div *ngIf="currentQuestion" class="w-full fade-slide-in">
          <div class="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 mb-6">
            <div class="flex justify-between items-start mb-6">
              <span class="text-white/50 text-sm font-bold">Question {{ questionIndex + 1 }}</span>
              <span class="px-3 py-1 rounded-full text-xs font-black uppercase" [ngClass]="difficultyClass">{{ difficulty }}</span>
            </div>
            <p class="text-2xl font-bold text-white leading-relaxed">{{ currentQuestion.questionText }}</p>
          </div>

          <!-- Answers grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <app-answer-option
              *ngFor="let opt of currentQuestion.options; let i = index"
              [label]="labels[i]"
              [text]="opt"
              [isSelected]="selectedAnswer === opt"
              [isCorrect]="!!feedbackState && opt === currentQuestion.correctAnswer"
              [answered]="!!feedbackState"
              [isLocked]="!!selectedAnswer"
              (select)="handleAnswer(opt)">
            </app-answer-option>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="!currentQuestion && !finished" class="flex flex-col items-center gap-6 mt-12">
          <div class="relative w-20 h-20">
            <div class="absolute inset-0 rounded-full border-4 border-white/10"></div>
            <div class="absolute inset-0 rounded-full border-4 border-t-purple-400 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          </div>
          <p class="text-white/60 font-semibold text-lg">AI is generating your question…</p>
        </div>
      </div>

      <!-- ── BOTTOM PROGRESS BAR ── -->
      <div class="sticky bottom-0 z-50 bg-black/30 backdrop-blur-md border-t border-white/10 p-3">
        <div class="max-w-4xl mx-auto">
          <div class="flex justify-between text-xs text-white/40 font-bold mb-1">
            <span>Progress</span>
            <span>{{ progressPct }}%</span>
          </div>
          <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full transition-all duration-700"
              [style.width.%]="progressPct"></div>
          </div>
        </div>
      </div>
      
      <div *ngIf="multiplayerLeaderboard" 
        class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 transition-all duration-500 overflow-y-auto">
        <div class="bg-gray-900/90 border border-white/10 rounded-[2.5rem] p-10 max-w-xl w-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] fade-slide-in relative overflow-hidden">
          
          <!-- Background Glow Effect inside overlay -->
          <div class="absolute -top-24 -right-24 w-64 h-64 bg-purple-600/20 blur-[100px] pointer-events-none rounded-full"></div>
          <div class="absolute -bottom-24 -left-24 w-64 h-64 bg-pink-600/20 blur-[100px] pointer-events-none rounded-full"></div>

          <!-- Round Summary Status -->
          <div class="text-center mb-8">
            <div class="inline-block px-6 py-2 rounded-full text-sm font-black uppercase tracking-[0.2em] mb-4"
              [ngClass]="feedbackState === 'correct' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'">
              {{ feedbackState === 'correct' ? 'Round Won! ✨' : 'Round Lost 💀' }}
            </div>
            <h3 class="text-4xl font-black text-white">Round Rankings</h3>
          </div>

          <!-- Rankings List -->
          <div class="space-y-3 mb-10">
            <div *ngFor="let p of multiplayerLeaderboard; let i = index" 
              class="flex items-center gap-5 p-4 rounded-3xl transition-all border group"
              [ngClass]="i === 0 ? 'bg-yellow-400/10 border-yellow-400/30' : 'bg-white/5 border-white/5 hover:bg-white/10'">
              
              <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg"
                 [ngClass]="i === 0 ? 'bg-yellow-400 text-yellow-950 shadow-lg shadow-yellow-400/20' : 'bg-white/10 text-white/40'">
                {{ i + 1 }}
              </div>

              <div class="text-3xl grayscale-[0.3] group-hover:grayscale-0 transition-all">{{ p.avatar }}</div>

              <div class="flex-1">
                <div class="font-black text-lg flex items-center gap-2">
                  {{ p.username }}
                  <span *ngIf="p.socketId === socketService.socketId" class="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">YOU</span>
                </div>
                <div class="text-xs font-bold text-white/40 uppercase tracking-widest">{{ p.score }} points</div>
              </div>

              <div class="flex items-center">
                <span *ngIf="p.isCorrect" class="text-green-400 bg-green-400/20 p-1.5 rounded-full material-symbols-outlined text-[20px]">check</span>
                <span *ngIf="!p.isCorrect" class="text-red-400 bg-red-400/20 p-1.5 rounded-full material-symbols-outlined text-[20px]">close</span>
              </div>
            </div>
          </div>

          <div class="flex flex-col items-center gap-4">
            <div class="flex items-center gap-3">
              <div class="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></div>
              <div class="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style="animation-delay: 0.1s"></div>
              <div class="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style="animation-delay: 0.2s"></div>
            </div>
            <div class="text-white/40 text-xs font-black uppercase tracking-[0.3em]">
              Synchronizing next round...
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class GamePlayComponent implements OnInit, OnDestroy {
  readonly labels = ['A', 'B', 'C', 'D'];

  sessionId = '';
  roomCode = '';
  username = 'Player';          // set from router state
  avatar = '🎮';               // set from router state
  score = 0;

  combo = 1;
  timeLeft = 20;
  totalTime = 20;
  difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  questionIndex = 0;
  totalQuestions = 5;
  currentQuestion: Question | null = null;
  selectedAnswer: string | null = null;
  feedbackState: 'correct' | 'wrong' | null = null;
  lastPointsEarned = 0;
  finished = false;
  scorePopped = false;

  powerUps = { doubler: 2, shield: 1, hint: 1, bonus: 3 };

  multiplayerLeaderboard: any[] | null = null;
  isMultiplayer = false;
  private subs: Subscription[] = [];
  private timerInterval: any;
  private startTime = 0;
  private questions: any[] = [];
  public roomPlayers: any[] = []; // for active status tracking
  private currentTopic = 'data_structures';
  public answeredPlayers: string[] = []; // socketIds of players who chose an answer

  private demoQuestions: Question[] = [
    { questionId: 'q1', questionText: 'What is the time complexity of Binary Search?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], correctAnswer: 'O(log n)' },
    { questionId: 'q2', questionText: 'Which data structure uses LIFO order?', options: ['Queue', 'Stack', 'Heap', 'Linked List'], correctAnswer: 'Stack' },
    { questionId: 'q3', questionText: 'What does OOP stand for?', options: ['Object-Oriented Programming', 'Open Operation Protocol', 'Output Optimization Process', 'Object Output Pipeline'], correctAnswer: 'Object-Oriented Programming' },
    { questionId: 'q4', questionText: 'Which HTTP method updates a resource?', options: ['GET', 'POST', 'PUT', 'DELETE'], correctAnswer: 'PUT' },
    { questionId: 'q5', questionText: 'Which SQL clause filters grouped results?', options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'], correctAnswer: 'HAVING' }
  ];

  get progressPct() {
    if (this.isMultiplayer) return Math.round(((this.questionIndex + 1) / this.totalQuestions) * 100);
    return Math.round((this.questionIndex / this.totalQuestions) * 100);
  }

  get difficultyClass() {
    if (this.difficulty === 'easy') return 'bg-green-500/30 text-green-300';
    if (this.difficulty === 'hard') return 'bg-red-500/30 text-red-300';
    return 'bg-yellow-500/30 text-yellow-300';
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: BrainrushService,
    public socketService: SocketService,
    private scoringService: ScoringService,
    private audio: AudioService
  ) { }

  ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras.state || history.state;

    this.sessionId = this.route.snapshot.paramMap.get('sessionId') || 'demo';
    this.roomCode = this.route.snapshot.paramMap.get('roomCode') || 'solo';
    this.isMultiplayer = this.roomCode !== 'solo' && this.sessionId !== 'demo';

    this.currentTopic = state?.topic || 'Programming';
    this.difficulty = state?.difficulty || 'medium';
    this.username = state?.username || 'Player';
    this.avatar = state?.avatar || '🎮';
    this.roomPlayers = state?.players || [];

    this.audio.startMusic('game');
    this.audio.playSFX('start');

    if (this.isMultiplayer) {
      this.setupMultiplayerListeners(state);
    } else {
      // solo, demo → use local AI session or fallback
      this.fetchAiQuestions();
    }
  }

  private setupMultiplayerListeners(state: any) {
    this.totalQuestions = state?.totalQuestions || 5;
    this.questionIndex = state?.initialIndex || 0;

    // 1. Listen for next question
    this.subs.push(
      this.socketService.onNextQuestion().subscribe(({ question, index, total }) => {
        this.multiplayerLeaderboard = null;
        this.feedbackState = null;
        this.selectedAnswer = null;
        this.answeredPlayers = []; // Reset for the new round
        this.questionIndex = index;
        this.totalQuestions = total;
        this.currentQuestion = {
          questionId: question.id,
          questionText: question.text,
          options: question.options,
          timeLimit: question.timeLimit
        };
        this.totalTime = question.timeLimit;
        this.timeLeft = question.timeLimit;
        this.startTime = Date.now();
        this.audio.playSFX('start');
      })
    );

    // 1b. Listen for answer activity
    this.subs.push(
      this.socketService.onPlayerAnswered().subscribe(({ socketId }) => {
        if (!this.answeredPlayers.includes(socketId)) {
          this.answeredPlayers.push(socketId);
        }
      })
    );

    // 2. Listen for timer sync
    this.subs.push(
      this.socketService.onTimerUpdate().subscribe(({ timeLeft }) => {
        this.timeLeft = timeLeft;
        if (timeLeft <= 3 && timeLeft > 0) this.audio.playSFX('click');
      })
    );

    // 3. Listen for question results
    this.subs.push(
      this.socketService.onQuestionResults().subscribe(({ correctAnswer, explanation, leaderboard }) => {
        if (this.currentQuestion) this.currentQuestion.correctAnswer = correctAnswer;
        this.multiplayerLeaderboard = leaderboard;

        // Find my score in leaderboard
        const me = leaderboard.find(p => p.socketId === this.socketService.socketId);
        if (me) {
          this.score = me.score;
          this.feedbackState = me.isCorrect ? 'correct' : 'wrong';
          this.audio.playSFX(me.isCorrect ? 'correct' : 'wrong');
        }
      })
    );

    // 4. Listen for final results
    this.subs.push(
      this.socketService.onFinalResults().subscribe(({ ranking }) => {
        this.router.navigate(['/brainrush/podium'], {
          state: {
            isMultiplayer: true,
            roomCode: this.roomCode,
            finalRanking: ranking
          }
        });
      })
    );

    // If we arrived with firstQuestion in state, load it
    if (state?.firstQuestion) {
      this.currentQuestion = {
        questionId: state.firstQuestion.id,
        questionText: state.firstQuestion.text,
        options: state.firstQuestion.options,
        timeLimit: state.firstQuestion.timeLimit
      };
      this.totalTime = state.firstQuestion.timeLimit;
      this.timeLeft = state.firstQuestion.timeLimit;
      this.startTime = Date.now();
    }
  }

  fetchAiQuestions() {
    if (this.sessionId === 'demo') {
      this.questions = [...this.demoQuestions];
      this.totalQuestions = this.questions.length;
      this.loadNextQuestion();
      return;
    }

    this.service.initializeSoloSession(this.sessionId, this.currentTopic, this.difficulty).subscribe({
      next: (res: any) => {
        if (res.questions && res.questions.length > 0) {
          this.questions = res.questions.map((q: any) => ({
            questionId: q.questionId,
            questionText: q.question,
            options: q.options,
            correctAnswer: q.correct_answer,
            points: q.points || 100,
            timeLimit: q.time_limit || 20
          }));
          this.totalQuestions = this.questions.length;
          this.loadNextQuestion();
        } else {
          this.questions = [...this.demoQuestions];
          this.totalQuestions = this.questions.length;
          this.loadNextQuestion();
        }
      },
      error: () => {
        this.questions = [...this.demoQuestions];
        this.totalQuestions = this.questions.length;
        this.loadNextQuestion();
      }
    });
  }

  ngOnDestroy() {
    this.stopTimer();
    this.audio.stopMusic();
    this.subs.forEach(s => s.unsubscribe());
  }

  loadNextQuestion() {
    this.currentQuestion = null;
    this.selectedAnswer = null;
    this.feedbackState = null;
    this.stopTimer();

    // Use pre-loaded AI questions if available
    if (this.questions.length > 0 && this.questionIndex < this.questions.length) {
      this.currentQuestion = this.questions[this.questionIndex];
      this.startTimer();
      return;
    }

    // Fallback to demo questions for solo/demo mode if fetch failed
    if (this.roomCode === 'solo' || this.sessionId === 'demo') {
      setTimeout(() => {
        if (this.questionIndex < this.demoQuestions.length) {
          this.currentQuestion = this.demoQuestions[this.questionIndex];
          this.startTimer();
        } else {
          this.endGame();
        }
      }, 600);
      return;
    }

    // Multiplayer/Team mode follows original backend flow
    this.service.getNextQuestion(this.sessionId).subscribe({
      next: (q: any) => { this.currentQuestion = q; this.startTimer(); },
      error: () => {
        this.currentQuestion = this.demoQuestions[this.questionIndex] || null;
        if (this.currentQuestion) this.startTimer(); else this.endGame();
      }
    });
  }

  startTimer() {
    this.totalTime = this.currentQuestion?.timeLimit || 20; // Use AI suggested time limit
    this.timeLeft = this.totalTime;
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) { this.stopTimer(); this.handleAnswer(''); }
    }, 1000);
  }

  stopTimer() { clearInterval(this.timerInterval); }

  handleAnswer(answer: string) {
    if (this.feedbackState || !this.currentQuestion || this.selectedAnswer) return;
    this.selectedAnswer = answer;
    const elapsed = Date.now() - this.startTime;

    if (this.isMultiplayer) {
      // Server-authoritative answer submission
      this.socketService.submitAnswer(this.roomCode, answer, elapsed);
      // Immediately track locally
      if (!this.answeredPlayers.includes(this.socketService.socketId)) {
        this.answeredPlayers.push(this.socketService.socketId);
      }
      return;
    }

    // Solo logic remains local
    this.stopTimer();
    const isCorrect = answer === this.currentQuestion.correctAnswer;

    // Log solo answer to backend for stats if not demo
    if (this.sessionId !== 'demo') {
      this.service.submitAnswer(this.sessionId, this.currentQuestion.questionId, answer, elapsed).subscribe({
        error: (err) => console.error('[Solo] Submit Answer Error:', err)
      });
    }

    if (isCorrect) {
      const base = this.currentQuestion.points || (this.difficulty === 'hard' ? 300 : this.difficulty === 'medium' ? 200 : 100);
      const bonus = Math.max(0, Math.floor((this.totalTime * 1000 - elapsed) / 500));
      const points = (base + bonus) * this.combo;
      this.score += points;
      this.lastPointsEarned = points;
      this.combo++;
      this.feedbackState = 'correct';
      this.audio.playSFX('correct');
      this.scorePopped = true;
      setTimeout(() => this.scorePopped = false, 600);
    } else {
      this.combo = 1;
      this.feedbackState = 'wrong';
      this.audio.playSFX('wrong');
    }

    this.scoringService.setScore(this.score);

    setTimeout(() => {
      this.questionIndex++;
      if (this.questionIndex < this.totalQuestions) this.loadNextQuestion();
      else this.endGame();
    }, 2000);
  }

  usePowerUp(type: keyof typeof this.powerUps) {
    if (this.powerUps[type] <= 0) return;
    this.audio.playSFX('powerup');
    this.powerUps[type]--;
    if (type === 'doubler') this.combo = Math.min(this.combo + 1, 6);
    if (type === 'bonus') { this.score += 150; this.scoringService.setScore(this.score); }
  }

  endGame() {
    this.finished = true;
    this.stopTimer();

    const isMultiplayer = this.sessionId === 'multiplayer';

    if (isMultiplayer) {
      // Emit final score to all room members
      this.socketService.submitFinalScore(
        this.roomCode,
        this.username,
        this.avatar,
        this.score,
        this.difficulty
      );

      // Navigate to podium — scores will be aggregated there via socket
      this.router.navigate(['/brainrush/podium'], {
        state: {
          isMultiplayer: true,
          roomCode: this.roomCode,
          myScore: this.score,
          myUsername: this.username,
          myAvatar: this.avatar,
          myDifficulty: this.difficulty,
        }
      });

    } else if (this.sessionId !== 'demo') {
      this.service.finishGame(this.sessionId).subscribe({
        next: (res: any) => {
          this.router.navigate(['/brainrush/podium'], { state: { result: res } });
        },
        error: (err: any) => {
          console.error('[Solo] Finish Game Error:', err);
          // Fallback redirect even on error so user isn't stuck
          this.router.navigate(['/brainrush/podium'], {
            state: {
              result: {
                score: this.score,
                difficultyAchieved: this.difficulty,
                aiFeedback: 'Practice makes perfect!'
              }
            }
          });
        }
      });
    } else {
      this.router.navigate(['/brainrush/podium'], {
        state: {
          result: {
            score: this.score,
            difficultyAchieved: this.difficulty,
            timeSpent: 60,
            aiFeedback: 'Great effort! Keep practicing to climb the difficulty levels and improve your speed.'
          }
        }
      });
    }
  }
}
