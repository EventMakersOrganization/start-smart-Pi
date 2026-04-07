import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Player {
  name: string;
  score: number;
  progress: number;
  status: 'typing' | 'running' | 'finished' | 'idle';
  rank: number;
}

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex items-center justify-between px-2">
        <h3 class="text-xs font-black text-slate-500 uppercase tracking-[0.4em] mb-0 flex items-center gap-3">
          LIVE STATUS
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </h3>
        <span class="text-[10px] font-black text-slate-600 uppercase">3 / 8 ACTIVE</span>
      </div>
      
      <div class="space-y-4">
        <div *ngFor="let p of players" class="bg-slate-800 rounded-2xl p-5 border border-white/5 relative overflow-hidden transition-all hover:bg-slate-750 hover:border-white/10 group shadow-lg">
           <div class="flex items-center gap-5 relative z-10">
             <!-- Rank (High contrast) -->
             <div [class]="getRankClass(p.rank)" class="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black border border-white/10 shrink-0 transition-transform group-hover:scale-110">
               {{ p.rank }}
             </div>

             <!-- Info -->
             <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-base font-bold truncate tracking-tight text-white group-hover:text-cyan-400 transition-colors">{{ p.name }}</span>
                  <span class="text-sm font-black text-white tabular-nums drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">{{ p.score | number }}</span>
                </div>
                
                <!-- Progress Trace (Higher contrast) -->
                <div class="w-full h-2 bg-slate-900 rounded-full overflow-hidden shadow-inner border border-white/5">
                  <div 
                    [style.width.%]="p.progress" 
                    [class]="getProgressColor(p)"
                    class="h-full transition-all duration-1000 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                  ></div>
                </div>
             </div>

             <!-- Status Indicator -->
             <div class="shrink-0 w-3 h-3 rounded-full relative" [class]="getStatusColor(p.status)">
                <div *ngIf="p.status === 'typing'" class="absolute -inset-1 blur-sm rounded-full bg-cyan-400/50 animate-pulse"></div>
                <div *ngIf="p.status === 'typing'" class="w-full h-full rounded-full bg-cyan-400 animate-ping opacity-75"></div>
             </div>
           </div>
           
           <!-- Meta Status (High visibility) -->
           <div class="mt-4 pt-3 border-t border-white/5 text-[10px] font-black tracking-[0.2em] uppercase pl-16 flex items-center gap-3">
              <span *ngIf="p.status === 'typing'" class="text-cyan-400 animate-pulse">TRANSMITTING...</span>
              <span *ngIf="p.status === 'running'" class="text-yellow-400 animate-pulse">EXECUTING LOGIC...</span>
              <span *ngIf="p.status === 'finished'" class="text-emerald-500 flex items-center gap-2">
                <span class="text-base">✅</span> VALIDATED SUCCESS
              </span>
              <span *ngIf="p.status === 'idle'" class="text-slate-500">IDLE STATUS</span>
              <span class="flex-1"></span>
              <span class="text-slate-600 font-sans tracking-normal opacity-50">{{ p.progress }}% COMPLETION</span>
           </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    ::-webkit-scrollbar {
      width: 4px;
    }
  `]
})
export class LeaderboardComponent {
  players: Player[] = [
    { name: 'Oussama (You)', score: 32450, progress: 82, status: 'typing', rank: 1 },
    { name: 'Alex_Pro', score: 28420, progress: 65, status: 'idle', rank: 2 },
    { name: 'Dev_Gamer', score: 19100, progress: 95, status: 'finished', rank: 3 }
  ];

  getRankClass(rank: number) {
    if (rank === 1) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40 shadow-lg shadow-yellow-500/10';
    if (rank === 2) return 'bg-slate-300/10 text-slate-300 border-slate-300/20';
    if (rank === 3) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-slate-900 text-slate-500 border-white/5';
  }

  getProgressColor(p: Player) {
    if (p.status === 'finished') return 'bg-emerald-500';
    if (p.status === 'running') return 'bg-yellow-500';
    return 'bg-cyan-500';
  }

  getStatusColor(status: string) {
    switch (status) {
      case 'typing': return 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]';
      case 'running': return 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-pulse';
      case 'finished': return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]';
      default: return 'bg-slate-700';
    }
  }
}
