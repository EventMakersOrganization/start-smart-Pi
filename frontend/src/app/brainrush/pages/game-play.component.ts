import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BrainrushService } from '../services/brainrush.service';
import { SocketService } from '../services/socket.service';

@Component({
  selector: 'app-game-play',
  templateUrl: './game-play.component.html',
  styleUrls: ['./game-play.component.css']
})
export class GamePlayComponent implements OnInit, OnDestroy {
  gameSessionId!: string;
  currentQuestion: any;
  timeLeft = 20;
  selectedAnswer = '';
  score = 0;
  combo = 0;
  difficulty: 'easy' | 'medium' | 'hard' = 'easy';
  currentQuestionIndex = 1;
  leaderboard: any[] = [];
  showFeedback = false;
  isCorrect = false;
  pointsEarned = 0;
  labels = ['A', 'B', 'C', 'D'];
  powerUps = { multiplier: 0, shield: 0, hint: 0, bonus: 0 };
  private timer: any;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private brainrushService: BrainrushService,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    this.gameSessionId = this.route.snapshot.paramMap.get('id')!;
    this.socketService.connect();

    // Load first question from localStorage
    const firstQuestionData = localStorage.getItem('firstQuestion');
    if (firstQuestionData) {
      this.currentQuestion = JSON.parse(firstQuestionData);
      this.startTimer();
      localStorage.removeItem('firstQuestion');
    }

    // Listen for new questions
    this.subscriptions.push(
      this.socketService.onNewQuestion().subscribe((question) => {
        this.currentQuestion = question;
        this.startTimer();
        this.showFeedback = false;
        this.selectedAnswer = '';
      })
    );

    // Listen for leaderboard updates
    this.subscriptions.push(
      this.socketService.onLeaderboardUpdate().subscribe((leaderboard) => {
        this.leaderboard = leaderboard;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    clearInterval(this.timer);
  }

  selectAnswer(answer: string) {
    this.selectedAnswer = answer;
  }

  submitAnswer() {
    if (!this.selectedAnswer || this.timeLeft <= 0) return;

    clearInterval(this.timer);
    const timeSpent = 20 - this.timeLeft;
    const isCorrect = this.selectedAnswer === this.currentQuestion.correctAnswer;

    if (isCorrect) {
      this.combo++;
      this.pointsEarned = this.calculatePoints(timeSpent);
      this.score += this.pointsEarned;
    } else {
      this.combo = 0;
      this.pointsEarned = 0;
    }

    this.isCorrect = isCorrect;
    this.showFeedback = true;

    // Submit to backend
    this.brainrushService.submitAnswer(this.gameSessionId, this.currentQuestion._id, this.selectedAnswer, timeSpent * 1000).subscribe({
      next: (response) => {
        this.difficulty = response.difficulty;
        if (response.newQuestion) {
          // For solo mode, set the next question directly
          setTimeout(() => {
            this.currentQuestionIndex++;
            if (this.currentQuestionIndex > 5) {
              this.endGame();
            } else {
              this.currentQuestion = response.newQuestion;
              this.startTimer();
              this.showFeedback = false;
              this.selectedAnswer = '';
            }
          }, 2000);
        } else {
          // For multiplayer, wait for socket event
          setTimeout(() => {
            this.currentQuestionIndex++;
            if (this.currentQuestionIndex > 5) {
              this.endGame();
            }
          }, 2000);
        }
      },
      error: (error) => console.error(error)
    });
  }

  private startTimer() {
    this.timeLeft = 20;
    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.submitAnswer(); // Auto submit on timeout
      }
    }, 1000);
  }

  private calculatePoints(timeSpent: number): number {
    const base = 100;
    const timeBonus = (20 - timeSpent) * 5;
    const comboMultiplier = Math.min(this.combo, 5);
    const difficultyMultiplier = { easy: 1, medium: 1.5, hard: 2 }[this.difficulty];
    return Math.round((base + timeBonus) * comboMultiplier * difficultyMultiplier);
  }

  private endGame() {
    // Navigate to results
    // this.router.navigate(['/brainrush/results', this.gameSessionId]);
  }
}
