import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-final-podium',
  template: `
    <div class="min-h-screen bg-indigo-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 class="text-5xl font-black mb-12 text-yellow-400 drop-shadow-md">Game Over!</h1>
      
      <div class="bg-indigo-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full mb-8">
        <h2 class="text-3xl font-bold mb-4">Your Final Score</h2>
        <div class="text-6xl font-black text-white bg-clip-text text-transparent bg-gradient-to-br from-green-400 to-blue-500 mb-8">
          {{ result?.score || 0 }} pts
        </div>
        
        <p class="text-indigo-200 font-semibold text-lg mb-2">Reached Level: <span class="capitalize text-white">{{ result?.difficultyAchieved || 'Medium' }}</span></p>
        <p class="text-indigo-200 font-semibold text-lg">Time logic: {{ result?.timeSpent || 0 }}s</p>

        <app-final-feedback *ngIf="result?.aiFeedback" [feedback]="result?.aiFeedback"></app-final-feedback>
      </div>

      <button (click)="goToLobby()" class="px-8 py-4 bg-white text-indigo-900 font-bold rounded-full hover:bg-gray-100 transition shadow-lg">
        Play Again
      </button>
    </div>
  `
})
export class FinalPodiumComponent implements OnInit {
  result: any;

  constructor(private router: Router) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.result = navigation.extras.state['result'];
    }
  }

  ngOnInit() {
    if (!this.result) this.result = history.state.result;
  }

  goToLobby() {
    this.router.navigate(['/brainrush/lobby']);
  }
}
