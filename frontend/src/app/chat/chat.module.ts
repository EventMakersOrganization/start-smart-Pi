import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { SharedModule } from '../shared/shared.module';

import { ChatAiComponent } from './chat-ai/chat-ai.component';
import { ChatInstructorComponent } from './chat-instructor/chat-instructor.component';
import { ChatRoomComponent } from './chat-room/chat-room.component';

@NgModule({
  declarations: [
    ChatAiComponent,
    ChatInstructorComponent,
    ChatRoomComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MarkdownModule.forChild(),
    SharedModule
  ],
  exports: [
    ChatAiComponent,
    ChatInstructorComponent,
    ChatRoomComponent
  ]
})
export class ChatModule { }
