import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { CodebattleSocketService } from '../services/codebattle-socket.service';
import { CodebattleService } from '../services/codebattle.service';

@Component({
  selector: 'app-battle-lobby',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-900 text-white overflow-hidden relative font-sans flex flex-col items-center justify-center">
      <!-- Background Blurs -->
      <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-[40%] h-[40%] bg-blue-600/10 blur-[150px] animate-pulse"></div>
        <div class="absolute bottom-1/4 right-1/4 w-[40%] h-[40%] bg-purple-600/10 blur-[150px] animate-pulse" style="animation-delay: 2s"></div>
      </div>

      <div class="w-full max-w-4xl relative z-10 px-6">
        <!-- Header: Room Code -->
        <div class="bg-slate-800/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-12 mb-8 text-center shadow-2xl animate-in zoom-in-95 duration-700">
          <span class="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 block">BATTLE STATION INITIALIZED</span>
          <h1 class="text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-blue-400 uppercase">
            #{{ roomCode }}
          </h1>
          
          <div class="flex items-center justify-center gap-4 mb-8">
             <div class="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-2">
                <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest">{{ config.language }} 💻</span>
             </div>
             <div class="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center gap-2">
                <span class="text-[10px] font-black text-purple-400 uppercase tracking-widest">{{ config.difficulty }} ⚖️</span>
             </div>
             <div class="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{{ config.count }} TASKS ⚡</span>
             </div>
          </div>

          <div class="flex items-center justify-center gap-4">
             <div class="h-[1px] w-12 bg-white/10"></div>
             <p class="text-slate-400 font-mono text-sm uppercase tracking-widest">TRANSMIT CODE TO RIVALS</p>
             <div class="h-[1px] w-12 bg-white/10"></div>
          </div>
        </div>

        <!-- Players List -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
           <div 
             *ngFor="let player of players; let i = index"
             class="bg-slate-800/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex items-center justify-between group hover:border-blue-500/50 transition-all duration-300 animate-in slide-in-from-bottom-8"
             [style.animation-delay]="i * 100 + 'ms'"
           >
              <div class="flex items-center gap-6">
                <div class="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center text-2xl font-black border border-white/10 group-hover:scale-110 transition-transform">
                   {{ player.username.charAt(0) }}
                </div>
                <div>
                   <h4 class="text-lg font-bold text-white">{{ player.username }}</h4>
                   <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                     <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                     CONNECTED
                   </span>
                </div>
              </div>
              
              <div *ngIf="i === 0" class="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                 <span class="text-[8px] font-black text-blue-400 uppercase tracking-widest">HOST</span>
              </div>
           </div>

           <!-- Empty Slots -->
           <div 
             *ngFor="let slot of [].constructor(Math.max(0, 4 - players.length))"
             class="bg-slate-800/20 border border-dashed border-white/5 rounded-2xl p-6 flex items-center justify-center opacity-30"
           >
              <span class="text-[10px] font-black tracking-widest uppercase text-slate-500 font-mono">AWAITING CONNECTION...</span>
           </div>
        </div>

        <!-- Start Game Button -->
        <div class="flex flex-col items-center gap-6">
           <button 
             *ngIf="isHost"
             [disabled]="players.length < 2"
             (click)="startGame()"
             class="w-full max-w-md py-6 rounded-2xl text-lg font-black bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-30 disabled:hover:scale-100 transition-all transform hover:scale-[1.02] active:scale-95 shadow-[0_15px_50px_rgba(59,130,246,0.3)] group flex items-center justify-center gap-4"
           >
             {{ players.length < 2 ? 'WAITING FOR RIVALS...' : 'INITIATE MULTIPLAYER BATTLE' }}
             <span *ngIf="players.length >= 2" class="text-2xl group-hover:translate-x-3 transition-transform">⚔️</span>
           </button>
           
           <div *ngIf="!isHost" class="flex flex-col items-center gap-3 animate-pulse">
              <span class="text-xs font-black text-blue-400 uppercase tracking-[0.3em]">SYNCHRONIZING WITH HOST</span>
              <p class="text-slate-500 text-[10px] uppercase font-bold tracking-widest">The battle will begin once the signal is transmitted</p>
           </div>

           <button 
             (click)="leaveRoom()"
             class="text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2"
           >
             ← ABORT MISSION
           </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { font-family: 'Inter', sans-serif; }
  `]
})
export class BattleLobbyComponent implements OnInit, OnDestroy {
  roomCode: string = '';
  isHost: boolean = false;
  players: any[] = [];
  config: any = { language: '', difficulty: '', count: 0 };
  username: string = '';
  Math = Math;

  private subs: any[] = [];

  constructor(
    private router: Router,
    private codebattleService: CodebattleService,
    private socketService: CodebattleSocketService
  ) { }

  ngOnInit() {
    // Recover state (BrainRush style)
    const state = history.state;
    this.roomCode = state?.roomCode || '';
    this.isHost = state?.isHost || false;
    this.players = state?.players || [];
    this.config = state?.config || { language: 'js', difficulty: 'Medium', count: 10 };
    this.username = state?.username || '';

    if (!this.roomCode) {
      this.router.navigate(['/codebattle/lobby']);
      return;
    }

    // Sync room updates
    const roomSub = this.socketService.room$.subscribe(room => {
      if (room) {
        this.players = room.players;
      }
    });

    const startSub = this.socketService.gameStarted$.subscribe(data => {
      if (data) {
        this.codebattleService.setMode('multiplayer');
        const mockSession: any = {
          sessionId: this.roomCode,
          problems: data.problems,
          currentProblemIndex: 0,
          totalProblems: data.totalProblems,
          score: 0
        };
        this.codebattleService.setSession(mockSession);
        this.router.navigate(['/codebattle/game'], {
          queryParams: { multi: true, lang: data.language || this.config.language || 'javascript' }
        });
      }
    });

    this.subs.push(roomSub, startSub);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  startGame() {
    this.socketService.startGame(this.roomCode);
  }

  leaveRoom() {
    this.socketService.disconnect();
    this.router.navigate(['/codebattle/lobby']);
  }
}
