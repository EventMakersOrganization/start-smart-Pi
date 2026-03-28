import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { UserManagementModule } from './user-management/user-management.module';
import { JwtInterceptor } from './user-management/jwt.interceptor';

import { SocialLoginModule, SocialAuthServiceConfig, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { environment } from '../environments/environment';

import { ChatAiComponent } from './chat/chat-ai/chat-ai.component';
import { ChatInstructorComponent } from './chat/chat-instructor/chat-instructor.component';
import { ChatRoomComponent } from './chat/chat-room/chat-room.component';
import { MarkdownModule, MarkedOptions } from 'ngx-markdown';
import { chatMarkdownOptionsFactory } from './chat/markdown-options.factory';

@NgModule({
  declarations: [
    AppComponent,
    ChatAiComponent,
    ChatInstructorComponent,
    ChatRoomComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    UserManagementModule,
    SocialLoginModule,
    FormsModule,
    MarkdownModule.forRoot({
      markedOptions: {
        provide: MarkedOptions,
        useFactory: chatMarkdownOptionsFactory,
      },
    }),
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(
              environment.googleClientId
            )
          }
        ]
      } as SocialAuthServiceConfig,
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
