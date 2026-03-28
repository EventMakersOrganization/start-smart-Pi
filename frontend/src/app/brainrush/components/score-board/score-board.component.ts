import { Component, OnInit } from '@angular/core';
import { ScoringService } from '../../services/scoring.service';

@Component({
  selector: 'app-score-board',
  template: `
    <div class="bg-indigo-600 text-white p-4 rounded-lg shadow-md font-bold text-xl text-center">
      Score: {{ score }}
    </div>
  `
})
export class ScoreBoardComponent implements OnInit {
  score = 0;
  constructor(private scoringService: ScoringService) {}
  
  ngOnInit() {
    this.scoringService.score$.subscribe(s => this.score = s);
  }
}
