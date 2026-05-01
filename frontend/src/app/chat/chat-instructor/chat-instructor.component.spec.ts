import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatInstructorComponent } from './chat-instructor.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ChatInstructorComponent', () => {
  let component: ChatInstructorComponent;
  let fixture: ComponentFixture<ChatInstructorComponent>;

  beforeEach(() => {
    const chatApiMock = {
      getSessions: () => of({ instructor: [] }),
      getAvailableInstructors: () => of([]),
      getHistory: () => of([])
    };

    const chatSocketMock = {
      connect: () => {},
      onNewMessage: () => of(),
      onMessageDeleted: () => of(),
      joinRoom: () => {},
      leaveRoom: () => {}
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [ChatInstructorComponent],
      providers: [
        { provide: ChatApiService, useValue: chatApiMock },
        { provide: ChatSocketService, useValue: chatSocketMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    fixture = TestBed.createComponent(ChatInstructorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
