import {
  Component, EventEmitter, Input, OnInit, OnDestroy, Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { BrandLogoComponent } from '../../../shared/brand-logo/brand-logo.component';
import { BrainrushService } from '../../services/brainrush.service';
import { SocketService } from '../../services/socket.service';
import { AudioService } from '../../services/audio.service';

// ─── LOBBY HEADER ──────────────────────────────────────────────────────────
@Component({
  selector: 'app-lobby-header',
  standalone: true,
  imports: [RouterModule, BrandLogoComponent],
  template: `
    <div class="flex flex-col items-center justify-center text-center space-y-4 mb-12">
      <div class="bg-white/95 rounded-2xl px-4 py-3 shadow-xl border border-white/30 mb-2">
        <app-brand-logo variant="compact" [link]="'/student-dashboard'" />
      </div>
      <div class="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white/20 text-white">
        <span class="material-symbols-outlined" style="font-size:52px">sports_esports</span>
      </div>
      <h1 class="text-6xl font-black text-white drop-shadow-lg tracking-tight">BrainRush</h1>
      <p class="text-xl text-white/90 font-medium max-w-md">Adaptive AI Quiz Game — Learn While You Play!</p>
      <div class="pt-4">
        <button routerLink="/brainrush/dashboard" 
          class="px-6 py-2 bg-yellow-400 hover:bg-yellow-300 text-yellow-950 rounded-full font-black text-sm uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">insights</span>
          View Solo Stats
        </button>
      </div>
    </div>
  `
})
export class LobbyHeaderComponent { }

// ─── MODE SELECTOR ─────────────────────────────────────────────────────────
@Component({
  selector: 'app-mode-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto mb-8">
      <!-- Solo Card -->
      <button (click)="select('solo')"
        [class.ring-4]="activeMode === 'solo'"
        [class.ring-blue-500]="activeMode === 'solo'"
        [class.scale-105]="activeMode === 'solo'"
        [class.shadow-2xl]="activeMode === 'solo'"
        class="bg-white rounded-xl p-8 transition-all duration-300 flex items-center gap-6 text-left shadow-lg hover:shadow-xl hover:-translate-y-1 group">
        <div class="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-4xl shrink-0 group-hover:scale-110 transition-transform">⚡</div>
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-1">Solo Practice</h2>
          <p class="text-gray-500 font-medium">AI adaptive questions to master any topic.</p>
        </div>
      </button>

      <!-- Team Card -->
      <button (click)="select('team')"
        [class.ring-4]="activeMode === 'team'"
        [class.ring-cyan-400]="activeMode === 'team'"
        [class.scale-105]="activeMode === 'team'"
        [class.shadow-2xl]="activeMode === 'team'"
        class="bg-white rounded-xl p-8 transition-all duration-300 flex items-center gap-6 text-left shadow-lg hover:shadow-xl hover:-translate-y-1 group">
        <div class="w-16 h-16 rounded-full bg-cyan-50 flex items-center justify-center text-4xl shrink-0 group-hover:scale-110 transition-transform">👥</div>
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-1">Team Battle</h2>
          <p class="text-gray-500 font-medium">Multiplayer quiz to challenge your friends.</p>
        </div>
      </button>
    </div>
  `
})
export class ModeSelectorComponent {
  @Input() activeMode!: 'solo' | 'team' | null;
  @Output() modeSelected = new EventEmitter<'solo' | 'team'>();
  select(mode: 'solo' | 'team') { this.modeSelected.emit(mode); }
}

// ─── SOLO CONFIG ───────────────────────────────────────────────────────────
@Component({
  selector: 'app-solo-config',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-in-up { animation: fadeInUp 0.35s ease-out forwards; }
  `],
  template: `
    <div class="bg-white/95 backdrop-blur-xl rounded-2xl p-8 shadow-2xl w-full max-w-5xl mx-auto mb-12 fade-in-up">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">

        <!-- LEFT: Difficulty -->
        <div>
          <h3 class="text-lg font-extrabold text-gray-800 mb-5 flex items-center gap-2">
            <span class="material-symbols-outlined text-blue-600">speed</span> Difficulty
          </h3>
          <div class="flex flex-col gap-3">
            <button *ngFor="let d of difficulties"
              (click)="selectedDifficulty = d.value"
              [class.bg-blue-600]="selectedDifficulty === d.value"
              [class.text-white]="selectedDifficulty === d.value"
              [class.scale-105]="selectedDifficulty === d.value"
              [class.shadow-lg]="selectedDifficulty === d.value"
              [class.bg-gray-50]="selectedDifficulty !== d.value"
              [class.text-gray-700]="selectedDifficulty !== d.value"
              class="w-full py-4 px-5 rounded-xl font-bold text-base transition-all duration-200 text-left flex justify-between items-center border border-gray-100 hover:bg-blue-50">
              {{ d.label }}
              <span *ngIf="d.value === 'adaptive'"
                class="text-[10px] uppercase font-black bg-amber-400 text-amber-900 px-2 py-1 rounded">
                AI Recommended
              </span>
            </button>
          </div>

          <!-- Question Count -->
          <div class="mt-8">
            <h3 class="text-lg font-extrabold text-gray-800 mb-5 flex items-center gap-2">
              <span class="material-symbols-outlined text-blue-600">quiz</span> Quiz Length
            </h3>
            <div class="flex gap-3">
              <button *ngFor="let count of [10, 15, 20]"
                (click)="selectedCount = count"
                [class.bg-blue-600]="selectedCount === count"
                [class.text-white]="selectedCount === count"
                [class.border-blue-600]="selectedCount === count"
                [class.bg-white]="selectedCount !== count"
                [class.text-gray-700]="selectedCount !== count"
                [class.border-gray-200]="selectedCount !== count"
                class="flex-1 py-3 rounded-xl font-bold border-2 transition-all">
                {{ count }} Qs
              </button>
            </div>
          </div>
        </div>

        <!-- RIGHT: Topic Selection -->
        <div class="lg:col-span-2">
          <h3 class="text-lg font-extrabold text-gray-800 mb-5 flex items-center gap-2">
            <span class="material-symbols-outlined text-blue-600">category</span> Topic Selection
          </h3>
          
          <div *ngIf="loadingTopics" class="flex flex-col items-center justify-center py-10 gap-3 border-2 border-dashed border-gray-100 rounded-2xl">
            <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-sm font-bold text-gray-400">AI is scanning your courses...</p>
          </div>

          <div *ngIf="!loadingTopics" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button *ngFor="let t of topics"
              (click)="selectedTopic = t.value"
              [class.bg-blue-600]="selectedTopic === t.value"
              [class.text-white]="selectedTopic === t.value"
              [class.scale-[1.03]]="selectedTopic === t.value"
              [class.shadow-lg]="selectedTopic === t.value"
              [class.bg-gray-50]="selectedTopic !== t.value"
              [class.text-gray-700]="selectedTopic !== t.value"
              class="p-4 rounded-xl transition-all duration-200 text-left flex justify-between items-start border border-gray-100 hover:bg-blue-50">
              <span class="font-bold text-base">{{ t.label }}</span>
              <span *ngIf="t.recommended"
                class="bg-green-100 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ml-2">
                Recommended
              </span>
            </button>
          </div>

          <button (click)="onStart()"
            class="mt-8 w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xl font-black uppercase tracking-wider transition-all shadow-xl flex items-center justify-center gap-3">
            <span class="material-symbols-outlined text-3xl">play_circle</span> Start Solo Game
          </button>
        </div>

      </div>
    </div>
  `
})
export class SoloConfigComponent implements OnInit {
  @Output() start = new EventEmitter<{ topic: string; difficulty: string; totalQuestions: number }>();

