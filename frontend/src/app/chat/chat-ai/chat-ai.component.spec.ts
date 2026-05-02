import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatAiComponent } from './chat-ai.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';
import { SpeechToTextService } from '../services/speech-to-text.service';
import { PdfExportService } from '../services/pdf-export.service';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ChatAiComponent', () => {
  let component: ChatAiComponent;
  let fixture: ComponentFixture<ChatAiComponent>;

  beforeEach(() => {
    const chatApiMock = {
      getSessions: () => of({ ai: [] }),
      getHistory: () => of([]),
      aiHealthCheck: () => of({ status: 'ok' })
    };

    const chatSocketMock = {
      connect: () => {},
      onNewMessage: () => of(),
      onUserTyping: () => of(),
      onMessageDeleted: () => of(),
      joinRoom: () => {},
      leaveRoom: () => {}
    };

    const speechMock = {
      stop: () => {},
      isSupported: () => true
    };

    const pdfMock = {
      exportElement: () => Promise.resolve()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [ChatAiComponent],
      providers: [
        { provide: ChatApiService, useValue: chatApiMock },
        { provide: ChatSocketService, useValue: chatSocketMock },
        { provide: SpeechToTextService, useValue: speechMock },
        { provide: PdfExportService, useValue: pdfMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    fixture = TestBed.createComponent(ChatAiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
