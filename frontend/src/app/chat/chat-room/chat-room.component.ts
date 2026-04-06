import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.component.html',
  styleUrls: ['./chat-room.component.css']
})
export class ChatRoomComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  rooms: any[] = [];
  messages: any[] = [];
  students: any[] = [];
  currentSessionId: string | null = null;
  currentSessionTitle = '';
  newMessage = '';
  userId = '';
  userRole = '';
  showNewGroupModal = false;
  newGroupName = '';
  selectedStudents: string[] = [];
  private subs: any[] = [];

  constructor(
    private chatApiService: ChatApiService,
    private chatSocketService: ChatSocketService,
    private router: Router
  ) { }

  ngOnInit() {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.userId = payload.sub || payload.id || 'mock-user-id';
        this.userRole = payload.role || '';
        
        if (this.userRole !== 'student') {
          this.router.navigate([this.getDashboardRoute()]);
          return;
        }
      } catch (e) {
        this.userId = 'mock-user-id';
      }
    } else {
      this.userId = 'mock-user-id';
    }

    this.chatSocketService.connect();
    this.loadSessions();
    this.loadStudents();

    this.subs.push(
      this.chatSocketService.onNewMessage().subscribe((msg: any) => {
        if (msg.sessionId === this.currentSessionId) {
          this.messages.push(msg);
          this.scrollToBottom();
        }
      })
    );

    this.subs.push(
      this.chatSocketService.onMessageDeleted().subscribe((data: any) => {
        if (this.currentSessionId) {
          this.messages = this.messages.filter(m => m._id !== data.messageId);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.currentSessionId) {
      this.chatSocketService.leaveRoom(this.currentSessionId);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      if (this.myScrollContainer) {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) { }
  }

  loadSessions() {
    this.chatApiService.getSessions().subscribe({
      next: (res: any) => {
        this.rooms = res.rooms || [];
      },
      error: (err: any) => console.error('Error loading rooms', err)
    });
  }

  loadStudents() {
    this.chatApiService.getUsersByRole('student').subscribe({
      next: (res: any) => {
        // filter out current user and map
        this.students = (res || []).filter((s: any) => s.id !== this.userId);
      },
      error: (err: any) => console.error('Error loading students', err)
    });
  }

  toggleStudentSelection(studentId: string) {
    const idx = this.selectedStudents.indexOf(studentId);
    if (idx > -1) {
      this.selectedStudents.splice(idx, 1);
    } else {
      this.selectedStudents.push(studentId);
    }
  }

  createGroup() {
    if (!this.newGroupName.trim() || this.selectedStudents.length === 0) return;
    this.chatApiService.createRoom(this.newGroupName, this.selectedStudents).subscribe({
      next: (room: any) => {
        this.showNewGroupModal = false;
        this.newGroupName = '';
        this.selectedStudents = [];
        this.rooms.unshift(room);
        this.loadSession(room._id, room.name);
      },
      error: (err: any) => console.error('Error creating group', err)
    });
  }

  loadSession(sessionId: string, title: string) {
    if (this.currentSessionId) {
      this.chatSocketService.leaveRoom(this.currentSessionId);
    }

    this.currentSessionId = sessionId;
    this.currentSessionTitle = title;
    this.chatSocketService.joinRoom('ChatRoom', sessionId);

    this.chatApiService.getHistory('ChatRoom', sessionId).subscribe({
      next: (msgs: any) => {
        this.messages = msgs;
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err: any) => console.error('Error history', err)
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.currentSessionId) return;

    this.chatSocketService.sendMessage('ChatRoom', this.currentSessionId, this.newMessage);
    this.newMessage = '';
  }

  deleteMessage(messageId: string) {
    if (confirm('Are you sure you want to delete this message?')) {
      this.chatSocketService.deleteMessage(messageId, this.currentSessionId!);
    }
  }

  getDashboardRoute(): string {
    if (this.userRole === 'admin') return '/admin';
    if (this.userRole === 'instructor') return '/instructor/dashboard';
    return '/student-dashboard';
  }
}
