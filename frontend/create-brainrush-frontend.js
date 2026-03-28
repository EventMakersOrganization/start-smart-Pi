const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src', 'app', 'brainrush');

const dirs = [
  baseDir,
  path.join(baseDir, 'pages', 'lobby'),
  path.join(baseDir, 'pages', 'game-play'),
  path.join(baseDir, 'pages', 'final-podium'),
  path.join(baseDir, 'components', 'timer-bar'),
  path.join(baseDir, 'components', 'score-board'),
  path.join(baseDir, 'components', 'leaderboard'),
  path.join(baseDir, 'components', 'question-card'),
  path.join(baseDir, 'components', 'final-feedback'),
  path.join(baseDir, 'services'),
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const files = {
  // Services
  'services/brainrush.service.ts': `
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BrainrushService {
  private apiUrl = 'http://localhost:3000/brainrush'; // Make sure this matches NestJS backend

  constructor(private http: HttpClient) {}

  createRoom(mode: string): Observable<any> {
    return this.http.post(\`\${this.apiUrl}/create-room\`, { mode });
  }

  joinRoom(roomCode: string): Observable<any> {
    return this.http.post(\`\${this.apiUrl}/join-room\`, { roomCode });
  }

  getNextQuestion(sessionId: string): Observable<any> {
    return this.http.get(\`\${this.apiUrl}/\${sessionId}/next-question\`);
  }

  submitAnswer(sessionId: string, questionId: string, answer: string, responseTime: number): Observable<any> {
    return this.http.post(\`\${this.apiUrl}/\${sessionId}/submit-answer\`, { questionId, answer, responseTime });
  }

  finishGame(sessionId: string): Observable<any> {
    return this.http.post(\`\${this.apiUrl}/\${sessionId}/finish\`, {});
  }
}
  `,

  'services/socket.service.ts': `
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: Socket;
  private socketUrl = 'http://localhost:3000/brainrush'; // Matches Gateway namespace

  connect(token: string) {
    this.socket = io(this.socketUrl, {
      extraHeaders: {
        Authorization: \`Bearer \${token}\`
      }
    });
  }

  joinRoom(roomCode: string) {
    if (this.socket) {
      this.socket.emit('joinGameRoom', roomCode);
    }
  }

  updateScore(gameSessionId: string, roomCode: string) {
    if (this.socket) {
      this.socket.emit('updateScore', { gameSessionId, roomCode });
    }
  }

  onLeaderboardUpdate(): Observable<any> {
    return new Observable((subscriber) => {
      if (this.socket) {
        this.socket.on('leaderboardUpdate', (data) => subscriber.next(data));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
  `,

  'services/scoring.service.ts': `
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScoringService {
  private scoreSubject = new BehaviorSubject<number>(0);
  score$ = this.scoreSubject.asObservable();

  setScore(score: number) {
    this.scoreSubject.next(score);
  }

  getScore() {
    return this.scoreSubject.value;
  }
}
  `,

  // Components
  'components/timer-bar/timer-bar.component.ts': `
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-timer-bar',
  template: \`
    <div class="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden">
      <div class="bg-blue-500 h-4 rounded-full transition-all duration-100 ease-linear" 
           [style.width.%]="(timeLeft / totalTime) * 100"></div>
    </div>
  \`
})
export class TimerBarComponent implements OnInit, OnDestroy {
  @Input() totalTime = 15000;
  @Output() timeUp = new EventEmitter<void>();
  
  timeLeft!: number;
  private interval: any;

  ngOnInit() {
    this.timeLeft = this.totalTime;
  }

  start() {
    this.timeLeft = this.totalTime;
    this.interval = setInterval(() => {
      this.timeLeft -= 100;
      if (this.timeLeft <= 0) {
        this.stop();
        this.timeUp.emit();
      }
    }, 100);
  }

  stop() {
    clearInterval(this.interval);
  }

  ngOnDestroy() {
    this.stop();
  }
}
  `,

  'components/score-board/score-board.component.ts': `
import { Component, OnInit } from '@angular/core';
import { ScoringService } from '../../services/scoring.service';

@Component({
  selector: 'app-score-board',
  template: \`
    <div class="bg-indigo-600 text-white p-4 rounded-lg shadow-md font-bold text-xl text-center">
      Score: {{ score }}
    </div>
  \`
})
export class ScoreBoardComponent implements OnInit {
  score = 0;
  constructor(private scoringService: ScoringService) {}
  
  ngOnInit() {
    this.scoringService.score$.subscribe(s => this.score = s);
  }
}
  `,

  'components/question-card/question-card.component.ts': `
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-question-card',
  template: \`
    <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl mx-auto">
      <h2 class="text-2xl font-bold mb-6 text-gray-800">{{ question?.questionText }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button *ngFor="let option of question?.options" 
                (click)="selectAnswer(option)"
                class="p-4 rounded-xl border-2 hover:bg-indigo-50 hover:border-indigo-400 transition-all font-semibold text-lg text-gray-700">
          {{ option }}
        </button>
      </div>
    </div>
  \`
})
export class QuestionCardComponent {
  @Input() question: any;
  @Output() answerSelected = new EventEmitter<string>();

  selectAnswer(answer: string) {
    this.answerSelected.emit(answer);
  }
}
  `,

  'components/leaderboard/leaderboard.component.ts': `
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-leaderboard',
  template: \`
    <div class="bg-white p-4 rounded-lg shadow max-w-sm">
      <h3 class="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Live Ranking</h3>
      <ul>
        <li *ngFor="let player of leaderboard; let i = index" class="flex justify-between py-2 border-b last:border-0">
          <span class="font-semibold text-gray-600">#{{ i + 1 }} {{ player.userId?.first_name }}</span>
          <span class="font-bold text-indigo-600">{{ player.score }} pts</span>
        </li>
      </ul>
    </div>
  \`
})
export class LeaderboardComponent {
  @Input() leaderboard: any[] = [];
}
  `,

  'components/final-feedback/final-feedback.component.ts': `
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-final-feedback',
  template: \`
    <div class="bg-blue-50 p-6 rounded-xl border-2 border-blue-200 mt-6">
      <h3 class="text-xl font-bold text-blue-800 mb-2">AI Feedback <span class="text-sm rounded bg-blue-200 px-2 py-1 ml-2">Generated locally</span></h3>
      <p class="text-gray-700 leading-relaxed">{{ feedback }}</p>
    </div>
  \`
})
export class FinalFeedbackComponent {
  @Input() feedback: string = '';
}
  `,

  // Pages
  'pages/lobby/lobby.component.ts': `
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BrainrushService } from '../../services/brainrush.service';

@Component({
  selector: 'app-lobby',
  template: \`
    <div class="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center">
        <h1 class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 mb-8">
          BrainRush
        </h1>
        
        <div class="space-y-4">
          <button (click)="createSolo()" class="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg transition shadow-lg">
            Play Solo
          </button>
          
          <div class="relative py-4">
             <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300"></div>
             </div>
             <div class="relative flex justify-center">
                <span class="bg-white px-4 text-sm text-gray-500">Multijoueur</span>
             </div>
          </div>
          
          <button (click)="createMultiplayer()" class="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-lg transition shadow-lg">
            Create Room
          </button>
          
          <div class="flex space-x-2 mt-4">
            <input [(ngModel)]="roomCode" placeholder="Enter Room Code" class="flex-1 p-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none font-bold uppercase" />
            <button (click)="joinRoom()" class="px-6 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold transition">
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  \`
})
export class LobbyComponent {
  roomCode = '';

  constructor(private service: BrainrushService, private router: Router) {}

  createSolo() {
    this.service.createRoom('solo').subscribe((res: any) => {
      this.router.navigate(['/brainrush/game', res._id, 'solo']);
    });
  }

  createMultiplayer() {
    this.service.createRoom('multiplayer').subscribe((res: any) => {
      this.router.navigate(['/brainrush/game', res._id, res.roomCode]);
    });
  }

  joinRoom() {
    if (this.roomCode) {
      this.service.joinRoom(this.roomCode).subscribe((res: any) => {
        this.router.navigate(['/brainrush/game', res._id, res.roomCode]);
      });
    }
  }
}
  `,

  'pages/game-play/game-play.component.ts': `
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BrainrushService } from '../../services/brainrush.service';
import { TimerBarComponent } from '../../components/timer-bar/timer-bar.component';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-game-play',
  template: \`
    <div class="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <div class="w-full max-w-5xl flex justify-between items-start mb-8 gap-4">
        <app-score-board></app-score-board>
        <app-leaderboard *ngIf="isMultiplayer" [leaderboard]="leaderboard"></app-leaderboard>
      </div>

      <div class="w-full max-w-2xl mb-6 mt-10" *ngIf="currentQuestion">
        <app-timer-bar #timer (timeUp)="handleTimeUp()" [totalTime]="15000"></app-timer-bar>
      </div>

      <div *ngIf="currentQuestion" class="w-full">
        <app-question-card [question]="currentQuestion" (answerSelected)="handleAnswer($event)"></app-question-card>
      </div>

      <div *ngIf="!currentQuestion && !isFinished" class="mt-20">
        <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mx-auto"></div>
        <p class="text-gray-500 font-semibold mt-4 text-center">AI Generating Next Question...</p>
      </div>
      
      <button *ngIf="!isFinished" (click)="finishGame()" class="mt-12 text-gray-400 hover:text-red-500 font-semibold underline">
        End Game Early
      </button>
    </div>
  \`
})
export class GamePlayComponent implements OnInit {
  sessionId!: string;
  roomCode!: string;
  isMultiplayer = false;
  currentQuestion: any;
  startTime!: number;
  leaderboard: any[] = [];
  isFinished = false;

  @ViewChild('timer') timer!: TimerBarComponent;

  constructor(
    private route: ActivatedRoute,
    private service: BrainrushService,
    private socketService: SocketService,
    private router: Router
  ) {}

  ngOnInit() {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId')!;
    this.roomCode = this.route.snapshot.paramMap.get('roomCode')!;
    this.isMultiplayer = this.roomCode !== 'solo';

    if (this.isMultiplayer) {
      this.socketService.connect(localStorage.getItem('token') || '');
      this.socketService.joinRoom(this.roomCode);
      this.socketService.onLeaderboardUpdate().subscribe(data => {
        this.leaderboard = data;
      });
    }

    this.loadNextQuestion();
  }

  loadNextQuestion() {
    this.currentQuestion = null;
    this.service.getNextQuestion(this.sessionId).subscribe((q) => {
      this.currentQuestion = q;
      this.startTime = Date.now();
      setTimeout(() => this.timer.start(), 0);
    });
  }

  handleAnswer(answer: string) {
    this.timer.stop();
    const timeToAnswer = Date.now() - this.startTime;
    this.service.submitAnswer(this.sessionId, this.currentQuestion.questionId, answer, timeToAnswer)
      .subscribe((res: any) => {
        if(this.isMultiplayer) {
           this.socketService.updateScore(this.sessionId, this.roomCode);
        }
        if (res.newScore > 100) { 
           this.finishGame();
        } else {
           this.loadNextQuestion();
        }
      });
  }

  handleTimeUp() {
    this.handleAnswer('');
  }

  finishGame() {
    this.isFinished = true;
    this.service.finishGame(this.sessionId).subscribe((res: any) => {
      if(this.isMultiplayer) this.socketService.disconnect();
      this.router.navigate(['/brainrush/podium'], { state: { result: res }});
    });
  }
}
  `,

  'pages/final-podium/final-podium.component.ts': `
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-final-podium',
  template: \`
    <div class="min-h-screen bg-indigo-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 class="text-5xl font-black mb-12 text-yellow-400 drop-shadow-md">Game Over!</h1>
      
      <div class="bg-indigo-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full mb-8">
        <h2 class="text-3xl font-bold mb-4">Your Final Score</h2>
        <div class="text-6xl font-black text-white bg-clip-text text-transparent bg-gradient-to-br from-green-400 to-blue-500 mb-8">
          {{ result?.score || 0 }} pts
        </div>
        
        <p class="text-indigo-200 font-semibold text-lg mb-2">Reached Level: <span class="capitalize text-white">{{ result?.difficultyAchieved || 'Medium' }}</span></p>
        <p class="text-indigo-200 font-semibold text-lg">Time logic: {{ result?.timeSpent || 0 }}s</p>

        <app-final-feedback *ngIf="result?.aiFeedback" [feedback]="result?.aiFeedback"></app-final-feedback>
      </div>

      <button (click)="goToLobby()" class="px-8 py-4 bg-white text-indigo-900 font-bold rounded-full hover:bg-gray-100 transition shadow-lg">
        Play Again
      </button>
    </div>
  \`
})
export class FinalPodiumComponent implements OnInit {
  result: any;

  constructor(private router: Router) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.result = navigation.extras.state['result'];
    }
  }

  ngOnInit() {
    if (!this.result) this.result = history.state.result;
  }

  goToLobby() {
    this.router.navigate(['/brainrush/lobby']);
  }
}
  `,

  'brainrush.module.ts': `
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import { LobbyComponent } from './pages/lobby/lobby.component';
import { GamePlayComponent } from './pages/game-play/game-play.component';
import { FinalPodiumComponent } from './pages/final-podium/final-podium.component';
import { TimerBarComponent } from './components/timer-bar/timer-bar.component';
import { ScoreBoardComponent } from './components/score-board/score-board.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { QuestionCardComponent } from './components/question-card/question-card.component';
import { FinalFeedbackComponent } from './components/final-feedback/final-feedback.component';

const routes: Routes = [
  { path: 'lobby', component: LobbyComponent },
  { path: 'game/:sessionId/:roomCode', component: GamePlayComponent },
  { path: 'podium', component: FinalPodiumComponent },
  { path: '', redirectTo: 'lobby', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    LobbyComponent,
    GamePlayComponent,
    FinalPodiumComponent,
    TimerBarComponent,
    ScoreBoardComponent,
    LeaderboardComponent,
    QuestionCardComponent,
    FinalFeedbackComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forChild(routes)
  ]
})
export class BrainrushModule { }
  `
};

for (const [relativePath, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(baseDir, relativePath), content.trim() + '\n');
}

console.log('BrainRush Frontend Module generated successfully.');
