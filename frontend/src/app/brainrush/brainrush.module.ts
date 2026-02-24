import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import { LobbyComponent } from './pages/lobby.component';
import { GamePlayComponent } from './pages/game-play.component';
import { FinalPodiumComponent } from './pages/final-podium.component';

import { TimerBarComponent } from './components/timer-bar.component';
import { ScoreBoardComponent } from './components/score-board.component';
import { LeaderboardComponent } from './components/leaderboard.component';
import { QuestionCardComponent } from './components/question-card.component';
import { FinalFeedbackComponent } from './components/final-feedback.component';

const routes: Routes = [
  { path: 'lobby', component: LobbyComponent },
  { path: 'game/:id', component: GamePlayComponent },
  { path: 'podium/:id', component: FinalPodiumComponent },
];

@NgModule({
  declarations: [
    LobbyComponent,
    GamePlayComponent,
    FinalPodiumComponent,
    TimerBarComponent,
    ScoreBoardComponent,
    LeaderboardComponent,
    QuestionCardComponent,
    FinalFeedbackComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forChild(routes),
  ],
  exports: [
    RouterModule,
  ],
})
export class BrainrushModule { }
