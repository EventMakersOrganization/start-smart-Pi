import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

// ── Shared interfaces ─────────────────────────────────────────────────────
export interface RoomPlayer {
  socketId: string;
  username: string;
  userId?: string;
  isHost: boolean;
  joinedAt?: Date;
}

export interface RoomData {
  roomCode: string;
  hostId: string;
  players: RoomPlayer[];
  status: 'waiting' | 'playing';
}

// ── Service ───────────────────────────────────────────────────────────────
@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket!: Socket;
  private readonly socketUrl = 'http://localhost:3000/brainrush';

  // ── Connect / Disconnect ────────────────────────────────────────────────

  connect(token?: string): void {
    if (this.socket?.connected) return;

    const opts: any = { transports: ['websocket', 'polling'] };
    if (token) {
      opts.extraHeaders = { Authorization: `Bearer ${token}` };
    }

    this.socket = io(this.socketUrl, opts);

    this.socket.on('connect', () =>
      console.log('[SocketService] Connected:', this.socket.id)
    );
    this.socket.on('disconnect', (reason) =>
      console.warn('[SocketService] Disconnected:', reason)
    );
    this.socket.on('connect_error', (err) =>
      console.error('[SocketService] Connection error:', err.message)
    );
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  get socketId(): string {
    return this.socket?.id ?? '';
  }

  // ── Emit events ─────────────────────────────────────────────────────────

  /** Host: create a new room */
  createRoom(username: string, userId?: string): void {
    this.socket?.emit('createRoom', { username, userId });
  }

  /** Guest: join an existing room */
  joinRoom(roomCode: string, username: string, userId?: string): void {
    this.socket?.emit('joinRoom', { roomCode, username, userId });
  }

  /** Host: start the game */
  startGame(roomCode: string): void {
    this.socket?.emit('startGame', { roomCode });
  }

  /** Legacy score update */
  updateScore(gameSessionId: string, roomCode: string): void {
    this.socket?.emit('updateScore', { gameSessionId, roomCode });
  }

  /** Multiplayer: broadcast this player's final score to the room */
  submitFinalScore(roomCode: string, username: string, score: number, difficulty: string): void {
    this.socket?.emit('submitFinalScore', { roomCode, username, score, difficulty });
  }

  // ── Listen events ────────────────────────────────────────────────────────

  /** Fired when host successfully creates a room */
  onRoomCreated(): Observable<{ roomCode: string; room: RoomData }> {
    return this.fromEvent('roomCreated');
  }

  /** Fired when a joiner successfully joins */
  onRoomJoined(): Observable<{ roomCode: string; room: RoomData }> {
    return this.fromEvent('roomJoined');
  }

  /** Fired to ALL room members when someone joins */
  onPlayerJoined(): Observable<{ players: RoomPlayer[]; newPlayer: { socketId: string; username: string } }> {
    return this.fromEvent('playerJoined');
  }

  /** Fired to ALL room members when someone leaves */
  onPlayerLeft(): Observable<{ socketId: string; players: RoomPlayer[]; newHostId: string }> {
    return this.fromEvent('playerLeft');
  }

  /** Fired to ALL room members when host starts the game */
  onGameStarted(): Observable<{ roomCode: string; players: RoomPlayer[] }> {
    return this.fromEvent('gameStarted');
  }

  /** Fired on any room-level error */
  onRoomError(): Observable<{ message: string }> {
    return this.fromEvent('roomError');
  }

  /** Leaderboard update */
  onLeaderboardUpdate(): Observable<any> {
    return this.fromEvent('leaderboardUpdate');
  }

  /** Multiplayer final scores — fires each time a player submits */
  onFinalScores(): Observable<{ scores: { username: string; score: number; difficulty: string; socketId: string }[]; total: number; submitted: number }> {
    return this.fromEvent('finalScores');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private fromEvent<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (!this.socket) {
        subscriber.error(new Error('Socket not connected'));
        return;
      }
      const handler = (data: T) => subscriber.next(data);
      this.socket.on(event, handler);
      return () => this.socket.off(event, handler);
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
