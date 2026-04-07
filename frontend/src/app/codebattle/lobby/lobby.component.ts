import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs/operators';
import { CodebattleService } from '../services/codebattle.service';
import { CodebattleSocketService } from '../services/codebattle-socket.service';

@Component({
  selector: 'app-lobby-header',
  standalone: true,
  template: `
    <div class="text-center mb-12 animate-in fade-in slide-in-from-top-8 duration-1000">
      <div class="flex items-center justify-center gap-6 mb-6">
        <div class="p-4 bg-slate-800/80 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl shadow-blue-500/10">
          <span class="text-5xl">⚡</span>
        </div>
        <h1 class="text-7xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-cyan-400 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          CODE BATTLE
        </h1>
      </div>
      <p class="text-cyan-200/80 text-xl tracking-[0.2em] uppercase font-bold">CYBERNETIC ALGORITHMIC ARENA</p>
    </div>
  `
})
export class LobbyHeaderComponent { }

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LobbyHeaderComponent],
  template: `
    <div class="min-h-screen bg-slate-900 text-white overflow-y-auto relative font-sans pb-20">
      <!-- Background Effects -->
      <div class="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-950/30 to-cyan-950/20 pointer-events-none"></div>
      <div class="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div class="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] animate-pulse" style="animation-delay: 2s"></div>

      <div class="container mx-auto px-4 pt-16 relative z-10 flex flex-col items-center">
        
        <app-lobby-header></app-lobby-header>

        <!-- MODE SELECTOR -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl mb-12">
          <button (click)="selectedMode = 'solo'"
            [ngClass]="{
              'ring-4 ring-blue-500 bg-slate-800': selectedMode === 'solo',
              'bg-slate-800/40': selectedMode !== 'solo'
            }"
            class="group p-8 rounded-2xl border border-white/10 backdrop-blur-md transition-all duration-300 text-left relative overflow-hidden flex items-center gap-6">
            <div class="text-5xl group-hover:scale-110 transition-transform">💻</div>
            <div>
              <h2 class="text-2xl font-black mb-1">SOLO MISSION</h2>
              <p class="text-slate-400 text-sm">Adaptive AI practice against the clock.</p>
            </div>
          </button>

          <button (click)="selectedMode = 'multiplayer'"
            [ngClass]="{
              'ring-4 ring-purple-500 bg-slate-800': selectedMode === 'multiplayer',
              'bg-slate-800/40': selectedMode !== 'multiplayer'
            }"
            class="group p-8 rounded-2xl border border-white/10 backdrop-blur-md transition-all duration-300 text-left relative overflow-hidden flex items-center gap-6">
            <div class="text-5xl group-hover:scale-110 transition-transform">⚔️</div>
            <div>
              <h2 class="text-2xl font-black mb-1">BATTLE ROYALE</h2>
              <p class="text-slate-400 text-sm">Global real-time competitive arena.</p>
            </div>
          </button>
        </div>

        <!-- CONFIGURATION PANELS -->
        <div *ngIf="selectedMode" class="w-full max-w-5xl animate-in zoom-in-95 duration-500">
          <div class="bg-slate-800/90 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden">
            
            <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
              
              <!-- LEFT: Configuration Form -->
              <div class="p-10 space-y-10">
                <div>
                   <h3 class="text-xs font-black text-blue-400 uppercase tracking-[0.5em] mb-8 flex items-center gap-3">
                     <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                     {{ selectedMode === 'multiplayer' ? 'HOST SETTINGS (BATTLE RULES)' : 'GENERAL MISSION CONFIG' }}
                   </h3>

                   <div class="space-y-6">
                      <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Pilot Callsign (Username)</label>
                        <input [(ngModel)]="username" type="text" maxlength="20" placeholder="ENTER CALLSIGN"
                          class="w-full bg-slate-950 border border-white/10 rounded-xl py-4 px-6 font-bold outline-none focus:border-blue-500 transition-all placeholder:text-slate-700 uppercase tracking-widest">
                      </div>

                      <div class="grid grid-cols-2 gap-6">
                         <div>
                           <label class="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Difficulty</label>
                           <select [(ngModel)]="config.difficulty" class="w-full bg-slate-950 border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500 text-white font-bold appearance-none cursor-pointer">
                              <option value="Easy">Easy</option>
                              <option value="Medium">Medium</option>
                              <option value="Hard">Hard</option>
                           </select>
                         </div>
                         <div>
                           <label class="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Language</label>
                           <select [(ngModel)]="config.language" class="w-full bg-slate-950 border border-white/10 rounded-xl py-4 px-5 outline-none focus:border-blue-500 text-white font-bold appearance-none cursor-pointer">
                              <option value="javascript">JavaScript 🟨</option>
                              <option value="python">Python 🐍</option>
                              <option value="java">Java ☕</option>
                              <option value="cpp">C++ ⚙️</option>
                           </select>
                         </div>
                      </div>

                      <div>
                         <label class="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Mission Intensity (Problem Count)</label>
                         <div class="flex gap-2">
                            <button *ngFor="let c of [5, 10, 15]" (click)="config.count = c"
                              [class.bg-blue-600]="config.count === c"
                              [class.border-blue-500]="config.count === c"
                              [class.bg-slate-950]="config.count !== c"
                              class="flex-1 py-4 border border-white/10 rounded-xl font-bold transition-all hover:bg-slate-700">
                              {{ c }}
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
              </div>

              <!-- RIGHT: Mode Specific Action -->
              <div class="p-10 flex flex-col justify-center bg-slate-950/20">
                
                <!-- Solo Action -->
                <div *ngIf="selectedMode === 'solo'" class="space-y-8 text-center py-10">
                   <div class="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                      <span class="text-4xl">🚀</span>
                   </div>
                   <div>
                     <h4 class="text-2xl font-black mb-2 uppercase tracking-tighter">Ready for Launch</h4>
                     <p class="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">Engage in immediate combat against optimized algorithmic challenges.</p>
                   </div>
                   <button (click)="initiateSoloBattle()" 
                     [disabled]="!username.trim()"
                     class="w-full py-6 rounded-2xl text-lg font-black bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 transition-all transform hover:scale-[1.02] active:scale-95 shadow-[0_10px_30px_rgba(59,130,246,0.3)] disabled:opacity-30 uppercase tracking-widest">
                     Initiate Solo Mission
                   </button>
                </div>

                <!-- Multiplayer Action -->
                <div *ngIf="selectedMode === 'multiplayer'" class="space-y-8">
                   <div class="space-y-6">
                      <div class="flex items-center gap-4">
                         <div class="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-xl shadow-lg border border-purple-500/20">⚔️</div>
                         <h4 class="text-xl font-black uppercase tracking-widest">Multiplayer Control</h4>
                      </div>

                      <div class="space-y-4">
                         <button (click)="createRoom()"
                           [disabled]="!username.trim()"
                           class="w-full py-5 bg-slate-900 border border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/10 rounded-2xl text-white font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-30 group">
                           <span class="material-symbols-outlined group-hover:rotate-180 transition-transform">autorenew</span>
                           Generate Room Code
                         </button>

                         <div class="relative py-4">
                            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-white/5"></div></div>
                            <div class="relative flex justify-center text-[10px] font-black uppercase tracking-[0.5em] text-slate-600"><span class="bg-slate-800 px-3">OR JOIN RIVAL</span></div>
                         </div>

                         <div class="space-y-4">
                            <input [(ngModel)]="joinCode" type="text" maxlength="6" placeholder="XXXXXX" (input)="joinCode = joinCode.toUpperCase()"
                              class="w-full bg-slate-950 border-2 border-white/5 focus:bg-slate-900 focus:border-purple-500/50 rounded-2xl py-5 px-6 font-black uppercase text-center text-3xl tracking-[0.6em] outline-none transition-all placeholder:text-slate-800">
                            
                            <button (click)="joinRoom()"
                              [disabled]="!username.trim() || joinCode.length !== 6"
                              class="w-full py-5 bg-purple-600 hover:bg-purple-500 rounded-2xl text-white font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-900/40 disabled:opacity-30">
                              Join Battle
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <button routerLink="/student-dashboard" 
          class="mt-12 text-slate-500 hover:text-white transition-colors flex items-center gap-2 font-black text-xs uppercase tracking-[0.3em]">
          <span class="text-xl">←</span> ABORT TO DASHBOARD
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { font-family: 'Inter', sans-serif; }
    
    .material-symbols-outlined {
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
    }
  `]
})
export class LobbyComponent implements OnInit, OnDestroy {
  selectedMode: 'solo' | 'multiplayer' | null = 'solo';
  username: string = 'User_' + Math.random().toString(36).substr(2, 5);
  joinCode: string = '';

