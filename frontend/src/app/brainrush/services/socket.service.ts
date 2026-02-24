import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: Socket;

  connect() {
    const token = localStorage.getItem('authToken');
    this.socket = io('http://localhost:3000', {
      auth: { token }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  joinRoom(roomCode: string) {
    this.socket.emit('joinRoom', { roomCode });
  }

  leaveRoom(roomCode: string) {
    this.socket.emit('leaveRoom', { roomCode });
  }

  onNewQuestion(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('newQuestion', (data) => observer.next(data));
    });
  }

  onLeaderboardUpdate(): Observable<any[]> {
    return new Observable(observer => {
      this.socket.on('leaderboardUpdate', (data) => observer.next(data));
    });
  }

  onPlayerJoined(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('playerJoined', (data) => observer.next(data));
    });
  }
}
