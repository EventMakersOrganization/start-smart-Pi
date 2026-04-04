import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SocketService, RoomPlayer, RoomData } from '../../services/socket.service';

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  imports: [CommonModule, RouterModule],
  styles: [`
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-24px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes pulse-ring {
      0%   { transform: scale(1);    opacity: 0.8; }
      50%  { transform: scale(1.15); opacity: 0.4; }
      100% { transform: scale(1);    opacity: 0.8; }
    }
    @keyframes bounce-in {
      0%   { transform: scale(0.7); opacity: 0; }
      60%  { transform: scale(1.08); }
      100% { transform: scale(1);   opacity: 1; }
    }
    .fade-in-up  { animation: fadeInUp 0.4s ease-out both; }
    .slide-left  { animation: slideInLeft 0.35s ease-out both; }
    .pulse-ring  { animation: pulse-ring 2s ease-in-out infinite; }
    .bounce-in   { animation: bounce-in 0.45s cubic-bezier(.36,.07,.19,.97) both; }

    .code-char {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px; height: 60px;
      background: rgba(255,255,255,0.08);
      border: 2px solid rgba(255,255,255,0.18);
      border-radius: 12px;
      font-size: 1.9rem;
      font-weight: 900;
      letter-spacing: 0;
      color: white;
      backdrop-filter: blur(8px);
      transition: all 0.2s;
    }

    .player-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      backdrop-filter: blur(6px);
      transition: all 0.3s;
    }
    .player-card:hover { background: rgba(255,255,255,0.12); }

    .avatar {
      width: 44px; height: 44px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem;
      font-weight: 900;
      flex-shrink: 0;
    }

    .start-btn {
      position: relative;
      overflow: hidden;
    }
    .start-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
      border-radius: inherit;
    }
    .start-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .start-btn:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 40px rgba(250,204,21,0.35);
    }

    .copy-btn:active { transform: scale(0.92); }
  `],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">

      <!-- Background decorations -->
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div class="absolute -top-32 -left-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pulse-ring"></div>
        <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl pulse-ring" style="animation-delay:.8s"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      <!-- Error Toast -->
      <div *ngIf="errorMsg"
        class="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-500/90 backdrop-blur text-white font-bold rounded-2xl shadow-2xl border border-red-400/50 fade-in-up flex items-center gap-3">
        <span class="material-symbols-outlined text-xl">error</span>
        {{ errorMsg }}
      </div>

      <!-- Main Card -->
      <div class="relative z-10 w-full max-w-2xl fade-in-up">

        <!-- Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 rounded-full px-5 py-2 mb-5">
            <span class="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></span>
            <span class="text-white/80 text-sm font-bold uppercase tracking-widest">Multiplayer Lobby</span>
          </div>
          <h1 class="text-5xl font-black text-white drop-shadow-2xl mb-2">🎯 BrainRush</h1>
          <p class="text-white/60 text-lg">Waiting for players to join…</p>
        </div>

        <!-- Room Code Card -->
        <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl mb-6">
          <p class="text-white/50 text-xs font-bold uppercase tracking-widest text-center mb-4">Room Code</p>

          <!-- Code Characters -->
          <div class="flex justify-center gap-2 mb-6">
            <span *ngFor="let ch of roomCodeChars" class="code-char bounce-in">{{ ch }}</span>
          </div>

          <!-- Copy Button -->
          <button id="copy-room-code-btn"
            (click)="copyCode()"
            class="copy-btn w-full py-3 flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl border border-white/25 transition-all">
            <span class="material-symbols-outlined text-lg">{{ copied ? 'check_circle' : 'content_copy' }}</span>
            {{ copied ? 'Copied!' : 'Copy Code' }}
          </button>
        </div>

        <!-- Players List Card -->
        <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl mb-6">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-white font-black text-lg flex items-center gap-2">
              <span class="material-symbols-outlined text-yellow-400">groups</span>
              Players
            </h2>
            <span class="bg-white/20 text-white text-sm font-black px-3 py-1 rounded-full">
              {{ players.length }} {{ players.length === 1 ? 'player' : 'players' }}
            </span>
          </div>

          <!-- Player items -->
          <div class="space-y-3">
            <div *ngFor="let player of players; let i = index"
              class="player-card slide-left"
              [style.animation-delay]="i * 0.07 + 's'">

              <!-- Avatar -->
              <div class="avatar"
                [style.background]="avatarColor(player.username)"
                [style.color]="'white'">
                {{ player.username.charAt(0).toUpperCase() }}
              </div>

              <!-- Name + badge -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-white font-bold truncate">{{ player.username }}</span>
                  <span *ngIf="player.isHost"
                    class="text-[10px] font-black uppercase tracking-wider bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">star</span> Host
                  </span>
                  <span *ngIf="player.socketId === mySocketId && !player.isHost"
                    class="text-[10px] font-bold uppercase tracking-wider bg-blue-400/20 text-blue-300 border border-blue-400/40 px-2 py-0.5 rounded-full">
                    You
                  </span>
                </div>
                <p class="text-white/40 text-xs mt-0.5">{{ player.isHost ? 'Game Host' : 'Ready to play' }}</p>
              </div>

              <!-- Ready indicator -->
              <div class="w-2.5 h-2.5 rounded-full" [ngClass]="player.isHost ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'"></div>
            </div>

            <!-- Empty state -->
            <div *ngIf="players.length === 0" class="text-center py-8 text-white/30">
              <span class="material-symbols-outlined text-4xl block mb-2">hourglass_empty</span>
              <p class="text-sm font-medium">Waiting for players...</p>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-3">

          <!-- Start Game (host only) -->
          <button *ngIf="isHost" id="start-game-btn"
            (click)="startGame()"
            [disabled]="players.length < 1 || gameStarting"
            class="start-btn w-full py-5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-2xl text-xl font-black uppercase tracking-wider transition-all duration-300 shadow-2xl flex items-center justify-center gap-3">
            <span *ngIf="!gameStarting" class="material-symbols-outlined text-2xl">rocket_launch</span>
            <svg *ngIf="gameStarting" class="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ gameStarting ? 'Starting…' : 'Start Game' }}
          </button>

          <!-- Waiting message (non-host) -->
          <div *ngIf="!isHost"
            class="w-full py-5 bg-white/5 border border-white/10 text-white/50 rounded-2xl text-center font-bold flex items-center justify-center gap-3">
            <span class="w-2.5 h-2.5 bg-yellow-400/70 rounded-full animate-pulse"></span>
            Waiting for host to start the game…
          </div>

          <!-- Leave Room -->
          <button id="leave-room-btn"
            (click)="leaveRoom()"
            class="w-full py-3 text-white/50 hover:text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 rounded-2xl transition-all">
            <span class="material-symbols-outlined">arrow_back</span>
            Leave Room
          </button>
        </div>

      </div>
    </div>
  `
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
  roomCode = '';
  players: RoomPlayer[] = [];
  isHost = false;
  mySocketId = '';
  myUsername = 'Player';
  copied = false;
  gameStarting = false;
  errorMsg = '';

  private subs: Subscription[] = [];

  constructor(
    private socketService: SocketService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    // Restore state from router navigation
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state ?? history.state;

    this.roomCode = state?.roomCode ?? '';
    this.players = state?.players ?? [];
    this.isHost = state?.isHost ?? false;
    this.mySocketId = this.socketService.socketId;
    // Resolve own username: prefer explicit state.username, then look up by socketId
    this.myUsername = state?.username
      ?? this.players.find((p: RoomPlayer) => p.socketId === this.mySocketId)?.username
      ?? 'Player';

    if (!this.roomCode) {
      this.router.navigate(['/brainrush/lobby']);
      return;
    }

    this.subscribeToEvents();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Event subscriptions ─────────────────────────────────────────────────

  private subscribeToEvents(): void {
    // Player joined — update the list for everyone
    this.subs.push(
      this.socketService.onPlayerJoined().subscribe(({ players }) => {
        this.players = players;
      })
    );

    // Player left — update the list for everyone
    this.subs.push(
      this.socketService.onPlayerLeft().subscribe(({ players, newHostId }) => {
        this.players = players;
        // Re-check if we're now the host
        const me = players.find(p => p.socketId === this.mySocketId);
        if (me) this.isHost = me.isHost;
      })
    );

    // Game started — redirect everyone
    this.subs.push(
      this.socketService.onGameStarted().subscribe(({ roomCode, players }) => {
        this.router.navigate(
          ['/brainrush/game', 'multiplayer', roomCode],
          {
            state: {
              roomCode,
              players,
              username: this.myUsername,
              topic: 'data_structures',
              difficulty: 'medium'
            }
          }
        );
      })
    );

    // Error messages
    this.subs.push(
      this.socketService.onRoomError().subscribe(({ message }) => {
        this.showError(message);
        this.gameStarting = false;
      })
    );
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  startGame(): void {
    if (!this.isHost || this.gameStarting) return;
    this.gameStarting = true;
    this.socketService.startGame(this.roomCode);
  }

  leaveRoom(): void {
    this.socketService.disconnect();
    this.router.navigate(['/brainrush/lobby']);
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.roomCode).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  get roomCodeChars(): string[] {
    return this.roomCode.split('');
  }

  avatarColor(name: string): string {
    const colors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
      '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
    ];
    let hash = 0;
    for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  private showError(msg: string): void {
    this.errorMsg = msg;
    setTimeout(() => (this.errorMsg = ''), 4000);
  }
}
