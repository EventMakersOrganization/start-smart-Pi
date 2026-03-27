import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';

@Component({
  selector: 'app-chat-ai',
  templateUrl: './chat-ai.component.html',
  styleUrls: ['./chat-ai.component.css']
})
export class ChatAiComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  sessions: any[] = [];
  messages: any[] = [];
  currentSessionId: string | null = null;
  currentSessionTitle = '';
  newMessage = '';
  isAiTyping = false;
  aiOnline = true;
  userId = '';
  userRole = '';
  private subs: any[] = [];

  constructor(
    private chatApiService: ChatApiService,
    private chatSocketService: ChatSocketService
  ) {}

  ngOnInit() {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.userId = payload.sub || payload.id || 'mock-user-id';
        this.userRole = payload.role || '';
      } catch (e) {
        this.userId = 'mock-user-id';
      }
    } else {
      this.userId = 'mock-user-id';
    }

    this.chatSocketService.connect();
    this.loadSessions();
    this.checkAiHealth();

    this.subs.push(
      this.chatSocketService.onNewMessage().subscribe((msg: any) => {
        if (msg.sessionId === this.currentSessionId) {
          if (msg.sender === 'AI') {
            msg._parsed = this.parseAiContent(msg.content);
            this.isAiTyping = false;
          }
          this.messages.push(msg);
        }
      }),
      this.chatSocketService.onUserTyping().subscribe((payload: any) => {
        if (payload.sender === 'AI') {
          this.isAiTyping = payload.isTyping;
        }
      }),
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
        this.sessions = res.ai || [];
        if (this.sessions.length > 0 && !this.currentSessionId) {
          this.loadSession(this.sessions[0]._id, this.sessions[0].title);
        }
      },
      error: (err) => console.error('Error loading sessions', err)
    });
  }

  loadSession(sessionId: string, title: string) {
    if (this.currentSessionId) {
      this.chatSocketService.leaveRoom(this.currentSessionId);
    }

    this.currentSessionId = sessionId;
    this.currentSessionTitle = title || 'AI Session';
    this.chatSocketService.joinRoom('ChatAi', sessionId);

    this.chatApiService.getHistory('ChatAi', sessionId).subscribe({
      next: (msgs: any) => {
        this.messages = msgs.map((m: any) => {
          if (m.sender === 'AI') {
            m._parsed = this.parseAiContent(m.content);
          }
          return m;
        });
      },
      error: (err) => console.error('Error history', err)
    });
  }

  startNewSession() {
    const title = 'New Topic';
    this.chatApiService.createAiSession(title).subscribe({
      next: (session: any) => {
        this.sessions.unshift(session);
        this.loadSession(session._id, session.title);
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.currentSessionId) return;
    this.chatSocketService.sendMessage('ChatAi', this.currentSessionId, this.newMessage);
    this.isAiTyping = true; // Show AI thinking since we know it's AI chat
    this.newMessage = '';
  }

  parseAiContent(content: string): { answer: string; sources: string[]; confidence: string } {
    const parts = content.split('\n\n---\n');
    const answer = parts[0] || content;
    let sources: string[] = [];
    let confidence = '';

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes('**Sources:**')) {
        sources = part
          .replace('**Sources:**', '')
          .trim()
          .split('\n')
          .filter((s: string) => s.trim());
      }
      const confMatch = part.match(/Confidence:\s*(\d+%)/);
      if (confMatch) {
        confidence = confMatch[1];
      }
    }
    return { answer, sources, confidence };
  }

  checkAiHealth() {
    this.chatApiService.aiHealthCheck().subscribe({
      next: (res: any) => { this.aiOnline = res?.status === 'ok'; },
      error: () => { this.aiOnline = false; },
    });

  }

  getDashboardRoute(): string {
    if (this.userRole === 'admin') return '/admin';
    if (this.userRole === 'instructor') return '/instructor/dashboard';
    return '/student-dashboard';
  }
}
