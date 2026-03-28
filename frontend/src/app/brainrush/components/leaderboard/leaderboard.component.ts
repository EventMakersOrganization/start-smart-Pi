import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-leaderboard',
  template: `
    <div class="bg-white p-4 rounded-lg shadow max-w-sm">
      <h3 class="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Live Ranking</h3>
      <ul>
        <li *ngFor="let player of leaderboard; let i = index" class="flex justify-between py-2 border-b last:border-0">
          <span class="font-semibold text-gray-600">#{{ i + 1 }} {{ player.userId?.first_name }}</span>
          <span class="font-bold text-indigo-600">{{ player.score }} pts</span>
        </li>
      </ul>
    </div>
  `
})
export class LeaderboardComponent {
  @Input() leaderboard: any[] = [];
}
