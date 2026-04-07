import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-slate-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      <!-- Toolbar -->
      <div class="flex items-center justify-between px-8 py-5 bg-slate-800 border-b border-white/10">
        <div class="flex items-center gap-6">
          <div class="flex gap-2.5 px-4 py-2 bg-slate-900 rounded-xl border border-white/10 group-hover:border-white/20 transition-all">
            <span class="w-3.5 h-3.5 rounded-full bg-red-500/30 border border-red-500/20"></span>
            <span class="w-3.5 h-3.5 rounded-full bg-yellow-500/30 border border-yellow-500/20"></span>
            <span class="w-3.5 h-3.5 rounded-full bg-emerald-500/30 border border-emerald-500/20"></span>
          </div>
          <div class="flex items-center gap-3 px-4 py-2 bg-slate-900 rounded-xl text-xs font-black text-slate-400 tracking-[0.2em] uppercase border border-white/5">
            <span>{{ language | uppercase }}</span>
            <span class="w-2 h-2 rounded-full bg-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.6)] animate-pulse"></span>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <button (click)="onRun.emit()" class="flex items-center gap-2.5 px-6 py-2.5 bg-slate-900 hover:bg-slate-700 rounded-xl text-[10px] font-black tracking-widest text-white transition-all border border-white/10 uppercase shadow-lg active:scale-95">
            <span class="text-emerald-400 text-lg">▶</span> COMPILATION
          </button>
          <button (click)="onSubmit.emit()" class="flex items-center gap-2.5 px-8 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-xl text-[10px] font-black tracking-[0.2em] text-white transition-all shadow-[0_5px_15px_rgba(59,130,246,0.3)] uppercase active:scale-95">
            🚀 DEPLOY SOLUTION
          </button>
        </div>
      </div>

      <!-- Editor Area -->
      <div class="flex-1 relative flex overflow-hidden">
        <!-- Line Numbers (Darker/higher contrast) -->
        <div class="w-16 bg-slate-800 border-r border-white/5 flex flex-col py-6 gap-1 text-[11px] items-center text-slate-500 font-mono select-none">
          <div *ngFor="let i of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]">
            {{ i | number:'2.0-0' }}
          </div>
        </div>
        
        <!-- Textarea (Max readability) -->
        <div class="flex-1 relative bg-slate-900">
          <textarea 
            [ngModel]="code"
            (ngModelChange)="onCodeChange($event)"
            class="w-full h-full bg-transparent p-6 outline-none text-white font-mono text-base resize-none leading-relaxed placeholder:text-slate-700"
            spellcheck="false"
            placeholder="// INITIALIZING CODE STREAM..."
          ></textarea>
          
          <!-- Subtle Glow Overlay (Non-intrusive) -->
          <div class="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
             <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-blue-600 rounded-full blur-[120px]"></div>
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="px-8 py-3 bg-blue-600 flex items-center justify-between text-[9px] font-black text-white tracking-[0.3em] uppercase shadow-t shadow-black/20">
        <div class="flex items-center gap-6">
          <span class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-white opacity-80 animate-pulse"></span> SYSTEM: READY
          </span>
          <span>BUFFER: UTF-8</span>
          <span class="opacity-50">LN 24, COL 5</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="opacity-50 tracking-normal">QUALITY GRADE:</span>
          <span class="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]">OPTIMIZED (S+)</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    textarea {
      caret-color: #22d3ee;
      line-height: 1.7;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
  `]
})
export class EditorComponent {
  @Input() language: string = 'javascript';
  @Input() code: string = '';
  @Output() codeChange = new EventEmitter<string>();
  @Output() onRun = new EventEmitter<void>();
  @Output() onSubmit = new EventEmitter<void>();

  onCodeChange(newCode: string) {
    this.code = newCode;
    this.codeChange.emit(newCode);
  }
}
