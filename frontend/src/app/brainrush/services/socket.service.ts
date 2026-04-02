import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: Socket;
  private socketUrl = 'http://localhost:3000/brainrush'; // Matches Gateway namespace

  connect(token: string) {
    this.socket = io(this.socketUrl, {
      extraHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  joinRoom(roomCode: string) {
    if (this.socket) {
      this.socket.emit('joinGameRoom', roomCode);
    }
  }

  updateScore(gameSessionId: string, roomCode: string) {
    if (this.socket) {
      this.socket.emit('updateScore', { gameSessionId, roomCode });
    }
  }

  onLeaderboardUpdate(): Observable<any> {
    return new Observable((subscriber) => {
      if (this.socket) {
        this.socket.on('leaderboardUpdate', (data) => subscriber.next(data));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
