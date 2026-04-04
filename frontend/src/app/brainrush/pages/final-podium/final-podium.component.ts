import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SocketService } from '../../services/socket.service';
import { AudioService } from '../../services/audio.service';

interface PlayerScore {
  socketId: string;
  username: string;
  avatar: string;
  score: number;
  difficulty: string;
  rank?: number;
}

@Component({
  selector: 'app-final-podium',
  standalone: true,
  imports: [CommonModule, RouterModule],
  styles: [`
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes riseUp {
      from { opacity: 0; transform: translateY(60px) scale(0.9); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    @keyframes sparkle {
      0%,100% { opacity: 1; transform: scale(1)   rotate(0deg); }
      50%      { opacity: .7; transform: scale(1.3) rotate(20deg); }
    }
    @keyframes confettiDrop {
      0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
      100% { transform: translateY(100vh)  rotate(720deg); opacity: 0; }
    }
    @keyframes slideRow {
      from { opacity: 0; transform: translateX(-20px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes pulse-gold {
      0%,100% { box-shadow: 0 0 0 0 rgba(250,204,21,0.5); }
      50%     { box-shadow: 0 0 0 16px rgba(250,204,21,0); }
    }

    .fade-in-up { animation: fadeInUp 0.6s ease-out both; }
    .rise-up    { animation: riseUp 0.8s cubic-bezier(.36,.07,.19,.97) both; }
    .sparkle    { animation: sparkle 1.5s ease-in-out infinite; }
    .slide-row  { animation: slideRow 0.4s ease-out both; }
    .pulse-gold { animation: pulse-gold 2s ease-in-out infinite; }

    .confetti-piece {
      position: absolute;
      width: 10px; height: 10px;
      border-radius: 2px;
      animation: confettiDrop linear forwards;
    }

    .podium-bar-1 { height: 140px; }
    .podium-bar-2 { height: 100px; }
    .podium-bar-3 { height: 72px; }

    .rank-badge {
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 0.85rem;
      flex-shrink: 0;
    }

    .score-bar {
      height: 6px;
      border-radius: 3px;
      transition: width 1.2s ease-out;
      background: linear-gradient(90deg, #60a5fa, #a78bfa);
    }
    .score-bar.gold   { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .score-bar.silver { background: linear-gradient(90deg, #94a3b8, #64748b); }
    .score-bar.bronze { background: linear-gradient(90deg, #d97706, #92400e); }
  `],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900 flex flex-col items-center justify-start pb-16 relative overflow-hidden">

      <!-- Confetti -->
      <div *ngIf="isMultiplayer" class="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div *ngFor="let c of confetti" class="confetti-piece"
          [style.left]="c.x + '%'"
          [style.top]="c.top + 'px'"
          [style.background]="c.color"
          [style.animation-duration]="c.duration + 's'"
          [style.animation-delay]="c.delay + 's'"
          [style.transform]="'rotate(' + c.rot + 'deg)'">
        </div>
      </div>

      <!-- Background glow orbs -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-yellow-400/10 rounded-full blur-3xl"></div>
        <div class="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div class="absolute bottom-0 right-0 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl"></div>
      </div>

      <div class="relative z-10 w-full max-w-2xl px-4 pt-10">

        <!-- ── HEADER ── -->
        <div class="text-center mb-10 fade-in-up">
          <div class="text-6xl mb-3 sparkle inline-block">🏆</div>
          <h1 class="text-5xl font-black text-white drop-shadow-2xl">
            {{ isMultiplayer ? 'Final Results' : 'Game Over!' }}
          </h1>
          <p *ngIf="isMultiplayer" class="text-white/60 mt-2 text-lg">
            Room {{ roomCode }} &nbsp;·&nbsp; {{ scores.length }} players
          </p>
        </div>

        <!-- ══════════════════════════════════════════════════
             MULTIPLAYER PODIUM
        ══════════════════════════════════════════════════ -->
        <ng-container *ngIf="isMultiplayer">

          <!-- Loading bar while waiting for all scores -->
          <div *ngIf="!allScoresIn"
            class="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 mb-6 text-center fade-in-up">
            <p class="text-white/60 text-sm font-bold uppercase tracking-widest mb-3">
              Collecting scores… {{ submitted }} / {{ total }}
            </p>
            <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all duration-700"
                [style.width.%]="total > 0 ? (submitted / total) * 100 : 0">
              </div>
            </div>
          </div>

          <!-- Top 3 Visual Podium -->
          <div *ngIf="allScoresIn && top3.length > 0"
            class="flex items-end justify-center gap-4 mb-8 px-2 rise-up" style="animation-delay:0.2s">

            <!-- 2nd place -->
            <div *ngIf="top3[1]" class="flex flex-col items-center flex-1 max-w-[140px]">
              <div class="text-3xl mb-1">🥈</div>
              <div class="w-12 h-12 rounded-full flex items-center justify-center font-black text-white text-3xl mb-2 shadow-lg bg-white/10 border border-white/20">
                {{ top3[1].avatar || '🥈' }}
              </div>
              <p class="text-white font-bold text-sm truncate w-full text-center">{{ top3[1].username }}</p>
              <p class="text-white/60 text-xs font-semibold mb-2">{{ top3[1].score | number }} pts</p>
              <div class="w-full podium-bar-2 bg-gradient-to-t from-slate-400/60 to-slate-300/40 rounded-t-xl border-t-2 border-slate-300/50 flex items-center justify-center">
                <span class="text-slate-300 font-black text-3xl">2</span>
              </div>
            </div>

            <!-- 1st place -->
            <div *ngIf="top3[0]" class="flex flex-col items-center flex-1 max-w-[160px]">
              <div class="text-4xl mb-1 sparkle">👑</div>
              <div class="w-16 h-16 rounded-full flex items-center justify-center font-black text-white text-4xl mb-2 shadow-2xl pulse-gold ring-4 ring-yellow-400 bg-white/10 border border-white/30">
                {{ top3[0].avatar || '🥇' }}
              </div>
              <p class="text-yellow-300 font-black truncate w-full text-center">{{ top3[0].username }}</p>
              <p class="text-yellow-400/80 text-sm font-black mb-2">{{ top3[0].score | number }} pts</p>
              <div class="w-full podium-bar-1 bg-gradient-to-t from-yellow-500/70 to-yellow-400/50 rounded-t-xl border-t-2 border-yellow-400/60 flex items-center justify-center">
                <span class="text-yellow-200 font-black text-4xl">1</span>
              </div>
            </div>

            <!-- 3rd place -->
            <div *ngIf="top3[2]" class="flex flex-col items-center flex-1 max-w-[140px]">
              <div class="text-3xl mb-1">🥉</div>
              <div class="w-12 h-12 rounded-full flex items-center justify-center font-black text-white text-3xl mb-2 shadow-lg bg-white/10 border border-white/20">
                {{ top3[2].avatar || '🥉' }}
              </div>
              <p class="text-white font-bold text-sm truncate w-full text-center">{{ top3[2].username }}</p>
              <p class="text-white/60 text-xs font-semibold mb-2">{{ top3[2].score | number }} pts</p>
              <div class="w-full podium-bar-3 bg-gradient-to-t from-amber-700/60 to-amber-600/40 rounded-t-xl border-t-2 border-amber-600/50 flex items-center justify-center">
                <span class="text-amber-300 font-black text-3xl">3</span>
              </div>
            </div>
          </div>

          <!-- Full Leaderboard Table -->
          <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 mb-6 shadow-2xl">
            <h2 class="text-white font-black text-lg mb-4 flex items-center gap-2">
              <span class="material-symbols-outlined text-yellow-400">leaderboard</span>
              Full Leaderboard
            </h2>

            <div class="space-y-3">
              <div *ngFor="let s of scores; let i = index"
                class="slide-row flex items-center gap-4 p-3 rounded-2xl transition-all duration-200"
                [style.animation-delay]="i * 0.08 + 's'"
                [ngClass]="s.username === myUsername
                  ? 'bg-blue-500/20 border border-blue-400/40'
                  : 'bg-white/5 border border-white/10'">

                <!-- Rank badge -->
                <div class="rank-badge"
                  [ngClass]="i === 0 ? 'bg-yellow-400 text-yellow-900' :
                              i === 1 ? 'bg-slate-300 text-slate-800' :
                              i === 2 ? 'bg-amber-600 text-white' :
                                        'bg-white/10 text-white/60'">
                  {{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) }}
                </div>

                <!-- Avatar -->
                <div class="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-xl flex-shrink-0 bg-white/10 border border-white/10">
                  {{ s.avatar || '👤' }}
                </div>

                <!-- Name + difficulty -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-white font-bold truncate">{{ s.username }}</span>
                    <span *ngIf="s.username === myUsername"
                      class="text-[10px] font-black uppercase bg-blue-400/20 text-blue-300 border border-blue-400/40 px-2 py-0.5 rounded-full">You</span>
                  </div>
                  <div class="flex items-center gap-2 mt-1">
                    <div class="score-bar w-full"
                      [ngClass]="i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''"
                      [style.width.%]="maxScore > 0 ? (s.score / maxScore) * 100 : 0">
                    </div>
                  </div>
                </div>

                <!-- Score -->
                <div class="text-right flex-shrink-0">
                  <div class="font-black text-lg"
                    [ngClass]="i === 0 ? 'text-yellow-300' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-500' : 'text-white/70'">
                    {{ s.score | number }}
                  </div>
                  <div class="text-white/30 text-[10px] uppercase font-bold">pts</div>
                </div>
              </div>

              <!-- Waiting for other players -->
              <div *ngIf="!allScoresIn" class="text-center text-white/30 py-2 text-sm italic">
                Waiting for {{ total - submitted }} more player{{ total - submitted !== 1 ? 's' : '' }}…
              </div>
            </div>
          </div>

          <!-- Your result highlight -->
          <div *ngIf="myScore !== null" class="bg-white/10 backdrop-blur border border-white/15 rounded-2xl p-5 mb-6 flex items-center gap-4 fade-in-up">
            <div class="text-4xl">{{ myRankEmoji }}</div>
            <div>
              <p class="text-white/50 text-xs font-bold uppercase tracking-widest mb-0.5">Your Result</p>
              <p class="text-white font-black text-xl">{{ myScore | number }} pts</p>
              <p class="text-white/50 text-sm">Rank #{{ myRank }} out of {{ scores.length }}</p>
            </div>
          </div>

        </ng-container>

        <!-- ══════════════════════════════════════════════════
             SOLO RESULT
        ══════════════════════════════════════════════════ -->
        <ng-container *ngIf="!isMultiplayer">
          <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl mb-8 text-center fade-in-up">
            <p class="text-white/40 text-sm font-bold uppercase tracking-widest mb-2">Your Score</p>
            <div class="text-7xl font-black text-yellow-300 drop-shadow-2xl mb-4">
              {{ result?.score || 0 | number }}
            </div>
            <p class="text-white/60 font-semibold text-lg mb-1">
              Reached Level: <span class="capitalize text-white font-black">{{ result?.difficultyAchieved || 'Medium' }}</span>
            </p>
            <p *ngIf="result?.aiFeedback" class="text-white/50 text-sm mt-4 italic leading-relaxed max-w-md mx-auto">
              💡 {{ result.aiFeedback }}
            </p>
          </div>
        </ng-container>

        <!-- ── ACTIONS ── -->
        <div class="space-y-3 fade-in-up" style="animation-delay:0.5s">
          <button id="play-again-btn"
            (click)="goToLobby()"
            class="w-full py-5 bg-gradient-to-r from-yellow-400 to-orange-500 hover:opacity-90 text-white rounded-2xl text-xl font-black uppercase tracking-wider transition-all shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-3">
            <span class="material-symbols-outlined text-2xl">replay</span>
            Play Again
          </button>
          <button routerLink="/student-dashboard"
            class="w-full py-3 text-white/50 hover:text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 rounded-2xl transition-all">
            <span class="material-symbols-outlined">home</span>
            Back to Dashboard
          </button>
        </div>

      </div>
    </div>
  `
})
export class FinalPodiumComponent implements OnInit, OnDestroy {
  // Solo
  result: any;

  // Multiplayer
  isMultiplayer = false;
  roomCode = '';
  myUsername = '';
  myAvatar = '🎮';
  myScore: number | null = null;

  myDifficulty = '';
  scores: PlayerScore[] = [];
  submitted = 0;
  total = 0;
  allScoresIn = false;

  confetti: any[] = [];

  private subs: Subscription[] = [];

  constructor(
    private router: Router,
    private socketService: SocketService,
    private audio: AudioService
  ) {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state ?? history.state;

    this.isMultiplayer = state?.isMultiplayer === true;
    this.roomCode = state?.roomCode ?? '';
    this.myUsername = state?.myUsername ?? '';
    this.myAvatar = state?.myAvatar ?? '🎮';
    this.myScore = state?.myScore ?? null;
    this.myDifficulty = state?.myDifficulty ?? 'medium';

    // Multiplayer: Handle pre-passed ranking
    if (state?.finalRanking) {
      this.scores = state.finalRanking;
      this.submitted = state.finalRanking.length;
      this.total = state.finalRanking.length;
      this.allScoresIn = true;
    }

    // Solo result
    this.result = state?.result;
  }

  ngOnInit(): void {
    if (this.isMultiplayer) {
      this.buildConfetti();
      this.listenForScores();

      // Seed with own score immediately so it shows up
      if (this.myScore !== null && this.myUsername && !this.allScoresIn) {
        this.scores = [{
          socketId: 'me',
          username: this.myUsername,
          avatar: this.myAvatar,
          score: this.myScore,
          difficulty: this.myDifficulty,
        }];
        this.submitted = 1;
      }
      this.audio.playSFX('victory');
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Socket listener ─────────────────────────────────────────────────────

  private listenForScores(): void {
    // Legacy support
    this.subs.push(
      this.socketService.onFinalScores().subscribe(({ scores, submitted, total }) => {
        this.scores = scores;
        this.submitted = submitted;
        this.total = total;
        this.allScoresIn = submitted >= total && total > 0;
      })
    );

    // New authoritative results
    this.subs.push(
      this.socketService.onFinalResults().subscribe(({ ranking }) => {
        this.scores = ranking;
        this.submitted = ranking.length;
        this.total = ranking.length;
        this.allScoresIn = true;
      })
    );
  }

  // ── Computed helpers ────────────────────────────────────────────────────

  get top3(): PlayerScore[] {
    return this.scores.slice(0, 3);
  }

  get maxScore(): number {
    return this.scores.length > 0 ? this.scores[0].score : 1;
  }

  get myRank(): number {
    const idx = this.scores.findIndex(s => s.username === this.myUsername);
    return idx >= 0 ? idx + 1 : 0;
  }

  get myRankEmoji(): string {
    if (this.myRank === 1) return '🥇';
    if (this.myRank === 2) return '🥈';
    if (this.myRank === 3) return '🥉';
    return '🎮';
  }

  avatarColor(name: string): string {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
    let hash = 0;
    for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  // ── Confetti ────────────────────────────────────────────────────────────

  private buildConfetti(): void {
    const colors = ['#facc15', '#f472b6', '#60a5fa', '#34d399', '#f87171', '#a78bfa'];
    this.confetti = Array.from({ length: 40 }, () => ({
      x: Math.random() * 100,
      top: -20,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 3 + Math.random() * 3,
      delay: Math.random() * 2,
      rot: Math.random() * 360,
    }));
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  goToLobby(): void {
    this.router.navigate(['/brainrush/lobby']);
  }
}
