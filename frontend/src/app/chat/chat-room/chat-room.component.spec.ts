import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ChatRoomComponent } from './chat-room.component';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';
import { Router } from '@angular/router';

describe('ChatRoomComponent', () => {
  let component: ChatRoomComponent;
  let fixture: ComponentFixture<ChatRoomComponent>;
  const chatApiSpy = {
    getSessions: jasmine.createSpy('getSessions').and.returnValue(of({ rooms: [] })),
    getUsersByRole: jasmine.createSpy('getUsersByRole').and.returnValue(of([])),
    getHistory: jasmine.createSpy('getHistory').and.returnValue(of([])),
    createRoom: jasmine.createSpy('createRoom').and.returnValue(of({ _id: 'r1', name: 'Group' })),
    addMembersToRoom: jasmine.createSpy('addMembersToRoom').and.returnValue(of({ _id: 'r1' })),
    leaveRoom: jasmine.createSpy('leaveRoom').and.returnValue(of({ success: true })),
    renameRoom: jasmine.createSpy('renameRoom').and.returnValue(of({ _id: 'r1', name: 'Updated' })),
    uploadAvatar: jasmine.createSpy('uploadAvatar').and.returnValue(of({ _id: 'r1' })),
    uploadAttachments: jasmine.createSpy('uploadAttachments').and.returnValue(of([])),
    deleteRoom: jasmine.createSpy('deleteRoom').and.returnValue(of({})),
  };
  const chatSocketSpy = {
    connect: jasmine.createSpy('connect'),
    disconnect: jasmine.createSpy('disconnect'),
    joinRoom: jasmine.createSpy('joinRoom'),
    leaveRoom: jasmine.createSpy('leaveRoom'),
    sendMessage: jasmine.createSpy('sendMessage'),
    deleteMessage: jasmine.createSpy('deleteMessage'),
    onNewMessage: jasmine.createSpy('onNewMessage').and.returnValue(of({ sessionId: 's1' })),
    onMessageDeleted: jasmine.createSpy('onMessageDeleted').and.returnValue(of({ messageId: 'm1' })),
  };
  const routerSpy = { navigate: jasmine.createSpy('navigate'), url: '/student-dashboard' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ChatRoomComponent],
      providers: [
        { provide: ChatApiService, useValue: chatApiSpy },
        { provide: ChatSocketService, useValue: chatSocketSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('getDashboardRoute returns correct route for roles', () => {
    component.userRole = 'admin';
    expect(component.getDashboardRoute()).toBe('/admin');
    component.userRole = 'instructor';
    expect(component.getDashboardRoute()).toBe('/instructor/dashboard');
    component.userRole = 'student';
    expect(component.getDashboardRoute()).toBe('/student-dashboard');
  });

  it('toggleStudentSelection adds and removes ids', () => {
    component.selectedStudents = [];
    component.toggleStudentSelection('a');
    expect(component.selectedStudents).toContain('a');
    component.toggleStudentSelection('a');
    expect(component.selectedStudents).not.toContain('a');
  });
});