  selectedDifficulty = 'medium';
  selectedTopic = '';
  selectedCount = 10;
  loadingTopics = true;

  difficulties = [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
    { label: 'Adaptive', value: 'adaptive' }
  ];

  topics: any[] = [];

  constructor(private service: BrainrushService) { }

  ngOnInit() {
    this.loadTopics();
  }

  loadTopics() {
    this.loadingTopics = true;
    this.service.getSubjects().subscribe({
      next: (res: any) => {
        const subjects: string[] = res.subjects || [];
        if (subjects.length > 0) {
          this.topics = subjects.map((s: string, i: number) => ({
            label: s,
            value: s,
            recommended: i === 0
          }));
          this.selectedTopic = this.topics[0].value;
          this.loadingTopics = false;
        } else {
          this.useFallbackTopics();
        }
      },
      error: () => this.useFallbackTopics()
    });
  }

  useFallbackTopics() {
    this.topics = [
      { label: 'Programmation Procédurale 1', value: 'Programmation Procédurale 1', recommended: true }
    ];
    this.selectedTopic = this.topics[0].value;
    this.loadingTopics = false;
  }

  onStart() {
    if (this.selectedTopic) {
      this.start.emit({
        topic: this.selectedTopic,
        difficulty: this.selectedDifficulty,
        totalQuestions: this.selectedCount
      });
    }
  }
}

