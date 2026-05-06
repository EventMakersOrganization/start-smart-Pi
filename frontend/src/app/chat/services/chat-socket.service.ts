import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { socketBaseUrl } from '../../core/api-url';

@Injectable({
  providedIn: 'root'
})
export class ChatSocketService {
  private socket: Socket | undefined;
  private ioFunc = io;

  constructor() { }

  connect() {
    if (!this.socket) {
      const token = localStorage.getItem('authToken');
      this.socket = this.ioFunc(socketBaseUrl(), {
        auth: { token }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
  }

  joinRoom(sessionType: string, sessionId: string) {
    this.socket?.emit('joinRoom', { sessionType, sessionId });
  }

  leaveRoom(sessionId: string) {
    this.socket?.emit('leaveRoom', sessionId);
  }

  sendMessage(sessionType: string, sessionId: string, content: string, attachments: any[] = []) {
    // sender is now derived from the authenticated socket on the backend
    this.socket?.emit('sendMessage', { sessionType, sessionId, content, attachments });
  }

  onNewMessage(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('newMessage', (msg: any) => observer.next(msg));
    });
  }

  sendTyping(sessionType: string, sessionId: string, isTyping: boolean) {
    this.socket?.emit('typing', { sessionType, sessionId, isTyping });
  }

  onUserTyping(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('userTyping', (data: any) => observer.next(data));
    });
  }

  onUserStatus(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('userStatus', (data: any) => observer.next(data));
    });
  }

  deleteMessage(messageId: string, sessionId: string) {
    this.socket?.emit('deleteMessage', { messageId, sessionId });
  }

  onMessageDeleted(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('messageDeleted', (data) => observer.next(data));
    });
  }
}
