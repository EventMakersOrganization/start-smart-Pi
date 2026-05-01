import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ai-feedback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-slate-800 rounded-3xl p-10 border border-white/10 relative overflow-hidden shadow-2xl backdrop-blur-xl group hover:border-white/20 transition-all">
       <!-- Decorative AI Icon -->
       <div class="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
         <span class="text-6xl drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]">🧠</span>
       </div>
       
       <div class="space-y-12 relative z-10">
          <!-- Strengths -->
          <section class="animate-in fade-in slide-in-from-right-8 duration-700">
            <div class="flex items-center gap-4 mb-5">
               <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
               <h4 class="text-xs font-black text-white/90 tracking-[0.4em] uppercase font-sans">OPTIMIZATION SUCCESS</h4>
            </div>
            <div class="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors">
              <p class="text-[13px] text-slate-300 leading-relaxed italic font-medium">
                "Your implementation of the pointer swapping is highly efficient. You've maintained O(1) space complexity which is critical for large scale processing. Well executed."
              </p>
            </div>
          </section>

          <!-- Weaknesses / Vulnerabilities -->
          <section class="animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
            <div class="flex items-center gap-4 mb-5">
               <div class="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] animate-pulse"></div>
               <h4 class="text-xs font-black text-white/90 tracking-[0.4em] uppercase font-sans">MEMORY LEAK VECTORS</h4>
            </div>
            <div class="bg-orange-500/5 p-6 rounded-2xl border border-orange-500/10 hover:bg-orange-500/10 transition-colors">
              <p class="text-[13px] text-slate-300 leading-relaxed italic font-medium">
                "A minor delay was detected in the base case validation. In a real-time production environment, this could lead to unhandled null pointers if not checked early."
              </p>
            </div>
          </section>

          <!-- Recommendation (High contrast focus) -->
          <section class="animate-in fade-in slide-in-from-right-8 duration-700 delay-400">
            <div class="flex items-center gap-4 mb-5">
               <div class="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>
               <h4 class="text-xs font-black text-cyan-400 tracking-[0.4em] uppercase font-sans">STRATEGIC UPGRADE</h4>
            </div>
            <div class="p-7 bg-blue-600/10 rounded-3xl border-2 border-blue-600/30 backdrop-blur-md group hover:bg-blue-600/20 transition-all shadow-xl">
               <p class="text-[13px] text-white leading-relaxed flex items-start gap-4">
                 <span class="text-3xl shrink-0 -mt-1 group-hover:scale-125 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">⚡</span>
                 <span class="font-bold tracking-tight">
                   Deep dive into recursive solutions for linked lists. While iterative is more space-efficient, mastering recursion improves your algorithmic flexibility for tree structures.
                 </span>
               </p>
            </div>
          </section>
       </div>
       
       <!-- Animated scanning effect (Lower opacity for focus) -->
       <div class="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan opacity-20"></div>
       <div class="absolute inset-0 bg-gradient-to-tr from-cyan-400/0 via-transparent to-blue-400/[0.03] pointer-events-none"></div>
    </div>
  `,
  styles: [`
    :host { font-family: 'Inter', sans-serif; }
    
    @keyframes scan {
      0% { top: -10%; }
      100% { top: 110%; }
    }
    
    .animate-scan {
      animation: scan 6s linear infinite;
    }
    
    .delay-200 { animation-delay: 200ms; }
    .delay-400 { animation-delay: 400ms; }
  `]
})
export class AiFeedbackComponent { }
