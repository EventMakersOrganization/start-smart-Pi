import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AiFeedbackComponent } from '../components/ai-feedback/ai-feedback.component';
import { CodebattleService, SoloSession } from '../services/codebattle.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterModule, AiFeedbackComponent],
  template: `
    <div class="min-h-screen bg-slate-900 font-sans text-white p-12 relative overflow-hidden flex flex-col items-center">
      <!-- Background Effects -->
      <div class="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none"></div>
      
      <!-- Title Area -->
      <div class="text-center mt-12 mb-16 relative z-10 animate-in fade-in duration-1000">
        <h2 class="text-xs font-black tracking-[0.5em] text-slate-500 uppercase mb-5">SESSION CONCLUDED</h2>
        <h1 class="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-blue-400 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          PERFORMANCE REVIEW
        </h1>
      </div>

      <!-- Main Layout: Stats or Podium -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full max-w-6xl z-10 mb-16 px-6">
         
         <!-- LEFT SIDE: Stats (Solo) or Podium (Multiplayer) -->
         <div class="space-y-10 animate-in slide-in-from-left-8 duration-700">
            <h3 class="text-xs font-black text-slate-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
               {{ mode === 'multiplayer' ? 'RIVAL RANKINGS' : 'MISSION METRICS' }}
               <span class="flex-1 h-[1px] bg-white/10"></span>
            </h3>
            
            <!-- Podium View -->
            <div *ngIf="mode === 'multiplayer'" class="grid grid-cols-1 gap-6">
               <div *ngFor="let p of multiplayerResults; let i = index" 
                  [ngClass]="{
                    'bg-gradient-to-r from-yellow-500/20 to-slate-800 border-yellow-500/40': i === 0,
                    'bg-gradient-to-r from-slate-300/10 to-slate-800 border-slate-300/20': i === 1,
                    'bg-gradient-to-r from-orange-500/10 to-slate-800 border-orange-500/20': i === 2,
                    'bg-slate-800/40 border-white/5': i > 2
                  }"
                  class="rounded-3xl p-8 border backdrop-blur-md shadow-2xl flex items-center justify-between group hover:scale-[1.02] transition-all">
                  
                  <div class="flex items-center gap-8">
                     <!-- Rank Badge -->
                     <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner"
                        [ngClass]="{
                          'bg-yellow-500 text-slate-900': i === 0,
                          'bg-slate-300 text-slate-900': i === 1,
                          'bg-orange-600 text-white': i === 2,
                          'bg-slate-900 text-slate-500': i > 2
                        }">
                        {{ i + 1 }}
                     </div>
                     
                     <div class="flex flex-col">
                        <span class="text-2xl font-black tracking-tight text-white uppercase">{{ p.username }}</span>
                        <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                          SOLVED: {{ p.solvedCount }} / MISSION TOTAL
                        </span>
                     </div>
                  </div>

                  <div class="text-right">
                     <span class="text-4xl font-black tabular-nums tracking-tighter" [class.text-yellow-400]="i === 0">
                       {{ p.score }}
                     </span>
                     <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">TOTAL POINTS</p>
                  </div>
               </div>
            </div>

            <!-- Solo Stats View -->
            <div *ngIf="mode === 'solo'" class="grid grid-cols-2 gap-6">
               <!-- Same Solo Stats as before -->
               <div class="bg-slate-800/80 rounded-3xl p-10 border border-white/10 group shadow-2xl backdrop-blur-md">
                  <div class="flex flex-col">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">TOTAL SCORE</span>
                    <span class="text-5xl font-black text-white group-hover:text-blue-400 transition-colors tracking-tighter tabular-nums">{{ session?.score || 0 }}</span>
                  </div>
               </div>
               <div class="bg-slate-800/80 rounded-3xl p-10 border border-white/10 group shadow-2xl backdrop-blur-md">
                  <div class="flex flex-col">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">SOLVED</span>
                    <span class="text-5xl font-black text-white tracking-tighter tabular-nums">{{ session?.solved || 0 }}/{{ session?.totalProblems || 0 }}</span>
                  </div>
               </div>
               <div class="col-span-2 bg-slate-800/80 rounded-3xl p-10 border border-white/10 shadow-2xl backdrop-blur-md">
                  <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">SYSTEM FEEDBACK</span>
                  <p class="text-sm font-medium text-slate-300 leading-relaxed italic">"{{ getFeedback() }}"</p>
               </div>
            </div>
         </div>

         <!-- Right Side: AI Feedback -->
         <div class="space-y-10 animate-in slide-in-from-right-8 duration-700">
            <h3 class="text-xs font-black text-slate-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
               AI CORE ANALYSIS
               <span class="flex-1 h-[1px] bg-white/10"></span>
            </h3>
            <div class="shadow-2xl shadow-blue-900/20">
               <app-ai-feedback></app-ai-feedback>
            </div>
         </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-8 z-10 animate-in slide-in-from-bottom-12 duration-1000 mb-16">
        <button [routerLink]="['/student-dashboard']" class="px-10 py-5 bg-slate-800 border border-white/10 hover:border-white/30 hover:bg-slate-700 rounded-2xl text-xs font-black transition-all active:scale-95 uppercase tracking-[0.2em]">
          ABORT TO DASHBOARD
        </button>
        <button (click)="playAgain()" class="px-14 py-5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-2xl text-sm font-black transition-all shadow-[0_10px_30px_rgba(59,130,246,0.3)] active:scale-95 uppercase tracking-[0.2em]">
          NEW MISSION ⚡
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { font-family: 'Inter', sans-serif; }
  `]
})
export class ResultsComponent implements OnInit {
  session: SoloSession | null = null;
  multiplayerResults: any[] = [];
  mode: 'solo' | 'multiplayer' = 'solo';

  constructor(
    private router: Router,
    private codebattleService: CodebattleService
  ) { }

  ngOnInit() {
    const state = history.state;
    if (state && state.results) {
      this.multiplayerResults = state.results;
      this.mode = this.multiplayerResults.length > 1 ? 'multiplayer' : 'solo';
    } else {
      this.mode = 'solo';
    }

    this.session = this.codebattleService.getSession();
  }

  getFeedback(): string {
    if (this.mode === 'multiplayer') return "COMPETITION CONCLUDED: Rival rankings finalized.";
    if (!this.session) return "No session data found.";
    const acc = (this.session.solved / (this.session.totalProblems || 1)) * 100;
    if (acc >= 100) return "Optimal logic detected. Your algorithmic efficiency is at peak capacity.";
    if (acc >= 70) return "Strong performance. Focus on edge cases to reach 100% precision.";
    if (acc >= 40) return "Consistent progress. Refine your loop logic and boundary conditions.";
    return "Keep practicing. Focus on fundamental data structures and time complexity.";
  }

  goHome() {
    this.router.navigate(['/']);
  }

  playAgain() {
    this.router.navigate(['/codebattle/lobby']);
  }
}
