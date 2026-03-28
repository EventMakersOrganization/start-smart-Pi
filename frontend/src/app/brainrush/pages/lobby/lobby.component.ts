import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BrainrushService } from '../../services/brainrush.service';

// ─── LOBBY HEADER ──────────────────────────────────────────────────────────
@Component({
  selector: 'app-lobby-header',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center text-center space-y-4 mb-12">
      <div class="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white/20 text-white">
        <span class="material-symbols-outlined" style="font-size:52px">sports_esports</span>
      </div>
      <h1 class="text-6xl font-black text-white drop-shadow-lg tracking-tight">BrainRush</h1>
      <p class="text-xl text-white/90 font-medium max-w-md">Adaptive AI Quiz Game — Learn While You Play!</p>
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
  @Output() start = new EventEmitter<{ topic: string; difficulty: string }>();

  selectedDifficulty = 'medium';
  selectedTopic = '';
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
    // We use a generic subject 'General' to fetch all available topics from RAG
    this.service.getAiTopics('Programming').subscribe({
      next: (res: any) => {
        if (res.topics && res.topics.length > 0) {
          this.topics = res.topics.map((t: string) => ({
            label: t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: t,
            recommended: Math.random() > 0.7
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
      { label: 'Data Structures', value: 'data_structures', recommended: true },
      { label: 'Algorithms', value: 'algorithms', recommended: false },
      { label: 'OOP', value: 'oop', recommended: true },
      { label: 'Web Dev', value: 'web_dev', recommended: false }
    ];
    this.selectedTopic = 'data_structures';
    this.loadingTopics = false;
  }

  onStart() {
    if (this.selectedTopic) {
      this.start.emit({ topic: this.selectedTopic, difficulty: this.selectedDifficulty });
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
  `],
  template: `
    <div class="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-5xl mx-auto mb-12 fade-in-up overflow-hidden">
      <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">

        <!-- CREATE ROOM -->
        <div class="p-10 space-y-6">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-2xl">🏆</div>
            <div>
              <h3 class="text-xl font-black text-gray-800">Create Room</h3>
              <p class="text-sm text-gray-500">Host a multiplayer battle</p>
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Topic</label>
            <select class="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-cyan-400">
              <option>Data Structures</option>
              <option>Algorithms</option>
              <option>OOP</option>
              <option>Web Development</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Difficulty</label>
            <select class="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-cyan-400">
              <option>Medium</option>
              <option>Hard</option>
              <option>Adaptive (AI)</option>
            </select>
          </div>
          <button (click)="create.emit()"
            class="w-full py-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:opacity-90 text-white rounded-xl text-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2">
            Generate Room Code <span class="material-symbols-outlined">magic_button</span>
          </button>
        </div>

        <!-- JOIN ROOM -->
        <div class="p-10 space-y-6 bg-gray-50/50">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-2xl">👥</div>
            <div>
              <h3 class="text-xl font-black text-gray-800">Join Room</h3>
              <p class="text-sm text-gray-500">Enter a code to join</p>
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Room Code</label>
            <input [(ngModel)]="roomCode" maxlength="6" type="text" placeholder="XXXXXX"
              class="w-full bg-white border-2 border-gray-200 text-gray-800 rounded-xl px-4 py-4 font-black uppercase text-center text-3xl tracking-widest outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-gray-300">
          </div>
          <button [disabled]="roomCode.length !== 6" (click)="join.emit(roomCode)"
            class="w-full py-4 bg-blue-600 disabled:bg-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2">
            Join Battle <span class="material-symbols-outlined">login</span>
          </button>
          <div class="pt-4 border-t border-gray-200">
            <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recent Rooms</p>
            <div class="flex flex-wrap gap-2">
              <button (click)="roomCode = 'A91F2B'"
                class="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors">A91F2B</button>
              <button (click)="roomCode = 'X82C0M'"
                class="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors">X82C0M</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class TeamConfigComponent {
  @Output() create = new EventEmitter<void>();
  @Output() join = new EventEmitter<string>();
  roomCode = '';
}

// ─── LOBBY (main) ─────────────────────────────────────────────────────────
@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LobbyHeaderComponent,
    ModeSelectorComponent,
    SoloConfigComponent,
    TeamConfigComponent
  ],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-purple-900 via-pink-700 to-orange-500 p-6 flex flex-col items-center pt-16">

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
        *ngIf="selectedMode === 'team'"
        (create)="createTeam()"
        (join)="joinTeam($event)">
      </app-team-config>

      <button routerLink="/student-dashboard"
        class="mt-8 mb-12 px-6 py-3 text-white/70 hover:text-white font-bold flex items-center gap-2 hover:bg-white/10 rounded-full transition-all">
        <span class="material-symbols-outlined">arrow_back</span> Back to Dashboard
      </button>

    </div>
  `
})
export class LobbyComponent {
  selectedMode: 'solo' | 'team' | null = null;

  constructor(private service: BrainrushService, private router: Router) { }

  startSolo(config?: { topic: string; difficulty: string }) {
    const topic = config?.topic || 'data_structures';
    const difficulty = config?.difficulty || 'medium';
    this.service.createRoom('solo').subscribe({
      next: (res: any) => {
        this.router.navigate(
          ['/brainrush/game', res._id, 'solo'],
          { state: { topic, difficulty } }
        );
      },
      error: () => {
        // Fallback to demo mode: pass topic+difficulty via router state
        this.router.navigate(
          ['/brainrush/game', 'demo', 'solo'],
          { state: { topic, difficulty } }
        );
      }
    });
  }

  createTeam() {
    this.service.createRoom('multiplayer').subscribe({
      next: (res: any) => {
        this.router.navigate(['/brainrush/game', res._id, res.roomCode]);
      },
      error: () => {
        this.router.navigate(['/brainrush/game', 'demo', 'multiplayer']);
      }
    });
  }

  joinTeam(code: string) {
    if (code.length === 6) {
      this.service.joinRoom(code).subscribe({
        next: (res: any) => {
          this.router.navigate(['/brainrush/game', res._id, res.roomCode]);
        },
        error: () => {
          this.router.navigate(['/brainrush/game', 'demo', code]);
        }
      });
    }
  }
}
