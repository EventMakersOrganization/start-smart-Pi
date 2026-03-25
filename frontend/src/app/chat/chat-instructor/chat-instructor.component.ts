import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';

@Component({
  selector: 'app-chat-instructor',
  templateUrl: './chat-instructor.component.html',
  styleUrls: ['./chat-instructor.component.css']
})
export class ChatInstructorComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  sessions: any[] = [];
  messages: any[] = [];
  instructors: any[] = [];
  currentSessionId: string | null = null;
  currentSessionTitle = '';
  newMessage = '';
  userId = '';
  showNewChatModal = false;
  private subs: any[] = [];

  constructor(
    private chatApiService: ChatApiService,
    private chatSocketService: ChatSocketService
  ) { }

  ngOnInit() {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // The backend uses 'sub' for the user ID in the JWT token payload
        this.userId = payload.sub || payload.id || 'mock-user-id';
      } catch (e) {
        this.userId = 'mock-user-id';
      }
    } else {
      this.userId = 'mock-user-id';
    }

    this.chatSocketService.connect(this.userId);
    this.loadSessions();
    this.loadInstructors();

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
        this.sessions = res.instructor || [];
      },
      error: (err: any) => console.error('Error loading sessions', err)
    });
  }

  loadInstructors() {
    this.chatApiService.getUsersByRole('instructor').subscribe({
      next: (res: any) => {
        console.log('[DEBUG] API response for instructors:', res);
        this.instructors = res || [];
      },
      error: (err: any) => console.error('Error loading instructors', err)
    });
  }

  startNewChat(instructorId: string) {
    this.chatApiService.createInstructorSession(instructorId).subscribe({
      next: (session: any) => {
        this.showNewChatModal = false;
        // Check if session already in list, if not add it
        const exists = this.sessions.find(s => s._id === session._id);
        if (!exists) this.sessions.unshift(session);
        this.loadSession(session._id, this.getOtherParticipant(session));
      },
      error: (err: any) => console.error('Error creating chat', err)
    });
  }

  getOtherParticipant(session: any): string {
    if (!session.participants) return 'Unknown User';
    const other = session.participants.find((p: any) => p._id !== this.userId && p !== this.userId);
    return other?.first_name ? `${other.first_name} ${other.last_name}` : (other?.firstName ? `${other.firstName} ${other.lastName}` : (other || 'Unknown User'));
  }

  getOtherParticipantObj(session: any): any {
    if (!session.participants) return null;
    const other = session.participants.find((p: any) => p._id !== this.userId && p !== this.userId);
    return typeof other === 'object' ? other : null;
  }

  loadSession(sessionId: string, title: string) {
    if (this.currentSessionId) {
      this.chatSocketService.leaveRoom(this.currentSessionId);
    }

    this.currentSessionId = sessionId;
    this.currentSessionTitle = title;
    this.chatSocketService.joinRoom(sessionId);

    this.chatApiService.getHistory('ChatInstructor', sessionId).subscribe({
      next: (msgs: any) => {
        this.messages = msgs;
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err: any) => console.error('Error history', err)
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.currentSessionId) return;

    this.chatSocketService.sendMessage('ChatInstructor', this.currentSessionId, this.userId, this.newMessage);
    this.newMessage = '';
  }
}
