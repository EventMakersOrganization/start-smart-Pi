import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-score-board',
  template: `
    <div class="score-board">
      <h3>Score: {{ score }}</h3>
      <p>Difficulty: {{ difficulty }}</p>
    </div>
  `,
  styles: [`
    .score-board {
      padding: 10px;
      border: 1px solid #ccc;
      margin: 10px 0;
    }
  `]
})
export class ScoreBoardComponent {
  @Input() score = 0;
  @Input() difficulty: 'easy' | 'medium' | 'hard' = 'easy';
}
