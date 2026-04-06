import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';
import { SpeechToTextService } from '../services/speech-to-text.service';
import { PdfExportService } from '../services/pdf-export.service';

/** Must match backend `ChatGateway.CHAT_SOURCES_DELIM` body (without leading newlines for index). */
const CHAT_SOURCES_MARKER = '\n\n<<<CHAT_SOURCES>>>\n\n';

@Component({
  selector: 'app-chat-ai',
  templateUrl: './chat-ai.component.html',
  styleUrls: ['./chat-ai.component.css'],
})
export class ChatAiComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;
  @ViewChild('exportRoot') private exportRoot!: ElementRef<HTMLElement>;

  sessions: any[] = [];
  messages: any[] = [];
  currentSessionId: string | null = null;
  currentSessionTitle = '';
  newMessage = '';
  isAiTyping = false;
  aiOnline = true;
  userId = '';
  userRole = '';
  voiceListening = false;
  voiceError: string | null = null;
  speechInterim = '';
  private speechCommitted = '';
  pdfExporting = false;
  private subs: any[] = [];

  constructor(
    private chatApiService: ChatApiService,
    private chatSocketService: ChatSocketService,
    private speechToText: SpeechToTextService,
    private pdfExport: PdfExportService,
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

    this.subs.push(
      this.chatSocketService.onMessageDeleted().subscribe((data: any) => {
        if (this.currentSessionId) {
          this.messages = this.messages.filter(m => m._id !== data.messageId);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
    this.speechToText.stop();
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
        this.myScrollContainer.nativeElement.scrollTop =
          this.myScrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      /* ignore */
    }
  }

  loadSessions() {
    this.chatApiService.getSessions().subscribe({
      next: (res: any) => {
        this.sessions = res.ai || [];
        if (this.sessions.length > 0 && !this.currentSessionId) {
          this.loadSession(this.sessions[0]._id, this.sessions[0].title);
        }
      },
      error: (err) => console.error('Error loading sessions', err),
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
      error: (err) => console.error('Error history', err),
    });
  }

  startNewSession() {
    const title = 'New Topic';
    this.chatApiService.createAiSession(title).subscribe({
      next: (session: any) => {
        this.sessions.unshift(session);
        this.loadSession(session._id, session.title);
      },
    });
  }

  onEnterKey(ev: Event) {
    const ke = ev as KeyboardEvent;
    if (ke.shiftKey) return;
    ke.preventDefault();
    this.sendMessage();
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.currentSessionId) return;
    this.chatSocketService.sendMessage(
      'ChatAi',
      this.currentSessionId,
      this.newMessage,
    );
    this.isAiTyping = true;
    this.newMessage = '';
  }

parseAiContent(content: string): {
    answer: string;
    sources: string[];
    confidence: string;
  } {
    let body = content;
    let metaSections: string[] = [];

    const newIdx = content.indexOf(CHAT_SOURCES_MARKER);
    if (newIdx >= 0) {
      body = content.slice(0, newIdx).trimEnd();
      metaSections = [content.slice(newIdx + CHAT_SOURCES_MARKER.length)];
    } else {
      const parts = content.split('\n\n---\n');
      body = parts[0] || content;
      metaSections = parts.slice(1);
    }

    let sources: string[] = [];
    let confidence = '';

    for (const part of metaSections) {
      if (part.includes('**Sources:**')) {
        const after = part.split('**Sources:**')[1] || '';
        const beforeConf = after.split(/\n\n🎯/)[0].split(/\n🎯/)[0];
        sources = beforeConf
          .trim()
          .split('\n')
          .filter((s: string) => s.trim());
      }
      const confMatch = part.match(/Confidence:\s*(\d+%)/);
      if (confMatch) {
        confidence = confMatch[1];
      }
    }
    return { answer: body, sources, confidence };
  }

  toggleVoice() {
    this.voiceError = null;
    if (!this.speechToText.isSupported()) {
      this.voiceError =
        'Voice input works best in Chrome or Edge on desktop.';
      return;
    }
    if (this.voiceListening) {
      this.speechToText.stop();
      this.voiceListening = false;
      this.speechInterim = '';
      return;
    }
    this.speechCommitted = this.newMessage.trim()
      ? this.newMessage.trim() + ' '
      : '';
    this.speechInterim = '';
    this.voiceListening = true;
    this.speechToText.start(
      {
        onResult: (text, isFinal) => {
          if (isFinal) {
            this.speechCommitted += text + ' ';
            this.newMessage = (this.speechCommitted + this.speechInterim).trim();
            this.speechInterim = '';
          } else {
            this.speechInterim = text;
            this.newMessage = (
              this.speechCommitted + this.speechInterim
            ).trim();
          }
        },
        onError: (msg) => {
          this.voiceError = msg;
          this.voiceListening = false;
          this.speechInterim = '';
        },
        onEnd: () => {
          this.voiceListening = false;
          this.speechInterim = '';
        },
      },
      typeof navigator !== 'undefined' ? navigator.language : undefined,
    );
  }

  async exportConversation() {
    if (!this.exportRoot?.nativeElement || this.messages.length === 0) return;
    this.pdfExporting = true;
    this.voiceError = null;
    try {
      const name = `chat-${this.currentSessionTitle || 'session'}-${new Date().toISOString().slice(0, 10)}`;
      await this.pdfExport.exportElement(this.exportRoot.nativeElement, name);
    } catch (e) {
      this.voiceError = 'Could not create PDF. Try a shorter conversation.';
    } finally {
      this.pdfExporting = false;
    }
  }

  checkAiHealth() {
    this.chatApiService.aiHealthCheck().subscribe({
      next: (res: any) => {
        this.aiOnline = res?.status === 'ok';
      },
      error: () => {
        this.aiOnline = false;
      },
    });
  }

deleteMessage(messageId: string) {
    if (confirm('Are you sure you want to delete this message?')) {
      this.chatSocketService.deleteMessage(messageId, this.currentSessionId!);
    }
  }

  deleteSession(event: Event, sessionId: string) {
    event.stopPropagation(); // Prevent loading the session when clicking delete
    if (confirm('Are you sure you want to delete this Entire conversation? This action cannot be undone.')) {
      this.chatApiService.deleteAiSession(sessionId).subscribe({
        next: () => {
          this.sessions = this.sessions.filter(s => s._id !== sessionId);
          if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
            this.currentSessionTitle = '';
            this.messages = [];
            // Optionally load the next session if it exists
            if (this.sessions.length > 0) {
              this.loadSession(this.sessions[0]._id, this.sessions[0].title);
            }
          }
        },
        error: (err) => console.error('Error deleting session', err)
      });
    }
  }
  getDashboardRoute(): string {
    if (this.userRole === 'admin') return '/admin';
    if (this.userRole === 'instructor') return '/instructor/dashboard';
    return '/student-dashboard';
  }
}
