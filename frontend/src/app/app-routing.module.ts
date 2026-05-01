import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChatAiComponent } from './chat/chat-ai/chat-ai.component';
import { ChatInstructorComponent } from './chat/chat-instructor/chat-instructor.component';
import { ChatRoomComponent } from './chat/chat-room/chat-room.component';
import { ChatModule } from './chat/chat.module';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'analytics',
    data: { title: 'Analytics' },
    loadChildren: () =>
      import('./modules/analytics/analytics.module').then(
        (m) => m.AnalyticsModule
      ),
  },
  { path: 'chat/ai', component: ChatAiComponent, data: { title: 'AI Chat' } },
  {
    path: 'chat/instructor',
    component: ChatInstructorComponent,
    data: { title: 'Instructor Chat' },
  },
  {
    path: 'chat/room',
    component: ChatRoomComponent,
    data: { title: 'Chat Room' },
  },
  {
    path: 'brainrush',
    data: { title: 'Brainrush' },
    loadChildren: () =>
      import('./brainrush/brainrush.module').then((m) => m.BrainrushModule),
  },
  {
    path: 'codebattle/lobby',
    data: { title: 'Codebattle Lobby' },
    loadComponent: () =>
      import('./codebattle/lobby/lobby.component').then((m) => m.LobbyComponent),
  },
  {
    path: 'codebattle/battle-lobby',
    data: { title: 'Codebattle Battle Lobby' },
    loadComponent: () =>
      import('./codebattle/battle-lobby/battle-lobby.component').then(
        (m) => m.BattleLobbyComponent,
      ),
  },
  {
    path: 'codebattle/game',
    data: { title: 'Codebattle Game' },
    loadComponent: () =>
      import('./codebattle/game/game.component').then((m) => m.GameComponent),
  },
  {
    path: 'codebattle/results',
    data: { title: 'Codebattle Results' },
    loadComponent: () =>
      import('./codebattle/results/results.component').then(
        (m) => m.ResultsComponent,
      ),
  },
  {
    path: 'analytics',
    data: { title: 'Analytics' },
    loadChildren: () =>
      import('./modules/analytics/analytics.module').then((m) => m.AnalyticsModule),
  },
];

@NgModule({
  imports: [ChatModule, RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
