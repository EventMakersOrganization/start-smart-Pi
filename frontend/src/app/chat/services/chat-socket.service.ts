import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatSocketService {
  private socket: Socket | undefined;

  constructor() { }

  connect(userId: string) {
    if (!this.socket) {
      this.socket = io('http://localhost:3000', {
        query: { userId }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
  }

  joinRoom(room: string) {
    this.socket?.emit('joinRoom', room);
  }

  leaveRoom(room: string) {
    this.socket?.emit('leaveRoom', room);
  }

  sendMessage(sessionType: string, sessionId: string, sender: string, content: string) {
    this.socket?.emit('sendMessage', { sessionType, sessionId, sender, content });
  }

  onNewMessage(): Observable<any> {
    return new Observable(observer => {
      this.socket?.on('newMessage', (msg: any) => observer.next(msg));
    });
  }

  sendTyping(sessionId: string, sender: string, isTyping: boolean) {
    this.socket?.emit('typing', { sessionId, sender, isTyping });
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
}