// ─── TEAM CONFIG ───────────────────────────────────────────────────────────
@Component({
  selector: 'app-team-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-in-up { animation: fadeInUp 0.35s ease-out forwards; }
    .spinner { animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
  template: `
    <div class="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-5xl mx-auto mb-12 fade-in-up overflow-hidden">
      <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">

        <!-- CREATE ROOM -->
        <div class="p-10 space-y-5">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-2xl">🏆</div>
            <div>
              <h3 class="text-xl font-black text-gray-800">Create Room</h3>
              <p class="text-sm text-gray-500">Host a multiplayer battle</p>
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Your Username</label>
            <input [(ngModel)]="createUsername" maxlength="20" type="text" (focus)="playClick()" placeholder="Enter your name"
              class="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-cyan-400 transition-all">
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Choose Avatar</label>
            <div class="flex flex-wrap gap-2">
              <button *ngFor="let av of avatars"
                (click)="selectedAvatar = av; playClick()"
                [class.ring-4]="selectedAvatar === av"
                [class.ring-cyan-400]="selectedAvatar === av"
                [class.bg-white]="selectedAvatar === av"
                class="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-xl hover:bg-gray-200 transition-all shadow-sm">
                {{ av }}
              </button>
            </div>
          </div>
          <div class="relative">
            <label class="block text-sm font-bold text-gray-700 mb-2">Topic</label>
            <div *ngIf="loadingTopics" class="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div class="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <span class="text-xs font-bold text-gray-400 italic">Scanning courses...</span>
            </div>
            <select *ngIf="!loadingTopics" [(ngModel)]="createTopic"
              class="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-cyan-400">
              <optgroup label="AI Recommended">
                <option *ngFor="let t of topics" [value]="t.value">{{ t.label }}</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Difficulty</label>
            <select [(ngModel)]="createDifficulty"
              class="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-cyan-400">
              <option value="medium">Medium</option>
              <option value="easy">Easy</option>
              <option value="hard">Hard</option>
              <option value="adaptive">Adaptive (AI)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Quiz Length</label>
            <select [(ngModel)]="createCount"
              class="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-cyan-400">
              <option [ngValue]="10">10 Questions</option>
              <option [ngValue]="15">15 Questions</option>
              <option [ngValue]="20">20 Questions</option>
            </select>
          </div>

          <!-- Error -->
          <p *ngIf="createError" class="text-red-500 text-sm font-semibold">{{ createError }}</p>

          <button id="generate-room-code-btn"
            [disabled]="!createUsername.trim() || creating || loadingTopics"
            (click)="onCreate()"
            class="w-full py-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2">
            <svg *ngIf="creating" class="spinner w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="white" stroke-width="4" stroke-dasharray="31 31" stroke-linecap="round"/>
            </svg>
            <span *ngIf="!creating">Generate Room Code</span>
            <span *ngIf="creating">Creating…</span>
            <span *ngIf="!creating" class="material-symbols-outlined">magic_button</span>
          </button>
        </div>

        <!-- JOIN ROOM -->
        <div class="p-10 space-y-5 bg-gray-50/50">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-2xl">👥</div>
            <div>
              <h3 class="text-xl font-black text-gray-800">Join Room</h3>
              <p class="text-sm text-gray-500">Enter a code to join</p>
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Your Username</label>
            <input [(ngModel)]="joinUsername" maxlength="20" type="text" (focus)="playClick()" placeholder="Enter your name"
              class="w-full bg-white border border-gray-200 text-gray-800 rounded-xl px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Choose Avatar</label>
            <div class="flex flex-wrap gap-2">
              <button *ngFor="let av of avatars"
                (click)="selectedAvatar = av; playClick()"
                [class.ring-4]="selectedAvatar === av"
                [class.ring-blue-500]="selectedAvatar === av"
                [class.bg-gray-50]="selectedAvatar === av"
                class="w-10 h-10 flex items-center justify-center rounded-lg bg-white text-xl hover:bg-gray-100 transition-all shadow-sm border border-gray-100">
                {{ av }}
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Room Code</label>
            <input [(ngModel)]="roomCode" maxlength="6" type="text" placeholder="XXXXXX"
              (input)="roomCode = roomCode.toUpperCase()"
              class="w-full bg-white border-2 border-gray-200 text-gray-800 rounded-xl px-4 py-4 font-black uppercase text-center text-3xl tracking-widest outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-gray-300">
          </div>

          <!-- Error -->
          <p *ngIf="joinError" class="text-red-500 text-sm font-semibold">{{ joinError }}</p>

          <button id="join-battle-btn"
            [disabled]="roomCode.length !== 6 || !joinUsername.trim() || joining"
            (click)="onJoin()"
            class="w-full py-4 bg-blue-600 disabled:bg-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2">
            <svg *ngIf="joining" class="spinner w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="white" stroke-width="4" stroke-dasharray="31 31" stroke-linecap="round"/>
            </svg>
            <span *ngIf="!joining">Join Battle</span>
            <span *ngIf="joining">Joining…</span>
            <span *ngIf="!joining" class="material-symbols-outlined">login</span>
          </button>
        </div>

      </div>
    </div>
  `
})
export class TeamConfigComponent implements OnInit, OnDestroy {
  @Output() create = new EventEmitter<{ username: string; avatar: string; topic: string; difficulty: string; totalQuestions: number }>();
  @Output() join = new EventEmitter<{ roomCode: string; username: string; avatar: string }>();

  avatars = ['🎮', '🚀', '🧠', '⚡', '🦉', '🦊', '🐼', '🐱', '🐶', '👻', '👾', '🔥'];
  selectedAvatar = '🎮';

  topics: any[] = [];
  loadingTopics = true;

  constructor(private audio: AudioService, private service: BrainrushService) { }

  ngOnInit() {
    this.loadTopics();
  }

  loadTopics() {
    this.loadingTopics = true;
    this.service.getSubjects().subscribe({
      next: (res: any) => {
        const subjects: string[] = res.subjects || [];
        if (subjects.length > 0) {
          this.topics = subjects.map((s: string, i: number) => ({
            label: s,
            value: s,
            recommended: i === 0
          }));
          this.createTopic = this.topics[0].value;
          this.loadingTopics = false;
        } else {
          this.useFallbackTopics();
        }
      },
      error: () => this.useFallbackTopics()
    });
  }

  useFallbackTopics() {
    this.topics = [
      { label: 'Programmation Procédurale 1', value: 'Programmation Procédurale 1', recommended: true }
    ];
    this.createTopic = this.topics[0].value;
    this.loadingTopics = false;
  }

  playClick() { this.audio.playSFX('click'); }


  // Create fields
  createUsername = '';
  createTopic = '';
  createDifficulty = 'medium';
  createCount = 10;
  creating = false;
  createError = '';

  // Join fields
  joinUsername = '';
  roomCode = '';
  joining = false;
  joinError = '';

  onCreate() {
    if (!this.createUsername.trim()) {
      this.createError = 'Please enter your username';
      return;
    }
    this.createError = '';
    this.audio.playSFX('click');
    this.create.emit({
      username: this.createUsername.trim(),
      avatar: this.selectedAvatar,
      topic: this.createTopic,
      difficulty: this.createDifficulty,
      totalQuestions: this.createCount,
    });
  }

  onJoin() {
    if (!this.joinUsername.trim()) {
      this.joinError = 'Please enter your username';
      return;
    }
    if (this.roomCode.length !== 6) {
      this.joinError = 'Enter a valid 6-character room code';
      return;
    }
    this.audio.playSFX('click');
    this.join.emit({
      roomCode: this.roomCode,
      username: this.joinUsername.trim(),
      avatar: this.selectedAvatar
    });
  }

  /** Reset loading states (called from parent on error) */
  resetLoading() {
    this.creating = false;
    this.joining = false;
  }

  ngOnDestroy() { }
}

// ─── LOBBY (main) ─────────────────────────────────────────────────────────
@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    LobbyHeaderComponent,
    ModeSelectorComponent,
    SoloConfigComponent,
    TeamConfigComponent
  ],
  styles: [`
    .error-toast {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      z-index: 999; padding: 12px 24px;
      background: rgba(239,68,68,0.9); color: white; font-weight: 700;
      border-radius: 14px; border: 1px solid rgba(248,113,113,0.5);
      backdrop-filter: blur(8px);
      animation: fadeInDown 0.3s ease-out;
    }
    @keyframes fadeInDown {
      from { opacity:0; transform: translateX(-50%) translateY(-12px); }
      to   { opacity:1; transform: translateX(-50%) translateY(0); }
    }
  `],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-purple-900 via-pink-700 to-orange-500 p-6 flex flex-col items-center pt-16">

      <div *ngIf="errorMsg" class="error-toast">⚠️ {{ errorMsg }}</div>

      <div class="fixed top-5 right-5 flex gap-2 z-50">
        <button (click)="audio.toggleMusic()" class="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white text-xl">
          {{ audio.isMusicEnabled ? '🎶' : '🔇' }}
        </button>
      </div>

      <app-lobby-header></app-lobby-header>

      <app-mode-selector
        [activeMode]="selectedMode"
        (modeSelected)="selectedMode = $event">
      </app-mode-selector>

      <app-solo-config
        *ngIf="selectedMode === 'solo'"
        (start)="startSolo($event)">
      </app-solo-config>

      <app-team-config
        #teamConfig
        *ngIf="selectedMode === 'team'"
        (create)="createTeam($event)"
        (join)="joinTeam($event)">
      </app-team-config>

      <button routerLink="/student-dashboard"
        class="mt-8 mb-12 px-6 py-3 text-white/70 hover:text-white font-bold flex items-center gap-2 hover:bg-white/10 rounded-full transition-all">
        <span class="material-symbols-outlined">arrow_back</span> Back to Dashboard
      </button>

    </div>
  `
})
export class LobbyComponent implements OnDestroy {
  selectedMode: 'solo' | 'team' | null = null;
  errorMsg = '';

  private subs: Subscription[] = [];

  constructor(
    private service: BrainrushService,
    private socketService: SocketService,
    private router: Router,
    public audio: AudioService
  ) { }

  ngOnInit() {
    this.audio.startMusic('lobby');
  }


  // ── Solo mode ────────────────────────────────────────────────────────────

  startSolo(config?: { topic: string; difficulty: string; totalQuestions: number }) {
    const topic = config?.topic || 'data_structures';
    const difficulty = config?.difficulty || 'medium';
    const totalQuestions = config?.totalQuestions || 10;
    this.service.createRoom('solo', topic, difficulty, totalQuestions).subscribe({
      next: (res: any) => {
        this.router.navigate(
          ['/brainrush/game', res._id, 'solo'],
          { state: { topic, difficulty, totalQuestions } }
        );
      },
      error: () => {
        this.router.navigate(
          ['/brainrush/game', 'demo', 'solo'],
          { state: { topic, difficulty, totalQuestions } }
        );
      }
    });
  }

  // ── Team mode ────────────────────────────────────────────────────────────

  createTeam(payload: { username: string; avatar: string; topic: string; difficulty: string; totalQuestions: number }) {

    // Connect socket (no auth token required at this level)
    this.socketService.connect();

    // Listen for room created confirmation
    const sub = this.socketService.onRoomCreated().subscribe({
      next: ({ roomCode, room }) => {
        sub.unsubscribe();
        this.router.navigate(
          ['/brainrush/waiting-room'],
          {
            state: {
              roomCode,
              players: room.players,
              isHost: true,
              username: payload.username,
              avatar: payload.avatar,
              topic: payload.topic,
              difficulty: payload.difficulty,
              totalQuestions: room.totalQuestions,
            }
          }
        );
      }
    });

    // Listen for errors
    const errSub = this.socketService.onRoomError().subscribe(({ message }) => {
      errSub.unsubscribe();
      this.showError(message);
    });

    this.subs.push(sub, errSub);
    this.socketService.createRoom(payload.username, payload.avatar, undefined, payload.totalQuestions);
  }

  joinTeam(payload: { roomCode: string; username: string, avatar: string }) {

    this.socketService.connect();

    // Listen for room joined confirmation
    const sub = this.socketService.onRoomJoined().subscribe({
      next: ({ roomCode, room }) => {
        sub.unsubscribe();
        this.router.navigate(
          ['/brainrush/waiting-room'],
          {
            state: {
              roomCode,
              players: room.players,
              isHost: false,
              username: payload.username,
              avatar: payload.avatar,
              totalQuestions: room.totalQuestions,
            }

          }
        );
      }
    });

    // Listen for errors
    const errSub = this.socketService.onRoomError().subscribe(({ message }) => {
      errSub.unsubscribe();
      this.showError(message);
    });

    this.subs.push(sub, errSub);
    this.socketService.joinRoom(payload.roomCode, payload.username, payload.avatar);
  }

  private showError(msg: string) {
    this.errorMsg = msg;
    setTimeout(() => (this.errorMsg = ''), 4000);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.audio.stopMusic();
  }
}
