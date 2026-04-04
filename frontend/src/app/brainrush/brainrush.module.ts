import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import {
  LobbyComponent, LobbyHeaderComponent,
  ModeSelectorComponent, SoloConfigComponent, TeamConfigComponent
} from './pages/lobby/lobby.component';

import {
  GamePlayComponent, GameTimerComponent,
  PowerUpComponent, AnswerOptionComponent
} from './pages/game-play/game-play.component';

import { FinalPodiumComponent } from './pages/final-podium/final-podium.component';
import { WaitingRoomComponent } from './pages/waiting-room/waiting-room.component';
import { SoloDashboardComponent } from './pages/solo-dashboard/solo-dashboard.component';
import { TimerBarComponent } from './components/timer-bar/timer-bar.component';
import { ScoreBoardComponent } from './components/score-board/score-board.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { QuestionCardComponent } from './components/question-card/question-card.component';
import { FinalFeedbackComponent } from './components/final-feedback/final-feedback.component';

const routes: Routes = [
  { path: 'lobby', component: LobbyComponent },
  { path: 'waiting-room', component: WaitingRoomComponent },
  { path: 'game/:sessionId/:roomCode', component: GamePlayComponent },
  { path: 'podium', component: FinalPodiumComponent },
  { path: 'dashboard', component: SoloDashboardComponent },
  { path: '', redirectTo: 'lobby', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    // Non-standalone components
    TimerBarComponent,
    ScoreBoardComponent,
    LeaderboardComponent,
    QuestionCardComponent,
    FinalFeedbackComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    // Standalone components
    LobbyComponent,
    LobbyHeaderComponent,
    ModeSelectorComponent,
    SoloConfigComponent,
    TeamConfigComponent,
    GamePlayComponent,
    GameTimerComponent,
    PowerUpComponent,
    AnswerOptionComponent,
    WaitingRoomComponent,
    FinalPodiumComponent,
    SoloDashboardComponent,
    RouterModule.forChild(routes)
  ]
})
export class BrainrushModule { }
