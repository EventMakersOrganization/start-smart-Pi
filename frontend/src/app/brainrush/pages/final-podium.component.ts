import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BrainrushService } from '../services/brainrush.service';

@Component({
  selector: 'app-final-podium',
  templateUrl: './final-podium.component.html',
  styleUrls: ['./final-podium.component.css']
})
export class FinalPodiumComponent implements OnInit {
  gameSessionId!: string;
  topPlayers: any[] = [];
  aiFeedback: any = {};

  constructor(
    private route: ActivatedRoute,
    private brainrushService: BrainrushService
  ) {}

  ngOnInit() {
    this.gameSessionId = this.route.snapshot.paramMap.get('id')!;
    // Fetch final results
    this.brainrushService.getLeaderboard().subscribe({
      next: (leaderboard) => {
        this.topPlayers = leaderboard.slice(0, 3);
      },
      error: (error) => console.error(error)
    });
    // Assume aiFeedback is part of the response or separate
  }
}
