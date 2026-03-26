import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';

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
  showNewGroupModal = false;
  newGroupName = '';
  selectedStudents: string[] = [];
  private subs: any[] = [];

  constructor(
    private chatApiService: ChatApiService,
    private chatSocketService: ChatSocketService
  ) { }

  ngOnInit() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.userId = user._id || user.id || 'mock-user-id';

    this.chatSocketService.connect(this.userId);
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
    this.chatSocketService.joinRoom(sessionId);

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

    this.chatSocketService.sendMessage('ChatRoom', this.currentSessionId, this.userId, this.newMessage);
    this.newMessage = '';
  }
}
