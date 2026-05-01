import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ChatRoomComponent } from './chat-room.component';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';
import { Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';

describe('ChatRoomComponent', () => {
  let component: ChatRoomComponent;
  let fixture: ComponentFixture<ChatRoomComponent>;
  let mockChatApi: any;
  let mockChatSocket: any;
  let mockRouter: any;

  const mockNewMessageSubject = new Subject();
  const mockMessageDeletedSubject = new Subject();

  beforeEach(async () => {
    mockChatApi = {
      getSessions: jasmine.createSpy('getSessions').and.returnValue(of({ rooms: [] })),
      getUsersByRole: jasmine.createSpy('getUsersByRole').and.returnValue(of([])),
      getHistory: jasmine.createSpy('getHistory').and.returnValue(of([])),
      createRoom: jasmine.createSpy('createRoom').and.returnValue(of({})),
      deleteRoom: jasmine.createSpy('deleteRoom').and.returnValue(of({}))
    };

    mockChatSocket = {
      connect: jasmine.createSpy('connect'),
      joinRoom: jasmine.createSpy('joinRoom'),
      leaveRoom: jasmine.createSpy('leaveRoom'),
      sendMessage: jasmine.createSpy('sendMessage'),
      onNewMessage: jasmine.createSpy('onNewMessage').and.returnValue(mockNewMessageSubject.asObservable()),
      onMessageDeleted: jasmine.createSpy('onMessageDeleted').and.returnValue(mockMessageDeletedSubject.asObservable())
    };

    mockRouter = {
      navigate: jasmine.createSpy('navigate'),
      url: '/student-dashboard/chat'
    };

    // Mock localStorage
    const mockToken = 'header.' + btoa(JSON.stringify({ sub: 'user123', role: 'student' })) + '.signature';
    spyOn(localStorage, 'getItem').and.callFake((key) => {
      if (key === 'authToken') return mockToken;
      return null;
    });

    await TestBed.configureTestingModule({
      declarations: [ChatRoomComponent],
      imports: [FormsModule, RouterTestingModule],
      providers: [
        { provide: ChatApiService, useValue: mockChatApi },
        { provide: ChatSocketService, useValue: mockChatSocket },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and initialize with user data', () => {
    expect(component).toBeTruthy();
    expect(component.userId).toBe('user123');
    expect(component.userRole).toBe('student');
    expect(mockChatSocket.connect).toHaveBeenCalled();
    expect(mockChatApi.getSessions).toHaveBeenCalled();
  });

  it('should redirect if user is not a student', () => {
    const mockToken = 'header.' + btoa(JSON.stringify({ sub: 'user123', role: 'instructor' })) + '.signature';
    (localStorage.getItem as jasmine.Spy).and.returnValue(mockToken);
    
    // Create new instance to trigger ngOnInit
    const instructorFixture = TestBed.createComponent(ChatRoomComponent);
    instructorFixture.detectChanges();
    
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/instructor/dashboard']);
  });

  it('should load sessions on init', () => {
    const rooms = [{ _id: 'r1', name: 'Group 1' }];
    mockChatApi.getSessions.and.returnValue(of({ rooms }));
    
    component.loadSessions();
    expect(component.rooms).toEqual(rooms);
  });

  it('should load history when a session is selected', fakeAsync(() => {
    const msgs = [{ _id: 'm1', content: 'Hi' }];
    mockChatApi.getHistory.and.returnValue(of(msgs));
    
    component.loadSession('r1', 'Group 1');
    tick(200); // Wait for both setTimeouts (100ms + 50ms)
    
    expect(component.currentSessionId).toBe('r1');
    expect(component.messages).toEqual(msgs);
    expect(mockChatSocket.joinRoom).toHaveBeenCalledWith('ChatRoom', 'r1');
  }));

  it('should send a message via socket', () => {
    component.currentSessionId = 'r1';
    component.newMessage = 'Hello world';
    component.sendMessage();
    
    expect(mockChatSocket.sendMessage).toHaveBeenCalledWith('ChatRoom', 'r1', 'Hello world');
    expect(component.newMessage).toBe('');
  });

  it('should handle new messages via socket subscription', () => {
    component.currentSessionId = 'r1';
    const msg = { sessionId: 'r1', content: 'incoming' };
    mockNewMessageSubject.next(msg);
    
    expect(component.messages).toContain(msg);
  });

  it('should show error if loading sessions fails', () => {
    spyOn(console, 'error');
    mockChatApi.getSessions.and.returnValue(throwError(() => new Error('fail')));
    component.loadSessions();
    expect(console.error).toHaveBeenCalled();
  });

  it('should delete room after confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const event = { stopPropagation: () => {} } as any;
    
    component.rooms = [{ _id: 'r1' }];
    component.deleteRoom(event, 'r1');
    
    expect(mockChatApi.deleteRoom).toHaveBeenCalledWith('r1');
    expect(component.rooms.length).toBe(0);
  });
});
