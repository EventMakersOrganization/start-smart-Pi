import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { EditorComponent } from '../components/editor/editor.component';
import { CodebattleService, SoloSession, CodeProblem } from '../services/codebattle.service';
import { CodebattleSocketService } from '../services/codebattle-socket.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, RouterModule, EditorComponent],
  template: `
    <div class="h-screen bg-slate-900 text-white flex flex-col font-sans overflow-hidden">
      <!-- Header / Stats Bar -->
      <header class="h-20 border-b border-white/10 px-10 flex items-center justify-between bg-slate-800/50 backdrop-blur-md relative z-20 shadow-xl">
        <div class="flex items-center gap-8">
          <button (click)="goBack()" class="p-3 hover:bg-slate-700/50 rounded-xl transition-all group flex items-center justify-center">
            <span class="text-slate-400 group-hover:text-white text-2xl font-bold font-mono">←</span>
          </button>
          
          <div class="h-10 w-[1.5px] bg-white/10"></div>
          
          <!-- Mode Specific Header -->
          <div class="flex flex-col">
            <span class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-none mb-2 px-1">
              {{ mode === 'solo' ? 'SOLO MISSION' : 'BATTLE ROYALE' }}
            </span>
            <span class="text-xl font-black" [ngClass]="mode === 'solo' ? 'text-blue-400' : 'text-purple-400'">
              {{ currentProblem?.title || 'LOADING MISSION...' }}
            </span>
          </div>
        </div>

        <!-- Timer & Score -->
        <div class="flex items-center gap-16">
            <div class="flex flex-col items-center">
              <span class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 leading-none">TIME REMAINING</span>
              <span [class.text-red-500]="isTimeLow" class="text-3xl font-black tabular-nums leading-none tracking-tighter">
                {{ formatTime(timeLeftInSeconds) }}
              </span>
            </div>
            
            <div class="flex flex-col items-center">
               <span class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 leading-none">CURRENT SCORE</span>
               <div class="flex items-end gap-3 leading-none">
                 <span class="text-3xl font-black text-white tabular-nums tracking-tighter">{{ session?.score || 0 }}</span>
               </div>
            </div>
        </div>

        <div class="flex items-center gap-6">
           <div class="flex items-center gap-3 px-4 py-2" [ngClass]="mode === 'solo' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-purple-500/10 border-purple-500/20'" class="rounded-full border shadow-lg">
              <span class="w-2.5 h-2.5 rounded-full animate-pulse" [ngClass]="mode === 'solo' ? 'bg-blue-500' : 'bg-purple-500'"></span>
              <span class="text-[10px] font-black tracking-widest uppercase">
                {{ mode === 'solo' ? 'SOLO LINK' : 'BATTLE SYNC' }}
              </span>
           </div>
        </div>
      </header>

      <!-- Main Game Area -->
      <main class="flex-1 flex overflow-hidden">
        <!-- LEFT PANEL: Problem + Leaderboard (if multi) -->
        <div class="w-[38%] min-w-[450px] border-r border-white/10 flex flex-col overflow-y-auto bg-slate-900/50 p-10 gap-10">
           
           <!-- Leaderboard (Multiplayer Only) -->
           <section *ngIf="mode === 'multiplayer' && leaderboard.length" class="bg-slate-800/40 rounded-2xl p-6 border border-white/5 animate-in slide-in-from-top-4">
              <div class="flex items-center justify-between mb-4">
                 <h3 class="text-xs font-black text-purple-400 uppercase tracking-[0.3em] flex items-center gap-2">
                   <span class="material-symbols-outlined text-sm">leaderboard</span> RIVAL RANKINGS
                 </h3>
                 <span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">LIVE</span>
              </div>
              <div class="space-y-3">
                 <div *ngFor="let p of leaderboard; let i = index" class="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5 group hover:border-purple-500/30 transition-all">
                    <div class="flex items-center gap-4">
                       <span class="text-[10px] font-black text-slate-600 font-mono w-4">0{{ i + 1 }}</span>
                       <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-black border border-white/5">
                          {{ p.username.charAt(0) }}
                       </div>
                       <span class="text-sm font-bold truncate max-w-[120px]" [class.text-purple-400]="p.socketId === socketService.socketId">{{ p.username }}</span>
                    </div>
                    <div class="flex flex-col items-end">
                       <span class="text-xs font-black text-white">{{ p.score }}</span>
                       <div class="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                          <div class="h-full bg-purple-500" [style.width.%]="p.progress"></div>
                       </div>
                    </div>
                 </div>
              </div>
           </section>

           <!-- Submission Progress (Multiplayer only) -->
           <div *ngIf="mode === 'multiplayer' && submissionProgress" class="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
              <span class="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                SUBMISSIONS: {{ submissionProgress.submittedCount }}/{{ submissionProgress.totalPlayers }}
              </span>
              <div class="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
                 <div class="h-full bg-purple-500 transition-all duration-500" [style.width.%]="(submissionProgress.submittedCount / submissionProgress.totalPlayers) * 100"></div>
              </div>
           </div>

           <!-- Problem Section -->
           <section class="animate-in slide-in-from-left-8 duration-700">
             <div class="flex items-center justify-between mb-6">
               <span *ngIf="currentProblem" [ngClass]="{
                 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30': currentProblem.difficulty === 'easy',
                 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30': currentProblem.difficulty === 'medium',
                 'text-red-500 bg-red-500/10 border-red-500/30': currentProblem.difficulty === 'hard'
               }" class="px-4 py-1.5 text-[11px] font-black border rounded-full tracking-widest uppercase">RANK: {{ currentProblem.difficulty }}</span>
               
               <span class="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">
                 CHALLENGE {{ (session?.currentProblemIndex || 0) + 1 }} / {{ session?.totalProblems || 1 }}
               </span>
             </div>
             
             <h2 class="text-3xl font-black mb-6 tracking-tighter text-white">{{ currentProblem?.title || 'Loading Scenario...' }}</h2>
             <div class="space-y-6 text-base text-slate-300 leading-relaxed text-justify">
               <p>{{ currentProblem?.description }}</p>
               
               <div *ngIf="currentProblem?.testCases?.length" class="bg-slate-800/80 rounded-2xl p-6 border border-white/10 font-mono text-sm space-y-4 shadow-inner mt-4">
                 <p class="text-slate-500 uppercase font-black text-[10px] tracking-widest mb-2">IO SPECIFICATION (EXAMPLE 1)</p>
                 <div class="flex flex-col gap-3">
                   <p><span class="text-cyan-400 font-bold uppercase tracking-widest text-[10px]">Input:</span> <code class="text-white bg-white/5 px-2 py-1 rounded">{{ currentProblem?.testCases?.[0]?.input | json }}</code></p>
                   <p><span class="text-purple-400 font-bold uppercase tracking-widest text-[10px]">Output:</span> <code class="text-white bg-white/5 px-2 py-1 rounded">{{ currentProblem?.testCases?.[0]?.expectedOutput | json }}</code></p>
                 </div>
               </div>
             </div>
           </section>
        </div>

        <!-- RIGHT PANEL: Editor + Output -->
        <div class="flex-1 flex flex-col p-6 bg-slate-900 relative overflow-hidden">

          <!-- AWAITING RIVALS OVERLAY (Multiplayer: after submit, before results) -->
          <div *ngIf="isAwaitingRivals" class="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300">
             <div class="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/20 animate-pulse">
                <span class="text-4xl">⏳</span>
             </div>
             <h3 class="text-2xl font-black uppercase tracking-widest text-purple-400">Response Locked In</h3>
             <p class="text-slate-400 text-sm max-w-xs text-center leading-relaxed">Awaiting all rivals to submit their solutions...</p>
             <div *ngIf="submissionProgress" class="flex items-center gap-3">
                <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {{ submissionProgress.submittedCount }}/{{ submissionProgress.totalPlayers }} SUBMITTED
                </span>
             </div>
          </div>

          <!-- ROUND RESULTS OVERLAY (Multiplayer: show correct/incorrect) -->
          <div *ngIf="showingRoundResults" class="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-6 animate-in zoom-in-95 duration-500">
             <div class="w-24 h-24 rounded-full flex items-center justify-center border-2 shadow-2xl"
                  [ngClass]="myRoundResult?.success ? 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/20' : 'bg-red-500/10 border-red-500/30 shadow-red-500/20'">
                <span class="text-5xl">{{ myRoundResult?.success ? '✅' : '❌' }}</span>
             </div>
             <h3 class="text-3xl font-black uppercase tracking-widest" [ngClass]="myRoundResult?.success ? 'text-emerald-400' : 'text-red-400'">
               {{ myRoundResult?.success ? 'CORRECT!' : 'INCORRECT' }}
             </h3>
             <p class="text-slate-400 text-xs uppercase tracking-widest">
               {{ myRoundResult?.passedTests }}/{{ myRoundResult?.totalTests }} tests passed • Score: {{ myRoundResult?.score }}
             </p>
             <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest animate-pulse mt-4">Loading next challenge...</span>
          </div>

          <div class="flex-1 min-h-0 animate-in slide-in-from-right-12 duration-700 z-10 flex flex-col">
             <app-code-editor 
               [language]="language" 
               [code]="code"
               (codeChange)="code = $event"
               (onRun)="executeCode()"
               (onSubmit)="submitSolution()"
             ></app-code-editor>
          </div>

          <!-- Bottom Console/Feedback Output -->
          <div class="h-[35%] mt-6 bg-slate-800 rounded-2xl border border-white/10 flex flex-col overflow-hidden animate-in slide-in-from-bottom-12 duration-700 shadow-2xl relative z-10">
             
             <!-- Console Header -->
             <div class="px-8 py-3 border-b border-white/10 flex items-center justify-between bg-slate-800/80">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">INTERACTIVE TERMINAL</span>
                
                <div *ngIf="isExecuting || isSubmitting" class="flex items-center gap-3">
                   <span class="text-[10px] font-black text-cyan-400 uppercase animate-pulse">RUNNING SCRIPT...</span>
                </div>
             </div>
             
             <!-- Console Body -->
             <div #terminalScroll class="flex-1 p-6 font-mono text-sm overflow-y-auto bg-slate-900/50 leading-relaxed text-slate-300">
                
                <div *ngIf="!consoleOutput && !consoleError && !isExecuting && !submissionFeedback" class="flex items-center justify-center h-full opacity-30 text-xs tracking-widest">
                   > AWAITING INSTRUCTIONS_
                </div>

                <div *ngIf="isExecuting" class="flex items-center gap-3 text-cyan-400 text-xs animate-pulse mb-2">
                   <span>></span> INITIALIZING RUNTIME...
                </div>

                <!-- Real Logs -->
                <div *ngIf="consoleOutput" class="whitespace-pre-wrap break-words">
                  <span class="text-slate-500 mr-2">></span>{{ consoleOutput }}
                </div>

                <!-- Errors -->
                <div *ngIf="consoleError" class="mt-2 text-red-500 font-bold bg-red-500/10 p-4 border border-red-500/20 rounded-lg">
                  <span class="block text-xs uppercase tracking-widest mb-1">Runtime Exception:</span>
                  {{ consoleError }}
                </div>

                <div *ngIf="submissionFeedback" class="mt-4 p-4 border rounded-xl shadow-inner relative" [ngClass]="submissionFeedback.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'">
                   <span class="block text-xs font-black mb-1 tracking-widest" [ngClass]="submissionFeedback.success ? 'text-emerald-400' : 'text-red-400'">
                     {{ submissionFeedback.success ? 'MISSION DATA TRANSMITTED' : 'LOGIC VALIDATION FAILED' }}
                   </span>
                   <span class="text-slate-300 text-xs mt-2 block">{{ submissionFeedback.message || 'Proceeding to next mission objective...' }}</span>
                </div>
             </div>
          </div>

          <!-- Decorative Gradient Background Glow -->
          <div class="absolute -top-1/2 -right-1/2 w-full h-full bg-blue-600/5 blur-[200px] pointer-events-none rounded-full animate-pulse z-0"></div>
          <div class="absolute -bottom-1/2 -left-1/2 w-full h-full bg-cyan-600/5 blur-[200px] pointer-events-none rounded-full animate-pulse z-0" style="animation-delay: 2s"></div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host { font-family: 'Inter', sans-serif; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    ::-webkit-scrollbar-track { background: transparent; }
  `]
})
export class GameComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('terminalScroll') private terminalScrollContainer!: ElementRef;

  mode: 'solo' | 'multiplayer' | null = 'solo';
  timeLeftInSeconds: number = 60;
  isTimeLow: boolean = false;
  language: string = 'javascript';
  code: string = '';

  session: SoloSession | null = null;
  currentProblem: CodeProblem | null = null;
  leaderboard: any[] = [];

  isExecuting: boolean = false;
  isSubmitting: boolean = false;

  // Multiplayer sync states
  isAwaitingRivals: boolean = false;
  showingRoundResults: boolean = false;
  myRoundResult: any = null;
  submissionProgress: any = null;

  consoleOutput: string = '';
  consoleError: string | null = null;
  submissionFeedback: any = null;

  private timerInt: any;

  constructor(
    public router: Router,
    public route: ActivatedRoute,
    public codebattleService: CodebattleService,
    public socketService: CodebattleSocketService
  ) { }

  ngOnInit() {
    this.mode = this.codebattleService.getMode() || 'solo';

    this.route.queryParams.subscribe(params => {
      if (params['lang']) this.language = params['lang'];
      if (params['multi'] === 'true') this.mode = 'multiplayer';
    });

    this.session = this.codebattleService.getSession();
    if (!this.session) {
      this.goBack();
      return;
    }

    if (this.mode === 'multiplayer') {
      this.setupMultiplayerListeners();
    }

    this.loadProblem();
  }

  private setupMultiplayerListeners() {
    this.socketService.setupGameListeners(
      // onTimer
      (timeLeft: number) => {
        this.timeLeftInSeconds = timeLeft;
        this.isTimeLow = timeLeft <= 10;
      },
      // onProblemStarted — next problem begins
      (data: any) => {
        if (this.session) {
          this.session.currentProblemIndex = data.problemIndex;
          if (data.language) this.language = data.language;

          // Reset all multiplayer states
          this.isAwaitingRivals = false;
          this.showingRoundResults = false;
          this.myRoundResult = null;
          this.submissionProgress = null;
          this.isSubmitting = false;

          this.loadProblem();
        }
      },
      // onLeaderboard
      (players: any[]) => {
        this.leaderboard = players;
      },
      // onSubmissionLocked — YOUR submission was locked in
      (data: any) => {
        this.isAwaitingRivals = true;
        this.isSubmitting = false;
        this.consoleOutput = '';
        this.submissionFeedback = null;
      },
      // onSubmissionProgress — X/Y players submitted
      (data: any) => {
        this.submissionProgress = data;
      },
      // onRoundResults — ALL results revealed simultaneously
      (data: any) => {
        this.isAwaitingRivals = false;
        this.showingRoundResults = true;

        // Find MY result
        const myResult = data.playerResults.find((r: any) => r.socketId === this.socketService.socketId);
        this.myRoundResult = myResult || { success: false, passedTests: 0, totalTests: 0, score: 0 };

        // Update session score
        if (this.session && myResult) {
          this.session.score = myResult.score;
          this.session.solved = myResult.solvedCount;
        }

        // Update leaderboard
        if (data.leaderboard) {
          this.leaderboard = data.leaderboard;
        }
      },
      // onFinished — game over, navigate to results
      (results: any) => {
        this.showingRoundResults = false;
        this.isAwaitingRivals = false;
        this.router.navigate(['/codebattle/results'], { state: { results: results.players } });
      }
    );
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.terminalScrollContainer.nativeElement.scrollTop = this.terminalScrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  loadProblem() {
    if (!this.session) return;
    this.currentProblem = this.session.problems[this.session.currentProblemIndex];
    if (this.currentProblem && this.currentProblem.languageTemplates) {
      this.code = this.currentProblem.languageTemplates[this.language] || '// Write your code here';
    }
    this.consoleOutput = '';
    this.consoleError = null;
    this.submissionFeedback = null;

    // Solo mode uses local timer
    if (this.mode === 'solo') {
      this.startTimer(60);
    }
  }

  startTimer(seconds: number) {
    this.stopTimer();
    this.timeLeftInSeconds = seconds;
    this.timerInt = setInterval(() => {
      this.timeLeftInSeconds--;
      this.isTimeLow = this.timeLeftInSeconds <= 10;

      if (this.timeLeftInSeconds <= 0) {
        this.stopTimer();
        this.submitSolution();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInt) {
      clearInterval(this.timerInt);
    }
  }

  formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
  }

  executeCode() {
    if (!this.code.trim()) return;
    if (this.isExecuting || this.isSubmitting || this.isAwaitingRivals) return;

    this.isExecuting = true;
    this.consoleOutput = '';
    this.consoleError = null;
    this.submissionFeedback = null;

    this.codebattleService.runSolo(this.code, this.language).subscribe({
      next: (res) => {
        this.isExecuting = false;
        this.consoleOutput = res.output;
        this.consoleError = res.error;
      },
      error: (err) => {
        this.isExecuting = false;
        this.consoleError = "TERMINAL ERROR: Failed to establish runtime connection.";
      }
    });
  }

  submitSolution() {
    if (!this.session) return;
    if (this.isSubmitting || this.isAwaitingRivals) return;

    // Only block if manually clicking with empty code.
    // If timer is out, allowed to submit empty (auto-fail).
    if (this.timeLeftInSeconds > 0 && !this.code.trim()) return;

    this.isSubmitting = true;

    if (this.mode === 'solo') {
      this.stopTimer();
      this.codebattleService.submitSolo(this.session.sessionId, this.code, this.timeLeftInSeconds, this.language).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.submissionFeedback = {
            success: res.success,
            message: res.message || (res.success ? 'System verified logic. High synchronization achieved.' : 'Logic mismatch detected. Retrying diagnostic...')
          };

          if (this.session) {
            this.session.score = res.score;
            this.session.solved = res.solved;
            this.session.currentProblemIndex = res.currentProblemIndex;
          }

          setTimeout(() => {
            if (res.isFinished) {
              this.router.navigate(['/codebattle/results'], { state: { results: [{ username: 'You', score: res.score, solvedCount: res.solved }] } });
            } else {
              this.loadProblem();
            }
          }, 1500);
        },
        error: (err) => {
          this.isSubmitting = false;
          this.startTimer(this.timeLeftInSeconds);
        }
      });
    } else {
      // Multiplayer: send code to server, lock in answer
      this.socketService.submitCode(this.session.sessionId, this.code, this.timeLeftInSeconds);
      // The submissionLocked event will handle the UI transition
    }
  }

  goBack() {
    this.router.navigate(['/codebattle/lobby']);
  }
}
