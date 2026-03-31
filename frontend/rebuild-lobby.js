const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src', 'app', 'brainrush');

const lobbyComponentPath = path.join(baseDir, 'pages', 'lobby', 'lobby.component.ts');
const modulePath = path.join(baseDir, 'brainrush.module.ts');

const lobbyTsContent = `
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BrainrushService } from '../../services/brainrush.service';

@Component({
  selector: 'app-lobby-header',
  standalone: true,
  template: \\`
    < div class="flex flex-col items-center justify-center text-center space-y-4 mb-12" >
      <div class="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white/20 text-white">
        <span class="material-symbols-outlined text-5xl">sports_esports</span>
      </div>
      <h1 class="text-6xl font-black text-white drop-shadow-lg tracking-tight">BrainRush</h1>
      <p class="text-xl text-white/90 font-medium max-w-md">Adaptive AI Quiz Game - Learn While You Play!</p>
    </div >
\\`
})
export class LobbyHeaderComponent {}

@Component({
  selector: 'app-mode-selector',
  standalone: true,
  imports: [CommonModule],
  template: \\`
    < div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto mb-8" >
      < !--Solo Card-- >
    <button 
        (click) = "select('solo')"
[ngClass] = "activeMode === 'solo' ? 'ring-4 ring-[#4361ee] scale-105 shadow-2xl z-10' : 'hover:scale-[102] shadow-lg'"
class="bg-white rounded-xl p-8 transition-all duration-300 flex items-center gap-6 text-left relative overflow-hidden group" >
        <div class="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">⚡</div>
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-2">Solo Practice</h2>
          <p class="text-gray-500 font-medium">AI adaptive questions to master any topic.</p>
        </div>
      </button >

      < !--Team Card-- >
    <button 
        (click) = "select('team')"
[ngClass] = "activeMode === 'team' ? 'ring-4 ring-[#4cc9f0] scale-105 shadow-2xl z-10' : 'hover:scale-[102] shadow-lg'"
class="bg-white rounded-xl p-8 transition-all duration-300 flex items-center gap-6 text-left relative overflow-hidden group" >
        <div class="w-16 h-16 rounded-full bg-cyan-50 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">👥</div>
        <div>
          <h2 class="text-2xl font-bold text-gray-800 mb-2">Team Battle</h2>
          <p class="text-gray-500 font-medium">Multiplayer quiz to challenge your friends.</p>
        </div>
      </button >
    </div >
\\`
})
export class ModeSelectorComponent {
  @Input() activeMode!: 'solo' | 'team' | null;
  @Output() modeSelected = new EventEmitter<'solo' | 'team'>();

  select(mode: 'solo' | 'team') {
    this.modeSelected.emit(mode);
  }
}

@Component({
  selector: 'app-solo-config',
  standalone: true,
  imports: [CommonModule],
  template: \\`
    < div class="bg-white/95 backdrop-blur-xl rounded-2xl p-8 shadow-2xl w-full max-w-5xl mx-auto mb-12 animate-fade-in-up" >
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <!-- LEFT: Difficulty Selection -->
            <div class="space-y-4">
                <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-[#4361ee]">speed</span> Difficulty
                </h3>
                <button *ngFor="let diff of difficulties"
                (click)="selectedDifficulty = diff.value"
                [ngClass]="selectedDifficulty === diff.value ? 'bg-[#4361ee] text-white shadow-lg scale-105' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'"
            class="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 text-left flex justify-between items-center group">
                {{ diff.label }}
                <span *ngIf="diff.value === 'adaptive'" class="text-[10px] uppercase font-black bg-amber-400 text-amber-900 px-2 py-1 rounded shadow-sm">AI Recommended</span>
        </button>
        </div >

        < !--RIGHT: Topic Selection-- >
    <div class="lg:col-span-2 space-y-4">
        <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-[#4361ee]">category</span> Topic Selection
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button *ngFor="let topic of topics"
            (click)="selectedTopic = topic.value"
            [ngClass]="selectedTopic === topic.value ? 'bg-[#4361ee] text-white shadow-lg scale-105' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'"
              class="p-4 rounded-xl transition-all duration-200 text-left relative flex justify-between items-start">
            <span class="font-bold text-lg">{{ topic.label }}</span>
            <span *ngIf="topic.recommended" class="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">Recommended</span>
    </button>
          </div >

    <div class="pt-8">
        <button (click)="start.emit()" class="w-full py-5 bg-[#4361ee] hover:bg-blue-700 text-white rounded-full text-xl font-black uppercase tracking-wider transition-all shadow-xl hover:shadow-blue-500/30 flex items-center justify-center gap-3">
        <span class="material-symbols-outlined text-3xl">play_circle</span> Start Solo Game
    </button>
          </div >
        </div >
      </div >
    </div >
\\`,
  styles: [\\`
@keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
}
    .animate - fade -in -up { animation: fadeInUp 0.4s ease - out forwards; }
\\`]
})
export class SoloConfigComponent {
  @Output() start = new EventEmitter<void>();
  
  selectedDifficulty = 'medium';
  selectedTopic = 'data_structures';

  difficulties = [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
    { label: 'Adaptive', value: 'adaptive' }
  ];

  topics = [
    { label: 'Data Structures', value: 'data_structures', recommended: true },
    { label: 'Algorithms', value: 'algorithms', recommended: false },
    { label: 'OOP', value: 'oop', recommended: true },
    { label: 'Databases', value: 'databases', recommended: false },
    { label: 'Web Development', value: 'web_dev', recommended: false }
  ];
}

@Component({
  selector: 'app-team-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: \\`
    < div class="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-5xl mx-auto mb-12 animate-fade-in-up overflow-hidden" >
      <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        <!-- LEFT: Create Room -->
        <div class="p-10 space-y-8">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-2xl">🏆</div>
            <div>
              <h3 class="text-xl font-black text-gray-800">Create Room</h3>
              <p class="text-sm text-gray-500 font-medium">Host a multiplayer battle</p>
            </div>
          </div>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Topic</label>
              <select class="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-[#4cc9f0]">
                <option>Data Structures</option>
                <option>Algorithms</option>
                <option>Web Development</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Difficulty</label>
              <select class="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-[#4cc9f0]">
                <option>Medium</option>
                <option>Hard</option>
                <option>Adaptive</option>
              </select>
            </div>
            <button (click)="create.emit()" class="w-full py-4 mt-4 bg-gradient-to-r from-[#4cc9f0] to-blue-500 hover:opacity-90 text-white rounded-xl text-lg font-bold transition-all shadow-lg hover:shadow-cyan-500/30 flex items-center justify-center gap-2">
              Generate Room Code <span class="material-symbols-outlined">magic_button</span>
            </button>
          </div>
        </div>

        <!--RIGHT: Join Room-- >
        <div class="p-10 space-y-8 bg-gray-50/50">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-2xl">👥</div>
            <div>
              <h3 class="text-xl font-black text-gray-800">Join Room</h3>
              <p class="text-sm text-gray-500 font-medium">Enter a code to join</p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Room Code</label>
              <input type="text" [(ngModel)]="roomCode" maxlength="6" 
                class="w-full bg-white border-2 border-gray-200 text-gray-800 rounded-xl px-4 py-4 font-black uppercase text-center text-3xl tracking-widest outline-none focus:border-[#4361ee] focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-gray-300"
                placeholder="XXXXXX">
            </div>
            <button [disabled]="roomCode.length !== 6" (click)="join.emit(roomCode)"
              class="w-full py-4 bg-[#4361ee] disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-xl text-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2">
              Join Battle <span class="material-symbols-outlined">login</span>
            </button>
          </div>

          <div class="pt-6 border-t border-gray-200">
            <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recent Rooms</p>
            <div class="flex flex-wrap gap-2">
              <button (click)="roomCode = 'A91F2B'" class="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:border-[#4361ee] hover:text-[#4361ee] transition-colors">A91F2B</button>
              <button (click)="roomCode = 'X82C0M'" class="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:border-[#4361ee] hover:text-[#4361ee] transition-colors">X82C0M</button>
            </div >
          </div >
        </div >
      </div >
    </div >
\\`,
  styles: [\\`
@keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
}
    .animate - fade -in -up { animation: fadeInUp 0.4s ease - out forwards; }
