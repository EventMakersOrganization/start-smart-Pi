import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChatAiComponent } from './chat/chat-ai/chat-ai.component';
import { ChatInstructorComponent } from './chat/chat-instructor/chat-instructor.component';
import { ChatRoomComponent } from './chat/chat-room/chat-room.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'analytics',
    loadChildren: () =>
      import('./modules/analytics/analytics.module').then(
        (m) => m.AnalyticsModule
      ),
  },
  { path: 'chat/ai', component: ChatAiComponent },
  { path: 'chat/instructor', component: ChatInstructorComponent },
  { path: 'chat/room', component: ChatRoomComponent },
  { path: 'brainrush', loadChildren: () => import('./brainrush/brainrush.module').then(m => m.BrainrushModule) },
  { path: 'codebattle/lobby', loadComponent: () => import('./codebattle/lobby/lobby.component').then(m => m.LobbyComponent) },
  { path: 'codebattle/battle-lobby', loadComponent: () => import('./codebattle/battle-lobby/battle-lobby.component').then(m => m.BattleLobbyComponent) },
  { path: 'codebattle/game', loadComponent: () => import('./codebattle/game/game.component').then(m => m.GameComponent) },
  { path: 'codebattle/results', loadComponent: () => import('./codebattle/results/results.component').then(m => m.ResultsComponent) },
  {
    path: 'analytics',
    loadChildren: () =>
      import('./modules/analytics/analytics.module').then((m) => m.AnalyticsModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
