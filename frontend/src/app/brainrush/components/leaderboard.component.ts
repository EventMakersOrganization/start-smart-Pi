import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-leaderboard',
  template: `
    <div class="leaderboard">
      <h3>Leaderboard</h3>
      <ul>
        <li *ngFor="let player of leaderboard; let i = index">
          {{ i + 1 }}. {{ player.userId }} - {{ player.score }}
        </li>
      </ul>
    </div>
  `,
  styles: [`
    .leaderboard {
      padding: 10px;
      border: 1px solid #ccc;
      margin: 10px 0;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      padding: 5px 0;
    }
  `]
})
export class LeaderboardComponent {
  @Input() leaderboard: any[] = [];
}