  config = {
    difficulty: 'Medium',
    language: 'javascript',
    count: 10
  };

  private subs: any[] = [];

  constructor(
    private router: Router,
    private codebattleService: CodebattleService,
    private socketService: CodebattleSocketService
  ) { }

  ngOnInit() {
    this.socketService.connect();

    // Handle errors (BrainRush style)
    const errSub = this.socketService.onError().subscribe(msg => {
      if (msg) alert('SYSTEM ERROR: ' + msg);
    });
    this.subs.push(errSub);
  }

  createRoom() {
    if (!this.username.trim()) return;

    // Listen once for success (BrainRush style)
    const roomSub = this.socketService.room$.pipe(take(1)).subscribe(room => {
      if (room) {
        this.router.navigate(['/codebattle/battle-lobby'], {
          state: {
            roomCode: room.roomCode,
            players: room.players,
            isHost: true,
            username: this.username,
            config: this.config
          }
        });
      }
    });
    this.subs.push(roomSub);

    this.socketService.createRoom(this.username, this.config);
  }

  joinRoom() {
    if (!this.username.trim() || !this.joinCode.trim()) return;
    if (this.joinCode.length !== 6) return;

    const roomSub = this.socketService.room$.pipe(take(1)).subscribe(room => {
      if (room) {
        this.router.navigate(['/codebattle/battle-lobby'], {
          state: {
            roomCode: room.roomCode,
            players: room.players,
            isHost: false,
            username: this.username,
            config: {
              language: room.language,
              difficulty: room.difficulty,
              count: room.totalProblems
            }
          }
        });
      }
    });
    this.subs.push(roomSub);

    this.socketService.joinRoom(this.joinCode.toUpperCase(), this.username);
  }

  initiateSoloBattle() {
    if (!this.username.trim()) return;

    this.codebattleService.setMode('solo');
    this.codebattleService.startSolo(this.config.difficulty, this.config.count, this.username).subscribe({
      next: (res) => {
        if (res.success) {
          this.codebattleService.setSession(res.session);
          this.router.navigate(['/codebattle/game'], { queryParams: { lang: this.config.language } });
        }
      },
      error: (err) => console.error('Failed to start solo session', err)
    });
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }
}