\\`]
})
export class TeamConfigComponent {
  @Output() create = new EventEmitter<void>();
  @Output() join = new EventEmitter<string>();
  
  roomCode = '';
}

@Component({
  selector: 'app-lobby',
  template: \\`
    < div class="min-h-screen bg-gradient-to-br from-purple-900 via-pink-700 to-orange-500 p-6 flex flex-col items-center pt-16" >
      
      <app-lobby-header></app-lobby-header>
      
      <app-mode-selector 
        [activeMode] = "selectedMode"
    (modeSelected) = "selectedMode = $event" >
      </app - mode - selector >

    <app-solo-config 
        * ngIf="selectedMode === 'solo'"
    (start) = "startSolo()" >
      </app - solo - config >

    <app-team-config
        * ngIf="selectedMode === 'team'"
    (create) = "createTeam()"
        (join) = "joinTeam($event)" >
      </app - team - config >

      < !--Back Button-- >
    <button routerLink="/" class="mt-8 mb-12 px-6 py-3 text-white/70 hover:text-white font-bold flex items-center gap-2 hover:bg-white/10 rounded-full transition-all">
        <span class="material-symbols-outlined">arrow_back</span> Back to Dashboard
    </button>

    </div >
\\`
})
export class LobbyComponent {
  selectedMode: 'solo' | 'team' | null = null;

  constructor(private service: BrainrushService, private router: Router) {}

  startSolo() {
    this.service.createRoom('solo').subscribe((res: any) => {
      this.router.navigate(['/brainrush/game', res._id, 'solo']);
    });
  }

  createTeam() {
    this.service.createRoom('multiplayer').subscribe((res: any) => {
      this.router.navigate(['/brainrush/game', res._id, res.roomCode]);
    });
  }

  joinTeam(code: string) {
    if (code.length === 6) {
      this.service.joinRoom(code).subscribe((res: any) => {
        this.router.navigate(['/brainrush/game', res._id, res.roomCode]);
      });
    }
  }
}
`;

fs.writeFileSync(lobbyComponentPath, lobbyTsContent.trim() + '\n');

// Now update brainrush.module.ts to import these standalone components
let moduleContent = fs.readFileSync(modulePath, 'utf8');

if (!moduleContent.includes('ModeSelectorComponent')) {
    moduleContent = moduleContent.replace(
        'import { LobbyComponent } from \\'./ pages / lobby / lobby.component\\';',
        \\`import { LobbyComponent, LobbyHeaderComponent, ModeSelectorComponent, SoloConfigComponent, TeamConfigComponent } from './pages/lobby/lobby.component';\\`
    );

    moduleContent = moduleContent.replace(
        'imports: [',
        \\`imports: [
    LobbyHeaderComponent,
    ModeSelectorComponent,
    SoloConfigComponent,
    TeamConfigComponent,\\`
    );

    fs.writeFileSync(modulePath, moduleContent);
}

console.log('Lobby re-designed successfully.');
