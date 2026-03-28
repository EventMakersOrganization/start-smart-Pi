import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChatAiComponent } from './chat/chat-ai/chat-ai.component';
import { ChatInstructorComponent } from './chat/chat-instructor/chat-instructor.component';
import { ChatRoomComponent } from './chat/chat-room/chat-room.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'chat/ai', component: ChatAiComponent },
  { path: 'chat/instructor', component: ChatInstructorComponent },
  { path: 'chat/room', component: ChatRoomComponent },
  { path: 'brainrush', loadChildren: () => import('./brainrush/brainrush.module').then(m => m.BrainrushModule) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
