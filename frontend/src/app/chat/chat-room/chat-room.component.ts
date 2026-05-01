import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ChatApiService } from '../services/chat-api.service';
import { ChatSocketService } from '../services/chat-socket.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.component.html',
  styleUrls: ['./chat-room.component.css']
})
export class ChatRoomComponent implements OnInit, OnDestroy {
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
  showAddMemberModal = false;
  showSettings = false;
  isEditingName = false;
  tempGroupName = '';
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

  scrollToBottom(force: boolean = false): void {
    try {
      if (this.myScrollContainer) {
        const container = this.myScrollContainer.nativeElement;
        const threshold = 200; // pixels from bottom to be considered "at bottom"
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
    if (this.selectedStudents.length === 0) return;
    const finalName = this.newGroupName.trim() || 'New Group ' + new Date().toLocaleDateString();
    this.chatApiService.createRoom(finalName, this.selectedStudents).subscribe({
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

  addMembers() {
    if (!this.currentSessionId || this.selectedStudents.length === 0) return;
    this.chatApiService.addMembersToRoom(this.currentSessionId, this.selectedStudents).subscribe({
      next: (updatedRoom: any) => {
        this.showAddMemberModal = false;
        this.selectedStudents = [];
        // Update the room in the list
        const idx = this.rooms.findIndex(r => r._id === this.currentSessionId);
        if (idx > -1) {
          this.rooms[idx] = updatedRoom;
        }
        alert('Members added successfully!');
      },
      error: (err: any) => {
        console.error('Error adding members', err);
        alert(err.error?.message || 'Failed to add members');
      }
    });
  }

  get currentRoom() {
    return this.rooms.find(r => r._id === this.currentSessionId);
  }

  leaveGroup() {
    if (!this.currentSessionId) return;
    if (confirm('Are you sure you want to leave this group?')) {
        this.chatApiService.leaveRoom(this.currentSessionId).subscribe({
            next: () => {
                this.rooms = this.rooms.filter(r => r._id !== this.currentSessionId);
                this.currentSessionId = null;
                this.showSettings = false;
            },
            error: (err) => alert('Failed to leave group')
        });
    }
  }

  deleteRoom(event: Event, roomId: string) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this group chat for everyone?')) {
      this.chatApiService.deleteRoom(roomId).subscribe({
        next: () => {
          this.rooms = this.rooms.filter(r => r._id !== roomId);
          if (this.currentSessionId === roomId) {
            this.currentSessionId = null;
            this.currentSessionTitle = '';
            this.messages = [];
          }
        },
        error: (err: any) => console.error('Error deleting room', err)
      });
    }
  }

  startEditingName() {
    this.tempGroupName = this.currentRoom?.name || '';
    this.isEditingName = true;
  }

  saveRoomName() {
    if (!this.currentSessionId || !this.tempGroupName.trim()) {
        this.isEditingName = false;
        return;
    }

    this.chatApiService.renameRoom(this.currentSessionId, this.tempGroupName).subscribe({
        next: (updatedRoom) => {
            const idx = this.rooms.findIndex(r => r._id === this.currentSessionId);
            if (idx > -1) {
                this.rooms[idx] = updatedRoom;
                this.currentSessionTitle = updatedRoom.name;
            }
            this.isEditingName = false;
        },
        error: (err: any) => {
            console.error('Failed to rename group', err);
            alert(err.error?.message || 'Failed to rename group');
            this.isEditingName = false;
        }
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file && this.currentSessionId) {
        this.chatApiService.uploadAvatar(this.currentSessionId, file).subscribe({
            next: (updatedRoom) => {
                const idx = this.rooms.findIndex(r => r._id === this.currentSessionId);
                if (idx > -1) {
                    this.rooms[idx] = updatedRoom;
                }
            },
            error: (err: any) => {
                console.error('Failed to upload avatar', err);
                alert(err.error?.message || 'Failed to upload avatar');
            }
        });
    }
  }

  get availableStudentsToAdd() {
    if (!this.currentSessionId) return [];
    const currentRoom = this.rooms.find(r => r._id === this.currentSessionId);
    if (!currentRoom) return this.students;
    const currentParticipantIds = (currentRoom.participants || []).map((p: any) => p._id || p);
    return this.students.filter(s => !currentParticipantIds.includes(s.id));
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
          this.chatSocketService.sendMessage('ChatRoom', this.currentSessionId!, this.newMessage, attachments);
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
      this.chatSocketService.sendMessage('ChatRoom', this.currentSessionId!, this.newMessage);
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

  removeFile(index: number) {
    this.pendingFiles.splice(index, 1);
  }

  get sharedContent() {
    const images: any[] = [];
    const files: any[] = [];
    const links: any[] = [];

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    this.messages.forEach(msg => {
      // Extract attachments
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach((att: any) => {
          if (att.fileType?.startsWith('image/')) {
            images.push(att);
          } else {
            files.push(att);
          }
        });
      }

      // Extract links from content
      if (msg.content) {
        const matches = msg.content.match(urlRegex);
        if (matches) {
          matches.forEach((link: string) => {
            links.push({ url: link, filename: link });
          });
        }
      }
    });

    return { images: images.reverse(), files: files.reverse(), links: links.reverse() };
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

  getDashboardRoute(): string {
    if (this.userRole === 'admin') return '/admin';
    if (this.userRole === 'instructor') return '/instructor/dashboard';
    return '/student-dashboard';
  }

  isInsideShell(): boolean {
    return this.router.url.includes('/student-dashboard');
  }
}
