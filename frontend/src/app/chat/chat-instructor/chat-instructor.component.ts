import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-instructor',
  templateUrl: './chat-instructor.component.html',
  styleUrls: ['./chat-instructor.component.css']
})
export class ChatInstructorComponent implements OnInit, OnDestroy {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  sessions: any[] = [];
  messages: any[] = [];
  instructors: any[] = [];
  currentSessionId: string | null = null;
  currentSessionTitle = '';
  newMessage = '';
  userId = '';
  userRole = '';
  showNewChatModal = false;
  showSettings = false;
  pendingFiles: File[] = [];
  isUploading = false;
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
      } catch (e) {
        this.userId = 'mock-user-id';
      }
    } else {
      this.userId = 'mock-user-id';
    }

    this.chatSocketService.connect();
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

  scrollToBottom(force: boolean = false): void {
    try {
      if (this.myScrollContainer) {
        const container = this.myScrollContainer.nativeElement;
        const threshold = 200;
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + threshold;

        if (force || isAtBottom) {
          setTimeout(() => {
            container.scrollTop = container.scrollHeight;
          }, 50);
        }
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
    this.chatApiService.getAvailableInstructors().subscribe({
      next: (res: any) => {
        // Filter out the current user to prevent self-chatting
        this.instructors = (res || []).filter((u: any) => (u._id || u.id) !== this.userId);
      },
      error: (err: any) => console.error('Error loading instructors', err)
    });
  }

  startNewChat(instructorId: string) {
    this.chatApiService.createInstructorSession(instructorId).subscribe({
      next: (session: any) => {
        this.showNewChatModal = false;
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
    this.chatSocketService.joinRoom('ChatInstructor', sessionId);
    this.showSettings = false;

    this.chatApiService.getHistory('ChatInstructor', sessionId).subscribe({
      next: (msgs: any) => {
        this.messages = msgs;
        setTimeout(() => this.scrollToBottom(true), 100);
      },
      error: (err: any) => console.error('Error history', err)
    });
  }

  sendMessage() {
    if (!this.currentSessionId) return;
    if (!this.newMessage.trim() && this.pendingFiles.length === 0) return;

    if (this.pendingFiles.length > 0) {
      this.isUploading = true;
      this.chatApiService.uploadAttachments(this.pendingFiles as any).subscribe({
        next: (attachments) => {
          this.chatSocketService.sendMessage('ChatInstructor', this.currentSessionId!, this.newMessage, attachments);
          this.newMessage = '';
          this.pendingFiles = [];
          this.isUploading = false;
          this.scrollToBottom(true);
        },
        error: (err) => {
          console.error('Upload failed', err);
          alert(err.error?.message || 'Failed to upload files');
          this.isUploading = false;
        }
      });
    } else {
      this.chatSocketService.sendMessage('ChatInstructor', this.currentSessionId!, this.newMessage);
      this.newMessage = '';
      this.scrollToBottom(true);
    }
  }

  onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        this.pendingFiles.push(files[i]);
      }
    }
  }

  removePendingFile(index: number) {
    this.pendingFiles.splice(index, 1);
  }

  isMyMessage(msg: any): boolean {
    const senderId = msg.sender?._id || msg.sender;
    return String(senderId) === String(this.userId);
  }

  deleteMessage(messageId: string) {
    const msg = this.messages.find(m => m._id === messageId);
    if (!msg || !this.isMyMessage(msg)) return;

    if (confirm('Are you sure you want to delete this message?')) {
      this.chatSocketService.deleteMessage(messageId, this.currentSessionId!);
    }
  }

  deleteSession(event: Event, sessionId: string) {
    event.stopPropagation(); // Prevent loading the session
    if (confirm('Are you sure you want to delete this entire conversation?')) {
      this.chatApiService.deleteInstructorSession(sessionId).subscribe({
        next: () => {
          this.sessions = this.sessions.filter(s => s._id !== sessionId);
          if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
            this.currentSessionTitle = '';
            this.messages = [];
          }
        },
        error: (err: any) => console.error('Error deleting session', err)
      });
    }
  }

  getDashboardRoute(): string {
    if (this.userRole === 'admin') return '/admin';
    if (this.userRole === 'instructor') return '/instructor/dashboard';
    return '/student-dashboard';
  }

  isInsideShell(): boolean {
    return this.router.url.includes('/student-dashboard') || 
           this.router.url.includes('/instructor/chat');
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }

  get sharedContent() {
    const photos: any[] = [];
    const files: any[] = [];
    const links: any[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    this.messages.forEach(m => {
      // Extract from attachments
      if (m.attachments && m.attachments.length > 0) {
        m.attachments.forEach((a: any) => {
          if (a.type === 'image' || a.mimeType?.startsWith('image/')) {
            photos.push({ ...a, sender: m.sender, createdAt: m.createdAt });
          } else {
            files.push({ ...a, sender: m.sender, createdAt: m.createdAt });
          }
        });
      }
      // Extract links from content
      if (m.content) {
        const matches = m.content.match(urlRegex);
        if (matches) {
          matches.forEach((url: string) => {
            links.push({ url, sender: m.sender, createdAt: m.createdAt });
          });
        }
      }
    });

    return { photos, files, links };
  }

  get availableInstructors(): any[] {
    const existingParticipantIds = new Set(
      this.sessions.flatMap(s => (s.participants || []).map((p: any) => p._id || p))
    );
    return this.instructors.filter(inst => !existingParticipantIds.has(inst.id || inst._id));
  }
}
